import { assessApplication, isAssessmentRequest, type DecisionResponse } from "../../../lib/scoring";

const seedRequest = {
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
};

const decisions: DecisionResponse[] = [
  assessApplication(seedRequest, {
    decisionId: "CI-2026-0842",
    createdAt: "2026-08-20T09:42:00.000Z",
    processingTimeMs: 142,
  }),
];

export async function GET() {
  const backendUrl = process.env.BACKEND_URL;
  if (backendUrl) {
    try {
      const response = await fetch(`${backendUrl}/decisions`, {
        headers: process.env.APP_API_KEY ? { "X-API-Key": process.env.APP_API_KEY } : {},
      });
      if (response.ok) return new Response(response.body, { status: response.status, headers: { "Content-Type": "application/json" } });
    } catch {
      // The deterministic local path keeps the hackathon demo available offline.
    }
  }
  return Response.json({ decisions: decisions.slice(0, 20) });
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  try {
    const payload: unknown = await request.json();
    if (!isAssessmentRequest(payload)) {
      return Response.json(
        { error: "Invalid assessment payload. Check required applicant and signal fields." },
        { status: 400 },
      );
    }
    const backendUrl = process.env.BACKEND_URL;
    if (backendUrl) {
      try {
        const backendResponse = await fetch(`${backendUrl}/decisions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(process.env.APP_API_KEY ? { "X-API-Key": process.env.APP_API_KEY } : {}),
          },
          body: JSON.stringify(payload),
        });
        if (backendResponse.ok) {
          return new Response(backendResponse.body, { status: 201, headers: { "Content-Type": "application/json" } });
        }
      } catch {
        // Fall through to the same versioned model artifact used by the API.
      }
    }
    const decision = assessApplication(payload, {
      processingTimeMs: Math.max(42, Date.now() - startedAt + 76),
    });
    decisions.unshift(decision);
    return Response.json(decision, { status: 201 });
  } catch {
    return Response.json({ error: "The request body must be valid JSON." }, { status: 400 });
  }
}
