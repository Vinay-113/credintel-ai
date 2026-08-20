CREATE TABLE decisions (
    id VARCHAR(36) PRIMARY KEY,
    applicant_hash VARCHAR(64) NOT NULL,
    applicant_name VARCHAR(120) NOT NULL,
    requested_amount DECIMAL(14, 2) NOT NULL,
    recommendation VARCHAR(16) NOT NULL,
    credit_confidence INTEGER NOT NULL,
    fraud_risk INTEGER NOT NULL,
    model_version VARCHAR(64) NOT NULL,
    processing_time_ms BIGINT NOT NULL,
    response_json TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX idx_decisions_created_at ON decisions (created_at DESC);
CREATE INDEX idx_decisions_recommendation ON decisions (recommendation);
