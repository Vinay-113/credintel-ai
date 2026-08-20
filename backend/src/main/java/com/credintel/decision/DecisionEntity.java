package com.credintel.decision;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "decisions")
public class DecisionEntity {
    @Id
    @Column(length = 36, nullable = false)
    private String id;

    @Column(name = "applicant_hash", length = 64, nullable = false)
    private String applicantHash;

    @Column(name = "applicant_name", length = 120, nullable = false)
    private String applicantName;

    @Column(name = "requested_amount", precision = 14, scale = 2, nullable = false)
    private BigDecimal requestedAmount;

    @Column(length = 16, nullable = false)
    private String recommendation;

    @Column(name = "credit_confidence", nullable = false)
    private int creditConfidence;

    @Column(name = "fraud_risk", nullable = false)
    private int fraudRisk;

    @Column(name = "model_version", length = 64, nullable = false)
    private String modelVersion;

    @Column(name = "processing_time_ms", nullable = false)
    private long processingTimeMs;

    @Column(name = "response_json", columnDefinition = "TEXT", nullable = false)
    private String responseJson;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected DecisionEntity() {
    }

    public DecisionEntity(String id, String applicantHash, String applicantName, BigDecimal requestedAmount,
                          String recommendation, int creditConfidence, int fraudRisk, String modelVersion,
                          long processingTimeMs, String responseJson, Instant createdAt) {
        this.id = id;
        this.applicantHash = applicantHash;
        this.applicantName = applicantName;
        this.requestedAmount = requestedAmount;
        this.recommendation = recommendation;
        this.creditConfidence = creditConfidence;
        this.fraudRisk = fraudRisk;
        this.modelVersion = modelVersion;
        this.processingTimeMs = processingTimeMs;
        this.responseJson = responseJson;
        this.createdAt = createdAt;
    }

    public String getId() { return id; }
    public String getApplicantHash() { return applicantHash; }
    public String getApplicantName() { return applicantName; }
    public BigDecimal getRequestedAmount() { return requestedAmount; }
    public String getRecommendation() { return recommendation; }
    public int getCreditConfidence() { return creditConfidence; }
    public int getFraudRisk() { return fraudRisk; }
    public String getModelVersion() { return modelVersion; }
    public long getProcessingTimeMs() { return processingTimeMs; }
    public String getResponseJson() { return responseJson; }
    public Instant getCreatedAt() { return createdAt; }
}
