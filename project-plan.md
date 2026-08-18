# Ruvelt Project Plan

## Phase Status

| Phase                                  | Status       |
| -------------------------------------- | ------------ |
| 0. Repository & environment audit      | **Complete** |
| 1. Project foundation                  | **Complete** |
| 2. Smart contract design               | **Complete** |
| 3. Smart contract implementation       | **Complete** |
| 4. Testnet deployment preparation      | **Complete** |
| 5. Web deployment dashboard            | **Complete** |
| 6. Browser wallet connectivity         | **Complete** |
| 7. Funded job creation workflow        | **Complete** |
| 8. Job discovery and applications      | **Complete** |
| 9. Creator review and selection        | **Complete** |
| 10. Delivery and settlement            | **Complete** |
| 11. Profiles and earnings              | **Complete** |
| 12. Workflow hardening                 | **Complete** |
| 13. Production bundle optimization     | **Complete** |
| 14. Testnet smoke and release QA       | **Complete** |
| 15. Reproducible release gate          | **Complete** |
| 16. Production web smoke               | **Complete** |
| 17. Frontend workflow cleanup          | **Complete** |
| 18. Configuration and deployment audit | **Complete** |
| 19. Final release audit                | **Complete** |
| 20. Post-release handoff               | **Complete** |

## Completed Work

- Audited the empty repository and verified the EVM development toolchain.
- Confirmed the repository initially contained no Git metadata, source, contracts, frontend,
  backend, package manifest, tests, or environment files.
- Confirmed there was initially no wallet integration, deployment setup, or reusable application
  architecture.
- Located and reviewed official BOT Chain developer documentation.
- Created an npm workspace with a React, TypeScript, and Vite web application.
- Created a Foundry workspace for Solidity contracts, tests, and deployment scripts.
- Added shared, fail-fast BOT Chain environment validation with automated tests.
- Added pinned dependencies, a lockfile, formatting, type-checking, testing, and production build commands.
- Added `.env.example`, repository ignore rules, setup documentation, and browser-secret guidance.
- Verified `npm run check` and `npm run build` successfully.
- Approved the smart-contract lifecycle, authorization model, escrow accounting, cancellation and
  settlement rules, contributor limit, review-period bounds, and selection window.
- Implemented the `RuveltJobs` contract with job creation, funding, applications, selection,
  delivery, cancellation, settlement, claim accounting, completion counts, and protected
  withdrawals.
- Added 20 Foundry tests covering lifecycle transitions, authorization, exact deadline boundaries,
  approved limits, accounting, failed transfers, and withdrawal reentrancy.
- Configured the Git remote `origin` as `https://github.com/uyscuttyy/Ruvelt.git`.

## Remaining Work

Phases 0 through 3 are complete. The contract is implemented and locally verified against the
approved design.

## Current Blockers

- Full wallet transaction flows still need to be implemented in the web client.

## Phase 4 Result

`RuveltJobs` was deployed to BOT Chain Testnet at
`0xf13ad20A3e912978Ab683b95AAdD9832d008ae0c`. The receipt succeeded in block `20131930`, and
post-deployment verification found `9244` bytes of runtime code at the address.

## Phase 5 Start

The official explorer is `https://www.botscans.net`. Phase 5 begins with a browser-safe deployed
network dashboard and live RPC health check before adding wallet-backed job workflows.

## Phase 6 Start

Phase 6 adds injected EVM wallet detection, BOT Chain Testnet add/switch support, account and balance
display, and wallet event synchronization. It does not submit protocol transactions yet.

## Phase 7 Start

Phase 7 adds a dedicated contract ABI module and a validated creator form that submits
`createJob` through the connected wallet, escrows the entered BOT budget, waits for confirmation,
and links the resulting transaction on BOT Scan.

## Phase 8 Start

Phase 8 reads the on-chain job sequence through `nextJobId` and `getJob`, presents public job
details and lifecycle state, and supports wallet-backed application submission and updates.

## Phase 9 Start

Phase 9 reconstructs the applicant list from contract events, lets the job creator choose up to 20
contributors, validates that allocations equal the exact escrowed budget, and submits
`selectContributors` through the creator wallet.

## Phase 10 Start

Phase 10 adds the delivery, creator acceptance, permissionless finalization, cancellation, and
claim withdrawal action surface. These controls are currently being connected to the existing job
read model and wallet transaction helper.

## Phase 11 Start

Phase 11 adds the wallet-derived agent profile and claimable earnings summary using
`completedJobCount`, `claimable`, and `totalClaimableLiability` contract reads.

## Phase 12 Start

Phase 12 consolidates pending states, receipt verification, account and chain guards, read refreshes
after every successful write, and user-visible error handling across the major workflows.

## Phase 12 Result

The major MVP workflows are wired through the deployed contract: create and fund, discover, apply,
select contributors, deliver work, accept or finalize, cancel, inspect profile earnings, and withdraw
claimable BOT. Type-checking, all 20 contract tests, formatting, and production build pass. The
production bundle currently emits a non-blocking size warning and can be optimized in Phase 13.

## Phase 13 Result

Phase 13 splits `viem` into a dedicated browser chunk through the Vite build configuration. The
production build completes without the prior main-bundle size warning.

## Phase 14 Result

Phase 14 adds `npm run smoke:testnet`, a read-only check that verifies the configured BOT Chain ID
and confirms runtime bytecode exists at the deployed contract address. The smoke check passed against
BOT Chain Testnet (chain 968), with 9,244 bytes of runtime code present.

Full browser wallet and multi-user workflow QA remain release checks.

## Phase 15 Start

Phase 15 adds `npm run release:check`, a single read-only release gate that runs the local checks,
production build, and BOT Chain smoke validation using the configured deployed contract.

## Phase 15 Result

The release gate passed: TypeScript, configuration tests, all 20 Foundry tests, formatting,
production build, and BOT Chain smoke validation all succeeded. The RPC briefly returned a DNS
failure on the first attempt, then passed on retry. No transaction was submitted.

## Phase 16 Start

Phase 16 adds `npm run web:smoke`, a dependency-free HTTP smoke check against the production
preview. It verifies that the built Ruvelt app shell and its compiled JavaScript asset are served.

## Phase 16 Result

The production preview served the Ruvelt HTML shell and its compiled JavaScript asset successfully.
The check is local and read-only; it does not connect a wallet or submit a transaction. Full
in-browser wallet and multi-user workflow QA remains for a later phase.

## Phase 17 Start

Phase 17 removes duplicate settlement controls and updates the release-readiness panel so the
dashboard accurately reflects the workflows already available on BOT Chain Testnet.

## Phase 17 Result

Duplicate settlement controls were removed and the dashboard release panel now reflects that the
major workflows are live. TypeScript, production build, formatting, and diff validation passed.

## Phase 18 Result

Added `npm run config:audit`, which verifies required environment templates and the deployed BOT
Chain address and chain ID remain aligned with the deployment record.

## Phase 19 Start

Phase 19 adds `npm run final:audit`, combining local tests, production build, web smoke, testnet
smoke, and diff validation into the final pre-handoff audit.

## Phase 19 Result

The final audit passed: three configuration tests, all 20 Foundry tests, formatting, production
build, local production-preview smoke, BOT Chain testnet smoke, and diff validation succeeded. No
transaction was submitted.

## Phase 20 Start

Phase 20 prepares the repository for handoff, confirms secret files are excluded from Git, records
the deployed contract references, and publishes the completed codebase from `main`.

## Phase 20 Result

The release documentation and validation commands are recorded, `.env` remains ignored, and the
full release audit passed before publication to the GitHub `main` branch.
