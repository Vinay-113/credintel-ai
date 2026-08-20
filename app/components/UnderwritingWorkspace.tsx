"use client";

import {
  Activity,
  AlertTriangle,
  Bell,
  BrainCircuit,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleGauge,
  Clock3,
  Database,
  FileCheck2,
  FileText,
  LayoutDashboard,
  ListChecks,
  LockKeyhole,
  Plus,
  ScrollText,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  UserCheck,
  Users,
  X,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  assessApplication,
  type AssessmentRequest,
  type DecisionResponse,
  type Recommendation,
} from "../../lib/scoring";

type View = "decision" | "queue" | "monitoring" | "audit";
type PresetKey = "strong" | "borderline" | "fraud";

const PRESETS: Record<PresetKey, AssessmentRequest> = {
  strong: {
    applicant: {
      externalId: "NTC-0842",
      fullName: "Aarav Mehta",
      age: 27,
      monthlyIncome: 32500,
      loanAmount: 85000,
      loanTenureMonths: 12,
      purpose: "Work equipment",
      consentGranted: true,
    },
    signals: {
      incomeStabilityMonths: 18,
      utilityOnTimeRatio: 0.96,
      cashflowVolatility: 0.24,
      debtToIncomeRatio: 0.42,
      mobileAccountTenureMonths: 30,
      averageMonthlyBalance: 8800,
      deviceTrustScore: 0.92,
      identityConsistencyScore: 0.96,
      recentFailedLogins: 0,
      locationConsistencyScore: 0.94,
    },
  },
  borderline: {
    applicant: {
      externalId: "NTC-1047",
      fullName: "Priya Nair",
      age: 24,
      monthlyIncome: 28000,
      loanAmount: 125000,
      loanTenureMonths: 18,
      purpose: "Professional certification",
      consentGranted: true,
    },
    signals: {
      incomeStabilityMonths: 22,
      utilityOnTimeRatio: 0.98,
      cashflowVolatility: 0.2,
      debtToIncomeRatio: 0.56,
      mobileAccountTenureMonths: 32,
      averageMonthlyBalance: 9000,
      deviceTrustScore: 0.98,
      identityConsistencyScore: 0.98,
      recentFailedLogins: 0,
      locationConsistencyScore: 0.98,
    },
  },
  fraud: {
    applicant: {
      externalId: "NTC-1188",
      fullName: "Kabir Shah",
      age: 31,
      monthlyIncome: 46000,
      loanAmount: 90000,
      loanTenureMonths: 12,
      purpose: "Household appliance",
      consentGranted: true,
    },
    signals: {
      incomeStabilityMonths: 28,
      utilityOnTimeRatio: 0.93,
      cashflowVolatility: 0.25,
      debtToIncomeRatio: 0.31,
      mobileAccountTenureMonths: 5,
      averageMonthlyBalance: 9100,
      deviceTrustScore: 0.12,
      identityConsistencyScore: 0.42,
      recentFailedLogins: 4,
      locationConsistencyScore: 0.28,
    },
  },
};

const initialDecision = assessApplication(PRESETS.strong, {
  decisionId: "CI-2026-0842",
  createdAt: "2026-08-20T09:42:00.000Z",
  processingTimeMs: 142,
});

const seedQueue = [
  initialDecision,
  assessApplication(PRESETS.borderline, {
    decisionId: "CI-2026-1047",
    createdAt: "2026-08-20T09:31:00.000Z",
    processingTimeMs: 167,
  }),
  assessApplication(PRESETS.fraud, {
    decisionId: "CI-2026-1188",
    createdAt: "2026-08-20T09:16:00.000Z",
    processingTimeMs: 151,
  }),
];

const navigation: Array<{ id: View; label: string; icon: typeof LayoutDashboard }> = [
  { id: "decision", label: "Decision workspace", icon: LayoutDashboard },
  { id: "queue", label: "Review queue", icon: ListChecks },
  { id: "monitoring", label: "Model monitoring", icon: Activity },
  { id: "audit", label: "Audit trail", icon: ScrollText },
];

const signalDefinitions = [
  ["Income history", "incomeStabilityMonths", 36, "months"],
  ["Utility payments", "utilityOnTimeRatio", 1, "%"],
  ["Cash-flow stability", "cashflowVolatility", 1, "% inverse"],
  ["Debt affordability", "debtToIncomeRatio", 1, "% inverse"],
  ["Device trust", "deviceTrustScore", 1, "%"],
  ["Identity match", "identityConsistencyScore", 1, "%"],
] as const;

function formatRs(value: number) {
  return `Rs ${Math.round(value).toLocaleString("en-IN")}`;
}

function recommendationLabel(value: Recommendation) {
  return value === "DECLINE" ? "DECLINE" : value;
}

function scoreClass(value: Recommendation) {
  return value.toLowerCase();
}

function StatusIcon({ status }: { status: "PASS" | "REVIEW" | "FAIL" }) {
  if (status === "PASS") return <CheckCircle2 aria-hidden="true" />;
  if (status === "FAIL") return <XCircle aria-hidden="true" />;
  return <AlertTriangle aria-hidden="true" />;
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

export function UnderwritingWorkspace() {
  const [activeView, setActiveView] = useState<View>("decision");
  const [current, setCurrent] = useState(initialDecision);
  const [queue, setQueue] = useState(seedQueue);
  const [showExplanation, setShowExplanation] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [preset, setPreset] = useState<PresetKey>("borderline");
  const [form, setForm] = useState<AssessmentRequest>(PRESETS.borderline);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const auditEvents = useMemo(() => [
    { time: "09:42:00", event: "Decision created", actor: "Decision API", reference: current.decisionId },
    { time: "09:41:59", event: "Policy checks completed", actor: "Policy engine", reference: "POLICY-2026.08" },
    { time: "09:41:59", event: "Model inference completed", actor: "Credit model", reference: current.modelVersion },
    { time: "09:41:58", event: "Alternative-data consent verified", actor: "Consent service", reference: "CONSENT-VALID" },
    { time: "09:41:57", event: "Application received", actor: "Underwriter demo", reference: current.applicant.externalId },
  ], [current]);

  function choosePreset(key: PresetKey) {
    setPreset(key);
    setForm(structuredClone(PRESETS[key]));
    setError("");
  }

  function setApplicant<K extends keyof AssessmentRequest["applicant"]>(key: K, value: AssessmentRequest["applicant"][K]) {
    setForm((previous) => ({ ...previous, applicant: { ...previous.applicant, [key]: value } }));
  }

  function setSignal<K extends keyof AssessmentRequest["signals"]>(key: K, value: AssessmentRequest["signals"][K]) {
    setForm((previous) => ({ ...previous, signals: { ...previous.signals, [key]: value } }));
  }

  async function runAssessment(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/decisions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!response.ok) throw new Error("Assessment service returned an error");
      const decision = await response.json() as DecisionResponse;
      setCurrent(decision);
      setQueue((previous) => [decision, ...previous]);
      setShowForm(false);
      setShowExplanation(true);
      setActiveView("decision");
    } catch {
      const fallback = assessApplication(form);
      setCurrent(fallback);
      setQueue((previous) => [fallback, ...previous]);
      setShowForm(false);
      setShowExplanation(true);
      setActiveView("decision");
    } finally {
      setSubmitting(false);
    }
  }

  function openDecision(decision: DecisionResponse) {
    setCurrent(decision);
    setActiveView("decision");
    setShowExplanation(true);
  }

  return (
    <main className="workspace-shell">
      <aside className="sidebar" aria-label="Primary navigation">
        <button className="brand" type="button" onClick={() => setActiveView("decision")} aria-label="CredIntel AI home">
          <span className="brand-mark">CI</span>
          <span>CredIntel AI</span>
        </button>
        <nav>
          {navigation.map(({ id, label, icon: Icon }) => (
            <button
              className={`nav-item ${activeView === id ? "active" : ""}`}
              key={id}
              type="button"
              onClick={() => setActiveView(id)}
            >
              <Icon aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-context">
          <p>ACTIVE DEMO MODEL</p>
          <strong>credit-logit-1.0.0</strong>
          <span><span className="status-dot" /> All services healthy</span>
        </div>
        <div className="user-chip" aria-label="Signed in user">
          <span>VP</span>
          <div><strong>Demo underwriter</strong><small>Credit operations</small></div>
        </div>
      </aside>

      <section className="main-panel">
        <header className="global-bar">
          <div className="global-search"><Search aria-hidden="true" /><span>Search application ID</span><kbd>/</kbd></div>
          <div className="global-actions">
            <button className="icon-button" type="button" title="Notifications" aria-label="Notifications"><Bell aria-hidden="true" /></button>
            <span className="environment"><span /> SANDBOX</span>
          </div>
        </header>

        {activeView === "decision" && (
          <DecisionView
            decision={current}
            showExplanation={showExplanation}
            onToggleExplanation={() => setShowExplanation((value) => !value)}
            onNew={() => setShowForm(true)}
          />
        )}
        {activeView === "queue" && <QueueView queue={queue} onOpen={openDecision} />}
        {activeView === "monitoring" && <MonitoringView />}
        {activeView === "audit" && <AuditView events={auditEvents} />}
      </section>

      {showForm && (
        <div className="modal-backdrop" role="presentation">
          <section className="application-modal" role="dialog" aria-modal="true" aria-labelledby="new-application-title">
            <header>
              <div>
                <p className="eyebrow">REAL-TIME ASSESSMENT</p>
                <h2 id="new-application-title">New application</h2>
              </div>
              <button className="icon-button" type="button" title="Close" aria-label="Close new application" onClick={() => setShowForm(false)}><X aria-hidden="true" /></button>
            </header>

            <div className="preset-control" aria-label="Demo scenario">
              {(["strong", "borderline", "fraud"] as PresetKey[]).map((key) => (
                <button className={preset === key ? "selected" : ""} type="button" key={key} onClick={() => choosePreset(key)}>
                  {key === "strong" ? "Strong profile" : key === "borderline" ? "Borderline" : "Fraud signals"}
                </button>
              ))}
            </div>

            <form onSubmit={runAssessment}>
              <fieldset>
                <legend>Applicant and loan</legend>
                <label>Full name<input required value={form.applicant.fullName} onChange={(event) => setApplicant("fullName", event.target.value)} /></label>
                <label>Age<input required type="number" min="18" max="80" value={form.applicant.age} onChange={(event) => setApplicant("age", Number(event.target.value))} /></label>
                <label>Monthly income (Rs)<input required type="number" min="1000" value={form.applicant.monthlyIncome} onChange={(event) => setApplicant("monthlyIncome", Number(event.target.value))} /></label>
                <label>Requested amount (Rs)<input required type="number" min="1000" value={form.applicant.loanAmount} onChange={(event) => setApplicant("loanAmount", Number(event.target.value))} /></label>
                <label>Purpose<input required value={form.applicant.purpose} onChange={(event) => setApplicant("purpose", event.target.value)} /></label>
                <label>Tenure (months)<input required type="number" min="3" max="60" value={form.applicant.loanTenureMonths} onChange={(event) => setApplicant("loanTenureMonths", Number(event.target.value))} /></label>
              </fieldset>

              <fieldset>
                <legend>Behavioral signals</legend>
                <label>Income history (months)<input type="number" min="0" max="120" value={form.signals.incomeStabilityMonths} onChange={(event) => setSignal("incomeStabilityMonths", Number(event.target.value))} /></label>
                <label>Utility paid on time (%)<input type="number" min="0" max="100" value={Math.round(form.signals.utilityOnTimeRatio * 100)} onChange={(event) => setSignal("utilityOnTimeRatio", Number(event.target.value) / 100)} /></label>
                <label>Debt-to-income (%)<input type="number" min="0" max="100" value={Math.round(form.signals.debtToIncomeRatio * 100)} onChange={(event) => setSignal("debtToIncomeRatio", Number(event.target.value) / 100)} /></label>
                <label>Cash-flow volatility (%)<input type="number" min="0" max="100" value={Math.round(form.signals.cashflowVolatility * 100)} onChange={(event) => setSignal("cashflowVolatility", Number(event.target.value) / 100)} /></label>
                <label>Device trust (%)<input type="number" min="0" max="100" value={Math.round(form.signals.deviceTrustScore * 100)} onChange={(event) => setSignal("deviceTrustScore", Number(event.target.value) / 100)} /></label>
                <label>Identity consistency (%)<input type="number" min="0" max="100" value={Math.round(form.signals.identityConsistencyScore * 100)} onChange={(event) => setSignal("identityConsistencyScore", Number(event.target.value) / 100)} /></label>
              </fieldset>

              <div className="consent-row">
                <input id="alternative-data-consent" type="checkbox" checked={form.applicant.consentGranted} onChange={(event) => setApplicant("consentGranted", event.target.checked)} />
                <label htmlFor="alternative-data-consent"><strong>Alternative-data consent recorded</strong><small>Only purpose-limited signals are used. Protected attributes are excluded.</small></label>
              </div>
              {error && <p className="form-error">{error}</p>}
              <footer>
                <button className="text-button" type="button" onClick={() => setShowForm(false)}>Cancel</button>
                <button className="primary-button modal-submit" type="submit" disabled={submitting}>
                  <BrainCircuit aria-hidden="true" /> {submitting ? "Assessing..." : "Run assessment"}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}

function PageHeading({ eyebrow, title, copy, action }: { eyebrow: string; title: string; copy: string; action?: React.ReactNode }) {
  return (
    <header className="page-heading">
      <div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{copy}</p></div>
      {action}
    </header>
  );
}

function DecisionView({ decision, showExplanation, onToggleExplanation, onNew }: {
  decision: DecisionResponse;
  showExplanation: boolean;
  onToggleExplanation: () => void;
  onNew: () => void;
}) {
  const { applicant, signals } = decision;
  return (
    <div className="view-wrap">
      <PageHeading
        eyebrow={`UNDERWRITING / ${decision.decisionId}`}
        title="Decision workspace"
        copy="Evidence, policy checks, and model reasoning in one reviewable record."
        action={<button className="primary-button compact" type="button" onClick={onNew}><Plus aria-hidden="true" /> New application</button>}
      />

      <div className="decision-grid">
        <section className="applicant-panel" aria-labelledby="applicant-title">
          <div className="section-heading">
            <div><p className="eyebrow">APPLICANT</p><h2 id="applicant-title">{applicant.fullName}</h2><span className="sub-id">{applicant.externalId}</span></div>
            <span className="thin-file"><Users aria-hidden="true" /> New to credit</span>
          </div>
          <dl className="facts">
            <div><dt>Requested</dt><dd>{formatRs(applicant.loanAmount)}</dd></div>
            <div><dt>Purpose</dt><dd>{applicant.purpose}</dd></div>
            <div><dt>Monthly income</dt><dd>{formatRs(applicant.monthlyIncome)}</dd></div>
            <div><dt>Income history</dt><dd>{signals.incomeStabilityMonths} months</dd></div>
          </dl>

          <div className="subsection-title"><h3>Alternative-data signals</h3><span>Consent verified</span></div>
          <div className="signal-list">
            {signalDefinitions.map(([label, key, max, unit]) => {
              const raw = signals[key];
              const inverse = unit.includes("inverse");
              const width = Math.round((inverse ? 1 - raw : Math.min(raw / max, 1)) * 100);
              const display = unit === "months" ? `${Math.round(raw)} mo` : `${Math.round(raw * 100)}%`;
              return (
                <div className="signal-row" key={key}>
                  <span>{label}</span>
                  <div className="signal-track" aria-label={`${label}: ${display}`}><i style={{ width: `${width}%` }} /></div>
                  <strong>{display}</strong>
                </div>
              );
            })}
          </div>
          <div className="data-provenance"><Database aria-hidden="true" /><p><strong>Data provenance</strong><span>Banking aggregates, consented utility history, device-risk metadata. No contact content or protected traits.</span></p></div>
        </section>

        <section className={`decision-panel ${scoreClass(decision.recommendation)}`} aria-labelledby="decision-title">
          <div className="decision-meta"><span>RECOMMENDATION</span><span><Clock3 aria-hidden="true" /> {decision.processingTimeMs} ms</span></div>
          <div className="decision-word" id="decision-title">{recommendationLabel(decision.recommendation)}</div>
          <p className="decision-copy">{decision.summary}</p>

          <div className="score-row">
            <div><span>Repayment confidence</span><strong>{decision.creditConfidence}</strong><small>/100</small></div>
            <div><span>Fraud risk</span><strong>{decision.fraudRisk}</strong><small>/100</small></div>
          </div>

          <div className="reason-block">
            <p>Top reason codes</p>
            <ol>
              {decision.reasonCodes.slice(0, 3).map((reason) => <li key={reason.code}><span>{reason.label}</span><strong className={reason.direction.toLowerCase()}>{reason.impact > 0 ? "+" : ""}{reason.impact}</strong></li>)}
            </ol>
          </div>

          <button className="primary-button explanation-button" type="button" onClick={onToggleExplanation}>
            <FileText aria-hidden="true" /> {showExplanation ? "Hide full explanation" : "Open full explanation"}
          </button>
          <p className="human-note"><UserCheck aria-hidden="true" /> A human owns the final lending decision.</p>
        </section>
      </div>

      {showExplanation && (
        <section className="explanation-section" aria-labelledby="explanation-title">
          <div className="explanation-heading"><div><p className="eyebrow">EXPLAINABILITY RECORD</p><h2 id="explanation-title">Why this recommendation was produced</h2></div><span><ShieldCheck aria-hidden="true" /> Guardrailed narrative</span></div>
          <div className="explanation-columns">
            <div>
              <h3>Feature contributions</h3>
              {decision.reasonCodes.map((reason) => (
                <div className="contribution" key={reason.code}>
                  <div><span>{reason.label}</span><small>{reason.evidence}</small></div>
                  <div className="impact-track"><i className={reason.direction.toLowerCase()} style={{ width: `${Math.min(Math.abs(reason.impact) * 2.2, 100)}%` }} /></div>
                  <strong>{reason.impact > 0 ? "+" : ""}{reason.impact}</strong>
                </div>
              ))}
            </div>
            <div>
              <h3>Policy checks</h3>
              <div className="policy-list">
                {decision.policyChecks.map((check) => (
                  <div className={`policy-row ${check.status.toLowerCase()}`} key={check.code}>
                    <StatusIcon status={check.status} />
                    <p><strong>{check.label}</strong><span>{check.detail}</span></p>
                    <b>{check.status}</b>
                  </div>
                ))}
              </div>
              <div className="ai-boundary"><LockKeyhole aria-hidden="true" /><p><strong>Responsible AI boundary</strong><span>The language model may summarize approved reason codes, but it cannot alter scores, policy checks, or the recommendation.</span></p></div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function QueueView({ queue, onOpen }: { queue: DecisionResponse[]; onOpen: (decision: DecisionResponse) => void }) {
  return (
    <div className="view-wrap">
      <PageHeading eyebrow="OPERATIONS" title="Review queue" copy="Prioritized cases that need a human decision or verification." action={<button className="secondary-button compact" type="button"><SlidersHorizontal aria-hidden="true" /> Filters</button>} />
      <div className="queue-summary">
        <Metric label="Awaiting review" value={String(queue.filter((item) => item.recommendation === "REVIEW").length)} detail="Within 15-minute SLA" />
        <Metric label="High fraud risk" value={String(queue.filter((item) => item.fraudRisk >= 65).length)} detail="Identity verification required" />
        <Metric label="Processed today" value="148" detail="67% straight-through" />
        <Metric label="Median latency" value="138 ms" detail="Target below 250 ms" />
      </div>
      <section className="table-section" aria-labelledby="queue-title">
        <div className="table-heading"><div><h2 id="queue-title">Applications</h2><p>Most recent decisions first</p></div><span>LIVE</span></div>
        <div className="table-scroll">
          <table>
            <thead><tr><th>Application</th><th>Applicant</th><th>Requested</th><th>Credit</th><th>Fraud</th><th>Recommendation</th><th><span className="sr-only">Open</span></th></tr></thead>
            <tbody>
              {queue.map((decision) => (
                <tr key={`${decision.decisionId}-${decision.createdAt}`}>
                  <td><strong>{decision.decisionId}</strong><small>{new Date(decision.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</small></td>
                  <td><strong>{decision.applicant.fullName}</strong><small>{decision.applicant.externalId}</small></td>
                  <td>{formatRs(decision.applicant.loanAmount)}</td>
                  <td><span className="numeric-score">{decision.creditConfidence}</span></td>
                  <td><span className={`numeric-score ${decision.fraudRisk >= 65 ? "risk" : ""}`}>{decision.fraudRisk}</span></td>
                  <td><span className={`decision-badge ${scoreClass(decision.recommendation)}`}>{decision.recommendation}</span></td>
                  <td><button className="icon-button" type="button" title="Open decision" aria-label={`Open ${decision.decisionId}`} onClick={() => onOpen(decision)}><ChevronRight aria-hidden="true" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function MonitoringView() {
  const drift = [
    ["Income stability", 18, "Stable"],
    ["Utility on-time ratio", 31, "Watch"],
    ["Debt-to-income", 22, "Stable"],
    ["Device trust", 14, "Stable"],
    ["Identity consistency", 9, "Stable"],
  ] as const;
  return (
    <div className="view-wrap">
      <PageHeading eyebrow="MODEL GOVERNANCE" title="Model monitoring" copy="Performance, fairness, drift, and operational health for the active model." action={<span className="as-of"><Clock3 aria-hidden="true" /> Updated 2 min ago</span>} />
      <div className="monitor-hero">
        <div><p>ACTIVE MODEL</p><h2>credit-logit-1.0.0</h2><span><CheckCircle2 aria-hidden="true" /> Within all operating thresholds</span></div>
        <div className="model-meta"><span>Deployed<strong>20 Aug 2026</strong></span><span>Validation set<strong>2,000 profiles</strong></span><span>Owner<strong>Credit Risk</strong></span></div>
      </div>
      <div className="queue-summary monitoring-metrics">
        <Metric label="ROC-AUC" value="0.83" detail="Threshold >= 0.75" />
        <Metric label="Precision / recall" value="0.60 / 0.60" detail="At validation threshold" />
        <Metric label="Equal opportunity gap" value="0.02" detail="Threshold <= 0.08" />
        <Metric label="Population stability" value="0.06" detail="Threshold <= 0.10" />
      </div>
      <div className="monitor-grid">
        <section className="drift-section">
          <div className="table-heading"><div><h2>Feature drift</h2><p>Population stability contribution</p></div><CircleGauge aria-hidden="true" /></div>
          {drift.map(([name, value, status]) => (
            <div className="drift-row" key={name}><span>{name}</span><div><i style={{ width: `${value}%` }} /></div><strong>0.{String(value).padStart(2, "0")}</strong><small className={status === "Watch" ? "watch" : ""}>{status}</small></div>
          ))}
        </section>
        <section className="governance-section">
          <div className="table-heading"><div><h2>Governance controls</h2><p>Release gate evidence</p></div><ShieldCheck aria-hidden="true" /></div>
          {[
            ["Protected traits excluded", "gender, caste, religion"],
            ["Human override available", "reason required and audited"],
            ["Explanation fidelity", "reason codes tied to contributions"],
            ["Champion/challenger", "shadow model comparison enabled"],
          ].map(([title, detail]) => <div className="control-row" key={title}><Check aria-hidden="true" /><p><strong>{title}</strong><span>{detail}</span></p></div>)}
        </section>
      </div>
      <div className="model-card-strip"><FileCheck2 aria-hidden="true" /><p><strong>Model card available</strong><span>Training assumptions, intended use, limitations, subgroup evaluation, and rollback criteria are versioned with the model artifact.</span></p><button type="button">View model card <ChevronRight aria-hidden="true" /></button></div>
    </div>
  );
}

function AuditView({ events }: { events: Array<{ time: string; event: string; actor: string; reference: string }> }) {
  return (
    <div className="view-wrap">
      <PageHeading eyebrow="COMPLIANCE" title="Audit trail" copy="Immutable evidence for every data, model, policy, and human action." action={<button className="secondary-button compact" type="button"><FileText aria-hidden="true" /> Export record</button>} />
      <div className="audit-banner"><LockKeyhole aria-hidden="true" /><p><strong>Tamper-evident event chain</strong><span>Each event stores a timestamp, actor, version reference, and hash of the previous event.</span></p><span>CHAIN VERIFIED</span></div>
      <section className="timeline" aria-label="Decision audit events">
        {events.map((event, index) => (
          <div className="timeline-row" key={`${event.time}-${event.event}`}>
            <div className="timeline-marker"><span>{index + 1}</span></div>
            <time>{event.time}<small>20 Aug 2026</small></time>
            <div><strong>{event.event}</strong><span>{event.actor}</span></div>
            <code>{event.reference}</code>
            <span className="verified"><Check aria-hidden="true" /> Verified</span>
          </div>
        ))}
      </section>
      <div className="audit-details">
        <div><Database aria-hidden="true" /><p><strong>Retention</strong><span>Decision records retained according to configured lending policy.</span></p></div>
        <div><LockKeyhole aria-hidden="true" /><p><strong>PII minimization</strong><span>Logs use pseudonymous applicant references and exclude raw behavioral data.</span></p></div>
        <div><ShieldCheck aria-hidden="true" /><p><strong>Access control</strong><span>Role-based access is enforced in production; demo mode is clearly labeled.</span></p></div>
      </div>
    </div>
  );
}
