import assert from "node:assert/strict";
import test from "node:test";

const workerUrl = new URL("../dist/server/index.js", import.meta.url);
workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
const { default: worker } = await import(workerUrl.href);

function request(path = "/", init = {}) {
  return worker.fetch(
    new Request(`http://localhost${path}`, init),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the underwriting workspace", async () => {
  const response = await request();
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /CredIntel AI/);
  assert.match(html, /Decision workspace/);
  assert.match(html, /Alternative-data signals/);
  assert.doesNotMatch(html, /react-loading-skeleton|Your site is taking shape/i);
});

test("publishes model governance metadata", async () => {
  const response = await request("/api/model");
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.modelVersion, "credit-logit-1.0.0");
  assert.equal(payload.validation.rocAuc, 0.8344);
  assert.ok(payload.exclusions.includes("caste"));
});

test("returns an explainable decision for a valid profile", async () => {
  const response = await request("/api/decisions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      applicant: {
        externalId: "TEST-001",
        fullName: "Test Applicant",
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
    }),
  });
  assert.equal(response.status, 201);
  const decision = await response.json();
  assert.equal(decision.recommendation, "APPROVE");
  assert.equal(decision.reasonCodes.length, 5);
  assert.equal(decision.modelVersion, "credit-logit-1.0.0");
});

test("rejects incomplete assessment payloads", async () => {
  const response = await request("/api/decisions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ applicant: {} }),
  });
  assert.equal(response.status, 400);
});

test("prioritizes decision-driving fraud evidence in decline reasons", async () => {
  const response = await request("/api/decisions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      applicant: {
        externalId: "TEST-FRAUD",
        fullName: "Fraud Signal Test",
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
    }),
  });
  assert.equal(response.status, 201);
  const decision = await response.json();
  assert.equal(decision.recommendation, "DECLINE");
  assert.equal(decision.reasonCodes[0].direction, "NEGATIVE");
  assert.match(decision.reasonCodes[0].code, /^FRAUD_/);
});
