package com.credintel.explanation;

import com.credintel.decision.DecisionDtos.PolicyCheck;
import com.credintel.decision.DecisionDtos.ReasonCode;
import com.credintel.decision.DecisionDtos.Recommendation;

import java.util.List;

public interface NarrativeProvider {
    String summarize(Recommendation recommendation, List<ReasonCode> reasons, List<PolicyCheck> checks);
}
