# Threat model

| Risk | Prototype control | Production extension |
|---|---|---|
| Stolen API credentials | Optional constant-time API-key filter; no committed secrets | Cognito/OIDC, short-lived tokens, Secrets Manager rotation |
| Malicious or malformed input | Bean validation, numeric bounds, length limits, JSON-only contract | WAF, schema gateway, rate limits, anomaly detection |
| PII leakage in logs | Pseudonymous applicant hash; no raw signal logging | Field-level encryption, DLP scanning, retention enforcement |
| Model or prompt manipulation | Versioned local model, LLM outside decision path, evidence-only prompt | Signed artifacts, model registry approvals, Bedrock Guardrails |
| Discriminatory outcomes | Protected traits excluded, fairness report, human review | Representative subgroup validation, independent model risk review |
| Explanation mismatch | Reasons use actual model contributions | Automated adverse-action fidelity tests and compliance sign-off |
| Audit tampering | Append-only decision records with timestamps and versions | Hash-chained events, immutable object lock, restricted audit role |
| Dataset poisoning or drift | Deterministic source manifest and drift view | Data contracts, lineage, champion/challenger, rollback alarms |

## Trust boundaries

The browser is untrusted. The API validates all fields. Model artifacts and prompt templates are deployed as versioned application resources. Database and Bedrock credentials exist only at runtime. The LLM receives structured reasons, not raw applicant records, and cannot change the numeric decision.
