# Ruvelt Architecture

## Foundation

Ruvelt uses an npm workspace for TypeScript packages and applications, plus an independent Foundry workspace for Solidity contracts.

- `apps/web`: React 19 and Vite browser application.
- `packages/config`: shared parsing and validation for browser-safe BOT Chain configuration.
- `contracts`: Solidity sources, tests, and deployment scripts managed by Foundry.

## Authority Boundary

BOT Chain contract state will be authoritative for job ownership, escrow, applications, contributor selection, payment splits, delivery acceptance, settlement, and completed-job counts. The web client and any later indexer are presentation and query layers, not alternative sources of truth.

## Configuration Boundary

Network identifiers, RPC URLs, explorer URLs, deployed addresses, and deployment credentials are environment or deployment artifacts. Browser-exposed variables use the `VITE_` prefix. Secrets, especially private keys, must never use that prefix.

## Phase Boundary

Phase 1 contains no protocol behavior. Contract boundaries, state transitions, authorization, escrow invariants, and settlement rules belong to the Phase 2 design.

The approved Phase 2 design is documented in `smart-contract-design.md`. Phase 3 implementation in
`contracts/src/RuveltJobs.sol` conforms to it and is covered by the Foundry contract suite.
Deployment remains gated on authoritative target-network verification.
