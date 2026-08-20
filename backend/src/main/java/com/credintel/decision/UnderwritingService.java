package com.credintel.decision;

import com.credintel.decision.DecisionDtos.AssessmentRequest;
import com.credintel.decision.DecisionDtos.CheckStatus;
import com.credintel.decision.DecisionDtos.DecisionResponse;
import com.credintel.decision.DecisionDtos.Direction;
import com.credintel.decision.DecisionDtos.ModelMetrics;
import com.credintel.decision.DecisionDtos.PolicyCheck;
import com.credintel.decision.DecisionDtos.ReasonCode;
import com.credintel.decision.DecisionDtos.Recommendation;
import com.credintel.explanation.NarrativeProvider;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;

@Service
public class UnderwritingService {
    private final DecisionRepository repository;
    private final ObjectMapper objectMapper;
    private final NarrativeProvider narrativeProvider;
    private ModelArtifact model;
    private Map<String, Double> weights;

    public UnderwritingService(DecisionRepository repository, ObjectMapper objectMapper,
                               NarrativeProvider narrativeProvider) {
        this.repository = repository;
        this.objectMapper = objectMapper;
        this.narrativeProvider = narrativeProvider;
    }

    @PostConstruct
    void loadModel() throws IOException {
        try (var stream = new ClassPathResource("model/credit-model.json").getInputStream()) {
            model = objectMapper.readValue(stream, ModelArtifact.class);
        }
        LinkedHashMap<String, Double> loadedWeights = new LinkedHashMap<>();
        model.features().forEach(feature -> loadedWeights.put(feature.name(), feature.weight()));
        weights = Map.copyOf(loadedWeights);
        for (FeatureSpec feature : featureSpecs()) {
            if (!weights.containsKey(feature.name())) {
                throw new IllegalStateException("Model artifact is missing feature: " + feature.name());
            }
        }
    }

    @Transactional
    public DecisionResponse assess(AssessmentRequest request) {
        long startedAt = System.nanoTime();
        Map<String, Double> featureValues = featureValues(request);
        double logit = model.intercept();
        for (var entry : featureValues.entrySet()) {
            logit += entry.getValue() * weights.get(entry.getKey());
        }
        double repaymentProbability = sigmoid(logit);
        int creditConfidence = (int) Math.round(repaymentProbability * 100);
        int fraudRisk = (int) Math.round(fraudProbability(request) * 100);
        List<PolicyCheck> policyChecks = policyChecks(request);
        Recommendation recommendation = recommendation(creditConfidence, fraudRisk, policyChecks);
        List<ReasonCode> reasons = reasonCodes(request, featureValues, recommendation, policyChecks);

        String summary;
        try {
            summary = narrativeProvider.summarize(recommendation, reasons, policyChecks);
        } catch (RuntimeException exception) {
            summary = fallbackSummary(recommendation);
        }

        Instant createdAt = Instant.now();
        String decisionId = "CI-" + createdAt.atZone(ZoneOffset.UTC).getYear() + "-"
                + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        long processingTimeMs = Math.max(1, (System.nanoTime() - startedAt) / 1_000_000);
        DecisionResponse response = new DecisionResponse(
                decisionId,
                createdAt,
                recommendation,
                creditConfidence,
                round(repaymentProbability, 4),
                fraudRisk,
                reasons,
                policyChecks,
                summary,
                model.modelVersion(),
                processingTimeMs,
                recommendation != Recommendation.APPROVE,
                request.applicant(),
                request.signals()
        );

        try {
            repository.save(new DecisionEntity(
                    decisionId,
                    sha256(request.applicant().externalId()),
                    request.applicant().fullName(),
                    request.applicant().loanAmount().setScale(2, RoundingMode.HALF_UP),
                    recommendation.name(),
                    creditConfidence,
                    fraudRisk,
                    model.modelVersion(),
                    processingTimeMs,
                    objectMapper.writeValueAsString(response),
                    createdAt
            ));
        } catch (IOException exception) {
            throw new IllegalStateException("Unable to persist the decision record", exception);
        }
        return response;
    }

    @Transactional(readOnly = true)
    public List<DecisionResponse> recent() {
        return repository.findTop20ByOrderByCreatedAtDesc().stream().map(this::deserialize).toList();
    }

    @Transactional(readOnly = true)
    public DecisionResponse get(String id) {
        return repository.findById(id).map(this::deserialize)
                .orElseThrow(() -> new DecisionNotFoundException(id));
    }

    public ModelMetrics modelMetrics() {
        return new ModelMetrics(
                model.modelVersion(),
                model.modelType(),
                model.training().trainRows(),
                model.training().validationRows(),
                model.training().protectedTraitsUsedForTraining(),
                List.of("gender", "religion", "caste", "precise location", "contact-list contents")
        );
    }

    private DecisionResponse deserialize(DecisionEntity entity) {
        try {
            return objectMapper.readValue(entity.getResponseJson(), DecisionResponse.class);
        } catch (IOException exception) {
            throw new IllegalStateException("Stored decision record is unreadable", exception);
        }
    }

    private Map<String, Double> featureValues(AssessmentRequest request) {
        LinkedHashMap<String, Double> values = new LinkedHashMap<>();
        featureSpecs().forEach(feature -> values.put(feature.name(), feature.value().apply(request)));
        return values;
    }

    private List<FeatureSpec> featureSpecs() {
        return List.of(
                new FeatureSpec("income_stability", "INCOME_STABILITY", "Income history is established",
                        request -> clamp(request.signals().incomeStabilityMonths() / 24.0),
                        request -> request.signals().incomeStabilityMonths() + " months of observed income"),
                new FeatureSpec("utility_history", "UTILITY_HISTORY", "Utility payments are consistent",
                        request -> clamp(request.signals().utilityOnTimeRatio()),
                        request -> Math.round(request.signals().utilityOnTimeRatio() * 100) + "% paid on time"),
                new FeatureSpec("cashflow_stability", "CASHFLOW_STABILITY", "Cash flow is stable",
                        request -> clamp(1 - request.signals().cashflowVolatility()),
                        request -> Math.round(request.signals().cashflowVolatility() * 100) + "% monthly volatility"),
                new FeatureSpec("affordability", "AFFORDABILITY", "Debt burden is within range",
                        request -> clamp(1 - request.signals().debtToIncomeRatio()),
                        request -> Math.round(request.signals().debtToIncomeRatio() * 100) + "% debt-to-income"),
                new FeatureSpec("mobile_tenure", "MOBILE_TENURE", "Mobile account has meaningful tenure",
                        request -> clamp(request.signals().mobileAccountTenureMonths() / 36.0),
                        request -> request.signals().mobileAccountTenureMonths() + " months of account history"),
                new FeatureSpec("balance_buffer", "BALANCE_BUFFER", "Average balance provides a buffer",
                        request -> clamp(request.signals().averageMonthlyBalance() / 10_000.0),
                        request -> "Rs " + Math.round(request.signals().averageMonthlyBalance()) + " average balance"),
                new FeatureSpec("device_trust", "DEVICE_TRUST", "Device behavior is trusted",
                        request -> clamp(request.signals().deviceTrustScore()),
                        request -> Math.round(request.signals().deviceTrustScore() * 100) + "/100 device trust"),
                new FeatureSpec("identity_match", "IDENTITY_MATCH", "Identity signals are consistent",
                        request -> clamp(request.signals().identityConsistencyScore()),
                        request -> Math.round(request.signals().identityConsistencyScore() * 100) + "% identity consistency"),
                new FeatureSpec("access_behavior", "ACCESS_BEHAVIOR", "Account access pattern is normal",
                        request -> clamp(1 - request.signals().recentFailedLogins() / 5.0),
                        request -> request.signals().recentFailedLogins() + " recent failed login attempts"),
                new FeatureSpec("location_stability", "LOCATION_STABILITY", "Location behavior is consistent",
                        request -> clamp(request.signals().locationConsistencyScore()),
                        request -> Math.round(request.signals().locationConsistencyScore() * 100) + "% location consistency"),
                new FeatureSpec("loan_scale", "LOAN_SCALE", "Requested amount matches income",
                        request -> clamp(1 - request.applicant().loanAmount().doubleValue()
                                / Math.max(request.applicant().monthlyIncome().doubleValue() * 12, 1)),
                        request -> Math.round(request.applicant().loanAmount().doubleValue()
                                / Math.max(request.applicant().monthlyIncome().doubleValue() * 12, 1) * 100)
                                + "% of annual income")
        );
    }

    private List<ReasonCode> reasonCodes(AssessmentRequest request, Map<String, Double> featureValues,
                                         Recommendation recommendation, List<PolicyCheck> policyChecks) {
        List<ReasonCode> reasons = new ArrayList<>();
        for (FeatureSpec feature : featureSpecs()) {
            double contribution = (featureValues.get(feature.name()) - 0.5) * weights.get(feature.name());
            int impact = (int) Math.round(contribution * 10);
            boolean fraudAwareFeature = List.of("DEVICE_TRUST", "IDENTITY_MATCH", "ACCESS_BEHAVIOR", "LOCATION_STABILITY")
                    .contains(feature.code());
            if (impact < 0 && fraudAwareFeature) {
                continue;
            }
            reasons.add(new ReasonCode(
                    feature.code(),
                    feature.label(),
                    impact,
                    impact >= 0 ? Direction.POSITIVE : Direction.NEGATIVE,
                    feature.evidence().apply(request)
            ));
        }

        var signals = request.signals();
        addNegativeReason(reasons, "FRAUD_DEVICE_TRUST", "Device trust requires verification",
                (int) Math.round((1 - signals.deviceTrustScore()) * 21),
                Math.round(signals.deviceTrustScore() * 100) + "/100 device trust");
        addNegativeReason(reasons, "FRAUD_IDENTITY_MATCH", "Identity consistency requires verification",
                (int) Math.round((1 - signals.identityConsistencyScore()) * 22),
                Math.round(signals.identityConsistencyScore() * 100) + "% identity consistency");
        addNegativeReason(reasons, "FRAUD_ACCESS_BEHAVIOR", "Recent access failures raise risk",
                Math.min(15, (int) Math.round(signals.recentFailedLogins() * 2.5)),
                signals.recentFailedLogins() + " recent failed login attempts");
        addNegativeReason(reasons, "FRAUD_LOCATION_STABILITY", "Location behavior requires verification",
                (int) Math.round((1 - signals.locationConsistencyScore()) * 15),
                Math.round(signals.locationConsistencyScore() * 100) + "% location consistency");

        policyChecks.stream()
                .filter(check -> check.status() != CheckStatus.PASS)
                .forEach(check -> reasons.add(new ReasonCode(
                        "POLICY_" + check.code(),
                        check.status() == CheckStatus.FAIL ? check.label() + " failed" : check.label() + " requires review",
                        check.status() == CheckStatus.FAIL ? -25 : -14,
                        Direction.NEGATIVE,
                        check.detail()
                )));

        Direction preferredDirection = recommendation == Recommendation.APPROVE
                ? Direction.POSITIVE : Direction.NEGATIVE;
        Comparator<ReasonCode> byOutcomeRelevance = Comparator
                .comparingInt((ReasonCode reason) -> reason.direction() == preferredDirection ? 0 : 1)
                .thenComparing(Comparator.comparingInt((ReasonCode reason) -> Math.abs(reason.impact())).reversed());
        return reasons.stream()
                .sorted(byOutcomeRelevance)
                .limit(5)
                .toList();
    }

    private void addNegativeReason(List<ReasonCode> reasons, String code, String label,
                                   int magnitude, String evidence) {
        if (magnitude >= 3) {
            reasons.add(new ReasonCode(code, label, -magnitude, Direction.NEGATIVE, evidence));
        }
    }

    private List<PolicyCheck> policyChecks(AssessmentRequest request) {
        double loanToAnnualIncome = request.applicant().loanAmount().doubleValue()
                / Math.max(request.applicant().monthlyIncome().doubleValue() * 12, 1);
        return List.of(
                new PolicyCheck("CONSENT", "Alternative-data consent",
                        request.applicant().consentGranted() ? CheckStatus.PASS : CheckStatus.FAIL,
                        request.applicant().consentGranted() ? "Explicit consent recorded" : "Consent is required before assessment"),
                new PolicyCheck("AGE", "Minimum applicant age",
                        request.applicant().age() >= 21 ? CheckStatus.PASS : CheckStatus.FAIL,
                        request.applicant().age() + " years; policy minimum is 21"),
                new PolicyCheck("DTI", "Debt-to-income policy",
                        request.signals().debtToIncomeRatio() > 0.7 ? CheckStatus.FAIL
                                : request.signals().debtToIncomeRatio() > 0.5 ? CheckStatus.REVIEW : CheckStatus.PASS,
                        Math.round(request.signals().debtToIncomeRatio() * 100) + "% observed DTI"),
                new PolicyCheck("LOAN_INCOME", "Loan-to-annual-income policy",
                        loanToAnnualIncome > 0.75 ? CheckStatus.FAIL
                                : loanToAnnualIncome > 0.45 ? CheckStatus.REVIEW : CheckStatus.PASS,
                        Math.round(loanToAnnualIncome * 100) + "% of annual income")
        );
    }

    private Recommendation recommendation(int creditConfidence, int fraudRisk, List<PolicyCheck> policyChecks) {
        boolean hardFail = policyChecks.stream().anyMatch(check -> check.status() == CheckStatus.FAIL);
        boolean review = policyChecks.stream().anyMatch(check -> check.status() == CheckStatus.REVIEW);
        if (hardFail || fraudRisk >= model.thresholds().fraudDecline() * 100
                || creditConfidence < model.thresholds().review() * 100) {
            return Recommendation.DECLINE;
        }
        if (review || fraudRisk >= model.thresholds().fraudReview() * 100
                || creditConfidence < model.thresholds().approve() * 100) {
            return Recommendation.REVIEW;
        }
        return Recommendation.APPROVE;
    }

    private double fraudProbability(AssessmentRequest request) {
        var signals = request.signals();
        double logit = -3.2
                + (1 - signals.deviceTrustScore()) * 2.1
                + (1 - signals.identityConsistencyScore()) * 2.2
                + signals.recentFailedLogins() * 0.25
                + (1 - signals.locationConsistencyScore()) * 1.5
                + signals.cashflowVolatility() * 0.8;
        return sigmoid(logit);
    }

    private static String fallbackSummary(Recommendation recommendation) {
        return switch (recommendation) {
            case APPROVE -> "The observed signals meet the prototype threshold. A human owns the final lending decision.";
            case REVIEW -> "At least one signal requires confirmation. A human owns the final lending decision.";
            case DECLINE -> "The current policy threshold is not met. A human must review the reason codes before final action.";
        };
    }

    private static double sigmoid(double value) {
        return 1 / (1 + Math.exp(-value));
    }

    private static double clamp(double value) {
        return Math.max(0, Math.min(1, value));
    }

    private static double round(double value, int places) {
        double factor = Math.pow(10, places);
        return Math.round(value * factor) / factor;
    }

    private static String sha256(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable", exception);
        }
    }

    private record FeatureSpec(
            String name,
            String code,
            String label,
            Function<AssessmentRequest, Double> value,
            Function<AssessmentRequest, String> evidence
    ) {
    }

    private record ModelArtifact(
            String modelVersion,
            String modelType,
            double intercept,
            List<ModelFeature> features,
            ModelThresholds thresholds,
            ModelTraining training
    ) {
    }

    private record ModelFeature(String name, double weight) {
    }

    private record ModelThresholds(double approve, double review, double fraudReview, double fraudDecline) {
    }

    private record ModelTraining(
            String dataset,
            int trainRows,
            int validationRows,
            int seed,
            boolean protectedTraitsUsedForTraining
    ) {
    }
}
