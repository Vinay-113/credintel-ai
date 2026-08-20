package com.credintel.explanation;

import com.credintel.decision.DecisionDtos.PolicyCheck;
import com.credintel.decision.DecisionDtos.ReasonCode;
import com.credintel.decision.DecisionDtos.Recommendation;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@ConditionalOnProperty(name = "app.ai.provider", havingValue = "template", matchIfMissing = true)
public class TemplateNarrativeProvider implements NarrativeProvider {
    @Override
    public String summarize(Recommendation recommendation, List<ReasonCode> reasons, List<PolicyCheck> checks) {
        return switch (recommendation) {
            case APPROVE -> "The observed repayment and identity signals meet the prototype policy threshold. Final approval remains subject to human verification.";
            case REVIEW -> "The profile shows credible repayment capacity with at least one policy or risk signal that requires an underwriter's confirmation.";
            case DECLINE -> "The application does not meet the current prototype policy threshold. The reason codes identify the strongest contributing signals for human review.";
        };
    }
}
