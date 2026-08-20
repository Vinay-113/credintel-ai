package com.credintel.decision;

import com.credintel.decision.DecisionDtos.Applicant;
import com.credintel.decision.DecisionDtos.AssessmentRequest;
import com.credintel.decision.DecisionDtos.Recommendation;
import com.credintel.decision.DecisionDtos.Signals;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
class UnderwritingServiceTest {
    @Autowired
    UnderwritingService service;

    @Test
    void approvesAStrongConsentedProfile() {
        var decision = service.assess(request(
                "Strong Applicant", new BigDecimal("32500"), new BigDecimal("85000"),
                new Signals(18, 0.96, 0.24, 0.42, 30, 8800, 0.92, 0.96, 0, 0.94)
        ));

        assertThat(decision.recommendation()).isEqualTo(Recommendation.APPROVE);
        assertThat(decision.creditConfidence()).isGreaterThanOrEqualTo(74);
        assertThat(decision.reasonCodes()).hasSize(5);
    }

    @Test
    void routesBorderlineAffordabilityToHumanReview() {
        var decision = service.assess(request(
                "Review Applicant", new BigDecimal("28000"), new BigDecimal("125000"),
                new Signals(22, 0.98, 0.20, 0.56, 32, 9000, 0.98, 0.98, 0, 0.98)
        ));

        assertThat(decision.recommendation()).isEqualTo(Recommendation.REVIEW);
        assertThat(decision.policyChecks()).anyMatch(check -> check.code().equals("DTI") && check.status().name().equals("REVIEW"));
        assertThat(decision.reasonCodes()).anyMatch(reason -> reason.code().equals("POLICY_DTI"));
    }

    @Test
    void declinesHighFraudSignalsEvenWhenIncomeIsStrong() {
        var decision = service.assess(request(
                "Fraud Applicant", new BigDecimal("46000"), new BigDecimal("90000"),
                new Signals(28, 0.93, 0.25, 0.31, 5, 9100, 0.12, 0.42, 4, 0.28)
        ));

        assertThat(decision.recommendation()).isEqualTo(Recommendation.DECLINE);
        assertThat(decision.fraudRisk()).isGreaterThanOrEqualTo(65);
        assertThat(decision.reasonCodes().getFirst().direction().name()).isEqualTo("NEGATIVE");
        assertThat(decision.reasonCodes()).anyMatch(reason -> reason.code().startsWith("FRAUD_"));
    }

    @Test
    void failsClosedWhenAlternativeDataConsentIsMissing() {
        var base = request(
                "No Consent", new BigDecimal("40000"), new BigDecimal("70000"),
                new Signals(24, 0.98, 0.18, 0.25, 30, 10000, 0.98, 0.98, 0, 0.98)
        );
        var withoutConsent = new AssessmentRequest(
                new Applicant(base.applicant().externalId(), base.applicant().fullName(), base.applicant().age(),
                        base.applicant().monthlyIncome(), base.applicant().loanAmount(), base.applicant().loanTenureMonths(),
                        base.applicant().purpose(), false),
                base.signals()
        );

        var decision = service.assess(withoutConsent);
        assertThat(decision.recommendation()).isEqualTo(Recommendation.DECLINE);
        assertThat(decision.reasonCodes()).anyMatch(reason -> reason.code().equals("POLICY_CONSENT"));
    }

    private AssessmentRequest request(String name, BigDecimal income, BigDecimal amount, Signals signals) {
        return new AssessmentRequest(
                new Applicant("TEST-" + name.replace(" ", "-"), name, 28, income, amount, 12, "Test purpose", true),
                signals
        );
    }
}
