#!/usr/bin/env python3
"""Map selected Home Credit columns to the CredIntel feature contract.

Usage: python3 ml/import_home_credit.py /path/to/application_train.csv output.csv
Only aggregate, purpose-limited fields are mapped. No names or contact content
are copied into the output.
"""

from __future__ import annotations

import csv
import sys
from pathlib import Path


def clamp(value: float) -> float:
    return max(0.0, min(1.0, value))


def number(row: dict, key: str, default: float = 0.0) -> float:
    try:
        return float(row.get(key) or default)
    except ValueError:
        return default


def transform(row: dict) -> dict:
    income = max(number(row, "AMT_INCOME_TOTAL", 1), 1)
    credit = number(row, "AMT_CREDIT")
    annuity = number(row, "AMT_ANNUITY")
    employed_days = abs(number(row, "DAYS_EMPLOYED"))
    registration_days = abs(number(row, "DAYS_REGISTRATION"))
    external_scores = [number(row, name, 0.5) for name in ("EXT_SOURCE_1", "EXT_SOURCE_2", "EXT_SOURCE_3")]
    return {
        "applicant_id": f"HC-{row.get('SK_ID_CURR', 'UNKNOWN')}",
        "income_stability": clamp(employed_days / (365 * 5)),
        "utility_history": clamp(sum(external_scores) / len(external_scores)),
        "cashflow_stability": clamp(1 - annuity / income),
        "affordability": clamp(1 - annuity / income),
        "mobile_tenure": clamp(registration_days / (365 * 5)),
        "balance_buffer": clamp(income / 500000),
        "device_trust": 0.75,
        "identity_match": 0.8,
        "access_behavior": 0.8,
        "location_stability": 0.75,
        "loan_scale": clamp(1 - credit / income),
        "repayment_target": 1 - int(number(row, "TARGET")),
    }


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("Usage: import_home_credit.py INPUT_CSV OUTPUT_CSV")
    input_path, output_path = Path(sys.argv[1]), Path(sys.argv[2])
    with input_path.open(newline="", encoding="utf-8-sig") as source, output_path.open("w", newline="", encoding="utf-8") as destination:
        reader = csv.DictReader(source)
        first = transform(next(reader))
        writer = csv.DictWriter(destination, fieldnames=list(first))
        writer.writeheader()
        writer.writerow(first)
        for row in reader:
            writer.writerow(transform(row))
    print(f"Wrote privacy-minimized features to {output_path}")


if __name__ == "__main__":
    main()
