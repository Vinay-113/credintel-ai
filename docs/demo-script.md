# Three-minute demo script

## 0:00-0:25 - Problem and promise

"Millions of new-to-credit applicants can be creditworthy but invisible to a traditional bureau-only score. CredIntel AI turns consented cash-flow, utility, device, and identity aggregates into a fast recommendation that an underwriter can inspect and challenge."

## 0:25-1:05 - Strong profile

Open the decision workspace.

"This applicant has an 89 repayment-confidence score and low fraud risk. The decision took under 200 milliseconds. More importantly, it is not a black box: each reason code is tied to the feature contribution and observed evidence."

Open the full explanation.

"The policy engine is separate from the model, and the language model is outside the decision path. Bedrock can summarize these approved facts, but it cannot change the recommendation."

## 1:05-1:40 - Borderline profile

Click **New application**, choose **Borderline**, then **Run assessment**.

"This profile has strong behavioral evidence, but debt-to-income exceeds the preferred band. The model may be positive, yet the deterministic policy routes it to human review. That separation makes the system easier to govern and tune."

## 1:40-2:05 - Fraud profile

Run the **Fraud signals** preset.

"Here the income story looks plausible, but device trust, identity consistency, failed logins, and location behavior raise fraud risk. The application is stopped before credit approval. Credit risk and fraud risk remain visible as different concepts."

## 2:05-2:35 - Governance

Open **Model monitoring**.

"The prototype tracks discrimination, drift, latency, and model ownership. The baseline reaches 0.834 ROC-AUC on synthetic validation, with a 0.017 equal-opportunity gap. Those numbers prove pipeline behavior, not production readiness, so the model card names the limitations and the validation still required."

## 2:35-3:00 - Engineering close

Open **Audit trail**.

"Every model, policy, consent, and human event is versioned and auditable. The implementation includes React, Spring Boot, PostgreSQL with pgvector, an optional Bedrock adapter, API-first documentation, security controls, tests, Docker deployment, and no hardcoded secrets. CredIntel expands the evidence available to an underwriter without hiding accountability behind AI."
