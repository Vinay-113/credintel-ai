# Data strategy

## Default: privacy-safe synthetic data

`ml/train_model.py` generates the runnable baseline. It is deterministic, requires no credentials, contains no real people, and exercises training, validation, fairness, model export, and model-card workflows.

Use this wording in the presentation:

> The prototype uses public anonymized datasets and simulated behavioral signals to demonstrate architecture without exposing real customer data. It does not join unrelated records or claim production validity.

## Public credit-risk data

**Home Credit - Credit Risk Model Stability**

- Page: https://www.kaggle.com/competitions/home-credit-credit-risk-model-stability
- Why: specifically addresses default prediction for applicants with little or no credit history and evaluates stability over time.
- Access: Kaggle account and acceptance of the competition rules are required.

**Home Credit Default Risk**

- Data: https://www.kaggle.com/competitions/home-credit-default-risk/data
- Why: application, bureau, prior-loan, installment, and balance tables support alternative-data feature engineering.
- Adapter: `ml/import_home_credit.py` maps selected aggregates into the model contract.

## Public fraud data

**Bank Account Fraud Dataset Suite (NeurIPS 2022)**

- Paper: https://proceedings.neurips.cc/paper_files/paper/2022/hash/d9696563856bd350e4e7ac5e5812f23c-Abstract-Datasets_and_Benchmarks.html
- Why: privacy-preserving, large-scale tabular data with imbalance, temporal dynamics, and bias variants.
- Use: learn fraud feature distributions or benchmark a separate fraud model. Do not join its rows to Home Credit applicants.

## Responsible integration rule

Keep credit and fraud datasets separate. Train/evaluate each component on its own source, then generate clearly labeled synthetic end-to-end demo records. Never imply that unrelated public rows describe the same customer.

## Regulatory design references

- RBI digital-lending guidance emphasizes need-based collection, prior explicit consent, borrower choice, audit trails, and data minimization: https://www.rbi.org.in/scripts/NotificationUser.aspx?Id=12382&Mode=0
- CFPB Circular 2022-03 states that complex credit models must still support specific principal reasons for adverse action: https://www.consumerfinance.gov/compliance/circulars/circular-2022-03-adverse-action-notification-requirements-in-connection-with-credit-decisions-based-on-complex-algorithms/

These references inform prototype controls; they are not a legal-compliance determination.
