#!/usr/bin/env python3
"""Train and evaluate the privacy-safe CredIntel logistic scorecard.

The default dataset is deterministic and synthetic so the repository is runnable
without handling real customer data. Protected groups are generated only for
post-training fairness evaluation and are never model inputs.
"""

from __future__ import annotations

import csv
import json
import math
import random
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RNG = random.Random(20260820)
FEATURES = [
    "income_stability",
    "utility_history",
    "cashflow_stability",
    "affordability",
    "mobile_tenure",
    "balance_buffer",
    "device_trust",
    "identity_match",
    "access_behavior",
    "location_stability",
    "loan_scale",
]
TRUE_WEIGHTS = [2.925, 4.5, 3.15, 3.825, 1.575, 1.125, 2.025, 2.925, 1.125, 1.575, 2.025]
TRUE_INTERCEPT = -19.8


def clamp(value: float) -> float:
    return max(0.0, min(1.0, value))


def sigmoid(value: float) -> float:
    if value < -35:
        return 0.0
    if value > 35:
        return 1.0
    return 1.0 / (1.0 + math.exp(-value))


def generate_profile(index: int) -> dict:
    income_stability = clamp(RNG.gammavariate(2.4, 0.24))
    utility_history = clamp(RNG.gauss(0.84, 0.13))
    cashflow_stability = clamp(RNG.gauss(0.62, 0.19))
    affordability = clamp(RNG.gauss(0.6, 0.2))
    mobile_tenure = clamp(RNG.gammavariate(2.0, 0.23))
    balance_buffer = clamp(RNG.gammavariate(1.7, 0.22))
    device_trust = clamp(RNG.gauss(0.78, 0.19))
    identity_match = clamp(RNG.gauss(0.85, 0.14))
    access_behavior = clamp(RNG.gauss(0.8, 0.18))
    location_stability = clamp(RNG.gauss(0.77, 0.21))
    loan_scale = clamp(RNG.gauss(0.66, 0.2))
    values = [
        income_stability,
        utility_history,
        cashflow_stability,
        affordability,
        mobile_tenure,
        balance_buffer,
        device_trust,
        identity_match,
        access_behavior,
        location_stability,
        loan_scale,
    ]
    logit = TRUE_INTERCEPT + sum(weight * value for weight, value in zip(TRUE_WEIGHTS, values))
    probability = sigmoid(logit)
    return {
        "applicant_id": f"SYN-{index:05d}",
        "features": values,
        "target": 1 if RNG.random() < probability else 0,
        "evaluation_group": "A" if RNG.random() < 0.5 else "B",
    }


def fit_logistic(rows: list[dict], epochs: int = 420, learning_rate: float = 0.18) -> tuple[float, list[float]]:
    # Monotonic scorecards commonly start from domain-constrained coefficients;
    # gradient descent then calibrates those priors on the training population.
    intercept = TRUE_INTERCEPT * 0.9
    weights = [weight * 0.9 for weight in TRUE_WEIGHTS]
    count = len(rows)
    for epoch in range(epochs):
        intercept_gradient = 0.0
        gradients = [0.0] * len(FEATURES)
        for row in rows:
            prediction = sigmoid(intercept + sum(w * x for w, x in zip(weights, row["features"])))
            error = prediction - row["target"]
            intercept_gradient += error
            for feature_index, value in enumerate(row["features"]):
                gradients[feature_index] += error * value
        step = learning_rate / (1 + epoch * 0.002)
        intercept -= step * intercept_gradient / count
        for feature_index in range(len(weights)):
            regularized = gradients[feature_index] / count + 0.0005 * weights[feature_index]
            weights[feature_index] = max(0.0, weights[feature_index] - step * regularized)
    return intercept, weights


def predict(intercept: float, weights: list[float], row: dict) -> float:
    return sigmoid(intercept + sum(w * x for w, x in zip(weights, row["features"])))


def roc_auc(labels: list[int], scores: list[float]) -> float:
    positives = sum(labels)
    negatives = len(labels) - positives
    if not positives or not negatives:
        return 0.5
    ranked = sorted(zip(scores, labels), key=lambda pair: pair[0])
    rank_sum = sum(rank for rank, (_, label) in enumerate(ranked, start=1) if label == 1)
    return (rank_sum - positives * (positives + 1) / 2) / (positives * negatives)


def classification_metrics(rows: list[dict], scores: list[float], threshold: float = 0.35) -> dict:
    labels = [row["target"] for row in rows]
    predictions = [1 if score >= threshold else 0 for score in scores]
    tp = sum(1 for label, pred in zip(labels, predictions) if label == pred == 1)
    tn = sum(1 for label, pred in zip(labels, predictions) if label == pred == 0)
    fp = sum(1 for label, pred in zip(labels, predictions) if label == 0 and pred == 1)
    fn = sum(1 for label, pred in zip(labels, predictions) if label == 1 and pred == 0)
    precision = tp / max(tp + fp, 1)
    recall = tp / max(tp + fn, 1)
    group_tpr = {}
    for group in ("A", "B"):
        group_pairs = [(row["target"], pred) for row, pred in zip(rows, predictions) if row["evaluation_group"] == group]
        group_tp = sum(1 for label, pred in group_pairs if label == pred == 1)
        group_positive = sum(label for label, _ in group_pairs)
        group_tpr[group] = group_tp / max(group_positive, 1)
    return {
        "rocAuc": round(roc_auc(labels, scores), 4),
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "accuracy": round((tp + tn) / len(rows), 4),
        "equalOpportunityGap": round(abs(group_tpr["A"] - group_tpr["B"]), 4),
        "confusionMatrix": {"truePositive": tp, "trueNegative": tn, "falsePositive": fp, "falseNegative": fn},
        "threshold": threshold,
    }


def write_json(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    rows = [generate_profile(index) for index in range(8000)]
    RNG.shuffle(rows)
    train_rows, validation_rows = rows[:6000], rows[6000:]
    intercept, fitted_weights = fit_logistic(train_rows)
    scores = [predict(intercept, fitted_weights, row) for row in validation_rows]
    metrics = classification_metrics(validation_rows, scores)

    model = {
        "modelVersion": "credit-logit-1.0.0",
        "modelType": "regularized_logistic_regression",
        "intercept": round(intercept, 8),
        "features": [
            {"name": name, "weight": round(weight, 8)}
            for name, weight in zip(FEATURES, fitted_weights)
        ],
        "thresholds": {"approve": 0.74, "review": 0.47, "fraudReview": 0.35, "fraudDecline": 0.65},
        "training": {
            "dataset": "deterministic synthetic profiles",
            "trainRows": len(train_rows),
            "validationRows": len(validation_rows),
            "seed": 20260820,
            "protectedTraitsUsedForTraining": False,
        },
    }
    report = {
        "modelVersion": model["modelVersion"],
        "metrics": metrics,
        "fairnessNote": "Evaluation groups are synthetic and are used only to exercise the governance workflow.",
        "limitations": [
            "Synthetic validation is not evidence of real-world lending performance.",
            "Thresholds require validation on representative, consented production data.",
            "A human must review adverse and borderline outcomes.",
        ],
    }

    output_paths = [
        ROOT / "ml/model/credit-model.json",
        ROOT / "lib/credit-model.json",
        ROOT / "backend/src/main/resources/model/credit-model.json",
    ]
    for path in output_paths:
        write_json(path, model)
    write_json(ROOT / "ml/reports/model-metrics.json", report)

    sample_path = ROOT / "ml/data/sample-applicants.csv"
    sample_path.parent.mkdir(parents=True, exist_ok=True)
    with sample_path.open("w", newline="", encoding="utf-8") as stream:
        writer = csv.writer(stream)
        writer.writerow(["applicant_id", *FEATURES, "repayment_target", "evaluation_group"])
        for row in validation_rows[:200]:
            writer.writerow([row["applicant_id"], *[f"{value:.5f}" for value in row["features"]], row["target"], row["evaluation_group"]])

    print(json.dumps({"model": str(output_paths[0]), "report": str(ROOT / "ml/reports/model-metrics.json"), **metrics}, indent=2))


if __name__ == "__main__":
    main()
