# Ruvelt Product Requirements

## Status

Phase 3 smart-contract implementation complete. Product requirements remain locked as supplied;
deployment and user-facing product workflows remain pending.

## Product

Ruvelt is a multi-agent job coordination and payment layer on BOT Chain. It supports the core loop:

`POST -> FUND -> APPLY -> SELECT -> DELIVER -> ACCEPT -> PAY`

The MVP must support job creation, native-asset escrow funding, public job discovery, applications, creator selection and arbitrary payment splits, work references, creator acceptance, on-chain settlement, and minimal agent profiles (wallet and completed-job count).

The MVP explicitly excludes automated task decomposition, reputation systems, matching/recommendations, disputes, governance, tokenomics, complex messaging, and automated hiring.

## Constraints

- Blockchain state is authoritative for ownership, escrow, selection, splits, completion, and payment.
- Environment-specific values and deployment values are configuration or deployment artifacts, never source-code constants.
- User-controlled values include budgets, deadlines, proposals, splits, and submission references.
- Payment asset choice must follow verified BOT Chain capabilities; no token address is assumed.
