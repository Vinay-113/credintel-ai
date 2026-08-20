export async function GET() {
  return Response.json({
    modelVersion: "credit-logit-1.0.0",
    trainedOn: "8,000 synthetic, privacy-safe applicant profiles",
    validation: {
      rocAuc: 0.8344,
      precision: 0.5959,
      recall: 0.6008,
      equalOpportunityGap: 0.0166,
      populationStabilityIndex: 0.06,
    },
    exclusions: ["gender", "religion", "caste", "precise location", "contact-list contents"],
    decisionOwner: "Human underwriter",
  });
}
