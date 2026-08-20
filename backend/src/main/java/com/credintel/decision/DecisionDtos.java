package com.credintel.decision;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public final class DecisionDtos {
    private DecisionDtos() {
    }

    public enum Recommendation { APPROVE, REVIEW, DECLINE }
    public enum Direction { POSITIVE, NEGATIVE }
    public enum CheckStatus { PASS, REVIEW, FAIL }

    public record Applicant(
            @NotBlank @Size(max = 64) String externalId,
            @NotBlank @Size(max = 120) String fullName,
            @Min(18) @Max(80) int age,
            @NotNull @Positive BigDecimal monthlyIncome,
            @NotNull @Positive BigDecimal loanAmount,
            @Min(3) @Max(60) int loanTenureMonths,
            @NotBlank @Size(max = 120) String purpose,
            boolean consentGranted
    ) {
    }

    public record Signals(
            @Min(0) @Max(120) int incomeStabilityMonths,
            @DecimalMin("0.0") @DecimalMax("1.0") double utilityOnTimeRatio,
            @DecimalMin("0.0") @DecimalMax("1.0") double cashflowVolatility,
            @DecimalMin("0.0") @DecimalMax("1.0") double debtToIncomeRatio,
            @Min(0) @Max(240) int mobileAccountTenureMonths,
            @DecimalMin("0.0") double averageMonthlyBalance,
            @DecimalMin("0.0") @DecimalMax("1.0") double deviceTrustScore,
            @DecimalMin("0.0") @DecimalMax("1.0") double identityConsistencyScore,
            @Min(0) @Max(100) int recentFailedLogins,
            @DecimalMin("0.0") @DecimalMax("1.0") double locationConsistencyScore
    ) {
    }

    public record AssessmentRequest(@NotNull @Valid Applicant applicant, @NotNull @Valid Signals signals) {
    }

    public record ReasonCode(
            String code,
            String label,
            int impact,
            Direction direction,
            String evidence
    ) {
    }

    public record PolicyCheck(String code, String label, CheckStatus status, String detail) {
    }

    public record DecisionResponse(
            String decisionId,
            Instant createdAt,
            Recommendation recommendation,
            int creditConfidence,
            double probabilityOfRepayment,
            int fraudRisk,
            List<ReasonCode> reasonCodes,
            List<PolicyCheck> policyChecks,
            String summary,
            String modelVersion,
            long processingTimeMs,
            boolean humanReviewRequired,
            Applicant applicant,
            Signals signals
    ) {
    }

    public record ModelMetrics(
            String modelVersion,
            String modelType,
            int trainRows,
            int validationRows,
            boolean protectedTraitsUsedForTraining,
            List<String> excludedTraits
    ) {
    }
}
