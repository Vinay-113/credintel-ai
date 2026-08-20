import creditModel from "./credit-model.json";

export type Recommendation = "APPROVE" | "REVIEW" | "DECLINE";

export interface ApplicantInput {
  externalId: string;
  fullName: string;
  age: number;
  monthlyIncome: number;
  loanAmount: number;
  loanTenureMonths: number;
  purpose: string;
  consentGranted: boolean;
}

export interface AlternativeSignals {
  incomeStabilityMonths: number;
  utilityOnTimeRatio: number;
  cashflowVolatility: number;
  debtToIncomeRatio: number;
  mobileAccountTenureMonths: number;
  averageMonthlyBalance: number;
  deviceTrustScore: number;
  identityConsistencyScore: number;
  recentFailedLogins: number;
  locationConsistencyScore: number;
}

export interface AssessmentRequest {
  applicant: ApplicantInput;
  signals: AlternativeSignals;
}

export interface ReasonCode {
  code: string;
  label: string;
  impact: number;
  direction: "POSITIVE" | "NEGATIVE";
  evidence: string;
}

export interface PolicyCheck {
  code: string;
  label: string;
  status: "PASS" | "REVIEW" | "FAIL";
  detail: string;
}

export interface DecisionResponse {
  decisionId: string;
  createdAt: string;
  recommendation: Recommendation;
  creditConfidence: number;
  probabilityOfRepayment: number;
  fraudRisk: number;
  reasonCodes: ReasonCode[];
  policyChecks: PolicyCheck[];
  summary: string;
  modelVersion: string;
  processingTimeMs: number;
  humanReviewRequired: boolean;
  applicant: ApplicantInput;
  signals: AlternativeSignals;
}

const CREDIT_FEATURES = [
  { name: "income_stability", code: "INCOME_STABILITY", label: "Income history is established", value: (r: AssessmentRequest) => clamp(r.signals.incomeStabilityMonths / 24), evidence: (r: AssessmentRequest) => `${r.signals.incomeStabilityMonths} months of observed income` },
  { name: "utility_history", code: "UTILITY_HISTORY", label: "Utility payments are consistent", value: (r: AssessmentRequest) => clamp(r.signals.utilityOnTimeRatio), evidence: (r: AssessmentRequest) => `${Math.round(r.signals.utilityOnTimeRatio * 100)}% paid on time` },
  { name: "cashflow_stability", code: "CASHFLOW_STABILITY", label: "Cash flow is stable", value: (r: AssessmentRequest) => clamp(1 - r.signals.cashflowVolatility), evidence: (r: AssessmentRequest) => `${Math.round(r.signals.cashflowVolatility * 100)}% monthly volatility` },
  { name: "affordability", code: "AFFORDABILITY", label: "Debt burden is within range", value: (r: AssessmentRequest) => clamp(1 - r.signals.debtToIncomeRatio), evidence: (r: AssessmentRequest) => `${Math.round(r.signals.debtToIncomeRatio * 100)}% debt-to-income` },
  { name: "mobile_tenure", code: "MOBILE_TENURE", label: "Mobile account has meaningful tenure", value: (r: AssessmentRequest) => clamp(r.signals.mobileAccountTenureMonths / 36), evidence: (r: AssessmentRequest) => `${r.signals.mobileAccountTenureMonths} months of account history` },
  { name: "balance_buffer", code: "BALANCE_BUFFER", label: "Average balance provides a buffer", value: (r: AssessmentRequest) => clamp(r.signals.averageMonthlyBalance / 10000), evidence: (r: AssessmentRequest) => `Rs ${Math.round(r.signals.averageMonthlyBalance).toLocaleString("en-IN")} average balance` },
  { name: "device_trust", code: "DEVICE_TRUST", label: "Device behavior is trusted", value: (r: AssessmentRequest) => clamp(r.signals.deviceTrustScore), evidence: (r: AssessmentRequest) => `${Math.round(r.signals.deviceTrustScore * 100)}/100 device trust` },
  { name: "identity_match", code: "IDENTITY_MATCH", label: "Identity signals are consistent", value: (r: AssessmentRequest) => clamp(r.signals.identityConsistencyScore), evidence: (r: AssessmentRequest) => `${Math.round(r.signals.identityConsistencyScore * 100)}% identity consistency` },
  { name: "access_behavior", code: "ACCESS_BEHAVIOR", label: "Account access pattern is normal", value: (r: AssessmentRequest) => clamp(1 - r.signals.recentFailedLogins / 5), evidence: (r: AssessmentRequest) => `${r.signals.recentFailedLogins} recent failed login attempts` },
  { name: "location_stability", code: "LOCATION_STABILITY", label: "Location behavior is consistent", value: (r: AssessmentRequest) => clamp(r.signals.locationConsistencyScore), evidence: (r: AssessmentRequest) => `${Math.round(r.signals.locationConsistencyScore * 100)}% location consistency` },
  { name: "loan_scale", code: "LOAN_SCALE", label: "Requested amount matches income", value: (r: AssessmentRequest) => clamp(1 - r.applicant.loanAmount / Math.max(r.applicant.monthlyIncome * 12, 1)), evidence: (r: AssessmentRequest) => `${Math.round((r.applicant.loanAmount / Math.max(r.applicant.monthlyIncome * 12, 1)) * 100)}% of annual income` },
] as const;

const MODEL_WEIGHTS = new Map(creditModel.features.map((feature) => [feature.name, feature.weight]));

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function sigmoid(value: number) {
  return 1 / (1 + Math.exp(-value));
}

const FRAUD_AWARE_FEATURES = new Set(["DEVICE_TRUST", "IDENTITY_MATCH", "ACCESS_BEHAVIOR", "LOCATION_STABILITY"]);

function makeReasonCodes(
  request: AssessmentRequest,
  recommendation: Recommendation,
  policyChecks: PolicyCheck[],
): ReasonCode[] {
  const modelReasons = CREDIT_FEATURES.flatMap((feature) => {
    const value = feature.value(request);
    const impact = (value - 0.5) * (MODEL_WEIGHTS.get(feature.name) ?? 0);
    const reason = {
      code: feature.code,
      label: feature.label,
      impact: Math.round(impact * 10),
      direction: impact >= 0 ? "POSITIVE" : "NEGATIVE",
      evidence: feature.evidence(request),
    } satisfies ReasonCode;

    // Negative identity and device evidence is explained by the fraud engine below,
    // where its actual contribution to the fraud decision can be represented faithfully.
    return reason.direction === "NEGATIVE" && FRAUD_AWARE_FEATURES.has(reason.code) ? [] : [reason];
  });

  const { signals } = request;
  const fraudReasons: ReasonCode[] = [
    {
      code: "FRAUD_DEVICE_TRUST",
      label: "Device trust requires verification",
      impact: -Math.round((1 - signals.deviceTrustScore) * 21),
      direction: "NEGATIVE",
      evidence: `${Math.round(signals.deviceTrustScore * 100)}/100 device trust`,
    },
    {
      code: "FRAUD_IDENTITY_MATCH",
      label: "Identity consistency requires verification",
      impact: -Math.round((1 - signals.identityConsistencyScore) * 22),
      direction: "NEGATIVE",
      evidence: `${Math.round(signals.identityConsistencyScore * 100)}% identity consistency`,
    },
    {
      code: "FRAUD_ACCESS_BEHAVIOR",
      label: "Recent access failures raise risk",
      impact: -Math.min(15, Math.round(signals.recentFailedLogins * 2.5)),
      direction: "NEGATIVE",
      evidence: `${signals.recentFailedLogins} recent failed login attempts`,
    },
    {
      code: "FRAUD_LOCATION_STABILITY",
      label: "Location behavior requires verification",
      impact: -Math.round((1 - signals.locationConsistencyScore) * 15),
      direction: "NEGATIVE",
      evidence: `${Math.round(signals.locationConsistencyScore * 100)}% location consistency`,
    },
  ].filter((reason) => reason.impact <= -3);

  const policyReasons: ReasonCode[] = policyChecks
    .filter((check) => check.status !== "PASS")
    .map((check) => ({
      code: `POLICY_${check.code}`,
      label: check.status === "FAIL" ? `${check.label} failed` : `${check.label} requires review`,
      impact: check.status === "FAIL" ? -25 : -14,
      direction: "NEGATIVE" as const,
      evidence: check.detail,
    }));

  const preferredDirection = recommendation === "APPROVE" ? "POSITIVE" : "NEGATIVE";
  return [...modelReasons, ...fraudReasons, ...policyReasons]
    .sort((a, b) => {
      const directionDifference = Number(a.direction !== preferredDirection) - Number(b.direction !== preferredDirection);
      return directionDifference || Math.abs(b.impact) - Math.abs(a.impact);
    })
    .slice(0, 5);
}

function fraudProbability(request: AssessmentRequest) {
  const { signals } = request;
  const logit =
    -3.2 +
    (1 - signals.deviceTrustScore) * 2.1 +
    (1 - signals.identityConsistencyScore) * 2.2 +
    signals.recentFailedLogins * 0.25 +
    (1 - signals.locationConsistencyScore) * 1.5 +
    signals.cashflowVolatility * 0.8;
  return sigmoid(logit);
}

function buildPolicyChecks(request: AssessmentRequest): PolicyCheck[] {
  const { applicant, signals } = request;
  const loanToAnnualIncome = applicant.loanAmount / Math.max(applicant.monthlyIncome * 12, 1);
  return [
    {
      code: "CONSENT",
      label: "Alternative-data consent",
      status: applicant.consentGranted ? "PASS" : "FAIL",
      detail: applicant.consentGranted ? "Explicit consent recorded" : "Consent is required before assessment",
    },
    {
      code: "AGE",
      label: "Minimum applicant age",
      status: applicant.age >= 21 ? "PASS" : "FAIL",
      detail: `${applicant.age} years; policy minimum is 21`,
    },
    {
      code: "DTI",
      label: "Debt-to-income policy",
      status: signals.debtToIncomeRatio > 0.7 ? "FAIL" : signals.debtToIncomeRatio > 0.5 ? "REVIEW" : "PASS",
      detail: `${Math.round(signals.debtToIncomeRatio * 100)}% observed DTI`,
    },
    {
      code: "LOAN_INCOME",
      label: "Loan-to-annual-income policy",
      status: loanToAnnualIncome > 0.75 ? "FAIL" : loanToAnnualIncome > 0.45 ? "REVIEW" : "PASS",
      detail: `${Math.round(loanToAnnualIncome * 100)}% of annual income`,
    },
  ];
}

export function assessApplication(
  request: AssessmentRequest,
  options: { decisionId?: string; createdAt?: string; processingTimeMs?: number } = {},
): DecisionResponse {
  const creditLogit = CREDIT_FEATURES.reduce(
    (total, feature) => total + feature.value(request) * (MODEL_WEIGHTS.get(feature.name) ?? 0),
    creditModel.intercept,
  );
  const probabilityOfRepayment = sigmoid(creditLogit);
  const creditConfidence = Math.round(probabilityOfRepayment * 100);
  const fraudRisk = Math.round(fraudProbability(request) * 100);
  const policyChecks = buildPolicyChecks(request);
  const hasHardFail = policyChecks.some((check) => check.status === "FAIL");
  const hasReviewFlag = policyChecks.some((check) => check.status === "REVIEW");

  let recommendation: Recommendation;
  if (hasHardFail || fraudRisk >= creditModel.thresholds.fraudDecline * 100 || creditConfidence < creditModel.thresholds.review * 100) recommendation = "DECLINE";
  else if (fraudRisk >= creditModel.thresholds.fraudReview * 100 || hasReviewFlag || creditConfidence < creditModel.thresholds.approve * 100) recommendation = "REVIEW";
  else recommendation = "APPROVE";

  const summary = recommendation === "APPROVE"
    ? "The observed repayment and identity signals meet the prototype policy threshold. Final approval remains subject to human verification."
    : recommendation === "REVIEW"
      ? "The profile shows credible repayment capacity with at least one signal that requires an underwriter's confirmation."
      : "The application does not meet the current prototype policy threshold. The reason codes below identify the strongest contributing signals.";

  return {
    decisionId: options.decisionId ?? `CI-${new Date().getUTCFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
    createdAt: options.createdAt ?? new Date().toISOString(),
    recommendation,
    creditConfidence,
    probabilityOfRepayment: Number(probabilityOfRepayment.toFixed(4)),
    fraudRisk,
    reasonCodes: makeReasonCodes(request, recommendation, policyChecks),
    policyChecks,
    summary,
    modelVersion: creditModel.modelVersion,
    processingTimeMs: options.processingTimeMs ?? 118,
    humanReviewRequired: recommendation !== "APPROVE",
    applicant: request.applicant,
    signals: request.signals,
  };
}

export function isAssessmentRequest(value: unknown): value is AssessmentRequest {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<AssessmentRequest>;
  return Boolean(
    candidate.applicant &&
    candidate.signals &&
    typeof candidate.applicant.externalId === "string" &&
    typeof candidate.applicant.fullName === "string" &&
    candidate.applicant.fullName.trim().length > 0 &&
    typeof candidate.applicant.monthlyIncome === "number" &&
    candidate.applicant.monthlyIncome > 0 &&
    typeof candidate.applicant.loanAmount === "number" &&
    candidate.applicant.loanAmount > 0 &&
    typeof candidate.signals.utilityOnTimeRatio === "number" &&
    candidate.signals.utilityOnTimeRatio >= 0 &&
    candidate.signals.utilityOnTimeRatio <= 1
  );
}
