# Ruvelt Smart Contract Design

## Status

Phase 2 design approved on 2026-08-16. This document is the implementation contract for Phase 3.
Changes to the lifecycle, authorization model, payment accounting, or approved limits require a
design update before implementation diverges from this document.

## Scope

The MVP uses one `RuveltJobs` contract as the authoritative store for jobs, applications,
selection, native-asset escrow, delivery, settlement, and contributor completion counts.

The contract does not implement disputes, reputation, messaging, recommendations, governance,
task decomposition, upgradeability, or token payments.

## Payment Asset Decision

The design uses the chain's native asset and Solidity value transfers:

- Funding functions are `payable`.
- Escrow and claimable balances are denominated in wei.
- Recipients withdraw claimable balances instead of receiving value during settlement.
- No ERC-20 address or token behavior is assumed.

Ruvelt targets an EVM-compatible BOT Chain network and therefore designs native-asset escrow around
standard Solidity `msg.value`, contract balances, and native-value calls. The exact target network
has not yet been configured.

Before any deployment or network smoke test, a deployment artifact must record the official source
used to verify the network's chain ID, RPC endpoint, explorer, native currency, EVM compatibility,
and support for payable calls. Local Phase 3 implementation and Foundry testing may proceed against
standard EVM semantics; deployment may not proceed on an unverified network.

## Contract Model

### Job

Each job has:

- `id`: monotonically increasing identifier used as the job mapping key; it need not be duplicated
  inside the stored job struct.
- `creator`: wallet that controls posting, selection, and early acceptance.
- `detailsRef`: non-empty content-addressed or HTTPS reference to public job details.
- `budget`: exact native-asset amount reserved for settlement.
- `applicationDeadline`: last timestamp at which applications may be submitted.
- `deliveryDeadline`: last timestamp at which selected contributors may submit work.
- `reviewPeriod`: interval after complete delivery before permissionless settlement is allowed.
- `state`: lifecycle state.
- `selectedTotal`: sum allocated to selected contributors, validated during selection; it need not
  be stored after equality with the immutable budget is established.
- `deliveredCount`: number of selected contributors with a work reference.
- `reviewDeadline`: set when the final selected contributor delivers.

References are opaque strings. The contract proves who committed a reference and when, not the
availability, safety, authorship, or quality of off-chain content.

### Application

An application contains the applicant wallet and a non-empty proposal reference. A wallet may
have at most one application per job. Applicants may update their proposal before selection while
the job is open.

### Selection

Selection is a non-empty list of distinct applicants and an amount for each applicant. Every
amount must be greater than zero and the sum must equal the job budget. This makes payment splits
arbitrary while preventing unallocated or over-allocated escrow.

### Agent Profile

Profiles are derived from wallet addresses. The only stored profile field is
`completedJobCount`, incremented once for every selected contributor when a job settles. A wallet
does not register separately and cannot edit this counter.

## State Machine

| State       | Meaning                                                   |
| ----------- | --------------------------------------------------------- |
| `Unfunded`  | Job exists but its exact budget has not been deposited.   |
| `Open`      | Fully funded and accepting applications.                  |
| `Selected`  | Contributors and exact payment splits are locked.         |
| `Delivered` | Every selected contributor submitted a work reference.    |
| `Settled`   | Escrow became contributor claimable balances.             |
| `Cancelled` | Job closed and any escrow became creator claimable value. |

Allowed transitions:

```text
Unfunded -> Open -> Selected -> Delivered -> Settled
    |         |         |
    +---------+---------+-> Cancelled
```

The `Selected -> Cancelled` transition is allowed only after the delivery deadline and only when
delivery is incomplete. `Delivered` cannot be cancelled.

## Operations And Authorization

### Create

Any wallet may create a job with a non-zero budget, valid references, future deadlines, and a
bounded non-zero review period. Creation may include exact funding in the same transaction. Zero
value creates an `Unfunded` job; value equal to the budget creates an `Open` job. Partial or excess
funding reverts.

### Fund

Only the creator may fund an `Unfunded` job. The attached value must equal the budget and funding
must occur before the application deadline.

### Apply

Any wallet except the creator may apply to an `Open` job before the application deadline. The
proposal reference must be non-empty. An applicant may update their own proposal while the same
conditions remain true.

### Select

Only the creator may select. The job must be `Open`, the selection must refer to existing distinct
applicants, and split amounts must sum exactly to the budget. Selection may occur before or after
the application deadline, but never after the delivery deadline.

Selection is atomic and immutable. It moves the job to `Selected`.

### Deliver

Only a selected contributor may deliver, once, before the delivery deadline. Delivery stores a
non-empty work reference. When the final contributor delivers, the job moves to `Delivered` and
sets `reviewDeadline = block.timestamp + reviewPeriod`.

### Accept And Settle

The creator may accept a `Delivered` job immediately. Any wallet may finalize it at or after the
review deadline. Both paths execute the same settlement logic:

1. Move each selected amount from escrow to that contributor's claimable balance.
2. Increment each selected contributor's completed-job count once.
3. Set the job state to `Settled`.

Settlement does not transfer native value, so a recipient that cannot receive value cannot block
the other contributors or the job state transition.

### Cancel

Only the creator may cancel an `Unfunded` or `Open` job. A `Selected` job may be cancelled by the
creator only after its delivery deadline if fewer than all selected contributors delivered.

Cancellation moves any escrow to the creator's claimable balance. It does not perform an inline
transfer. In the MVP, incomplete multi-contributor delivery is all-or-nothing: no contributor is
paid when the job is cancelled.

### Withdraw

Any wallet with a positive claimable balance may withdraw to a specified payable recipient.
Withdrawal uses checks-effects-interactions and reentrancy protection. A failed transfer reverts
without losing the claim.

## Invariants

The implementation and tests must preserve all of the following:

1. A funded active job holds exactly its declared budget as escrow liability.
2. A job's selected amounts are positive and sum exactly to its budget.
3. An applicant appears at most once in a job and a selected contributor appears at most once.
4. Selection and payment amounts cannot change after the job becomes `Selected`.
5. A selected contributor records at most one delivery for a job.
6. `Delivered` means every selected contributor has delivered.
7. Each job reaches at most one terminal state and settles or refunds at most once.
8. Completed-job counts increase only during settlement and at most once per contributor per job.
9. Settlement and cancellation convert escrow liability into claimable liability without changing
   total protocol liabilities.
10. Total escrow liability plus total claimable liability never exceeds the contract balance.
11. No external value transfer occurs during create, fund, select, deliver, settle, or cancel.
12. No privileged administrator can seize escrow, alter jobs, select contributors, or settle early.

Forced native value may make the contract balance greater than recorded liabilities, so equality
with `address(this).balance` is not an invariant.

## Events

The contract emits enough indexed data for public discovery and reconstruction:

- `JobCreated(jobId, creator, budget, applicationDeadline, deliveryDeadline, detailsRef)`
- `JobFunded(jobId, creator, amount)`
- `JobCancelled(jobId, creator, refundAmount)`
- `ApplicationSubmitted(jobId, applicant, proposalRef)`
- `ApplicationUpdated(jobId, applicant, proposalRef)`
- `ContributorsSelected(jobId, contributors, amounts)`
- `WorkDelivered(jobId, contributor, workRef)`
- `JobReadyForReview(jobId, reviewDeadline)`
- `JobSettled(jobId, settledBy, creatorAccepted)`
- `Withdrawal(account, recipient, amount)`

Dynamic references are emitted for indexing but remain stored on-chain so contract reads do not
depend on an indexer.

## Failure Cases

Calls revert for unknown jobs, unauthorized callers, invalid states, empty references, invalid or
expired deadlines, zero budgets or splits, incorrect funding value, duplicate applications or
contributors, selection of non-applicants, split sum mismatch, duplicate delivery, early timeout
actions, zero withdrawals, and failed native-value transfers.

The design intentionally accepts these approved MVP tradeoffs:

- A creator can reject incomplete delivery after the deadline by cancelling the entire job.
- Complete delivery becomes payable after the review period even without creator action.
- The protocol does not judge work quality or resolve disagreements.
- Large contributor arrays increase selection and settlement gas, so a job may select at most 20
  contributors.

## Approved Parameters

The Phase 2 acceptance decisions are:

- **Payment model:** native-asset escrow using standard EVM value semantics. Target-network
  capability verification is a deployment gate.
- **Incomplete delivery:** all-or-nothing cancellation and creator refund after the delivery
  deadline; partial delivery does not earn partial payment in the MVP.
- **Completed delivery:** the creator may settle immediately, and any wallet may settle after the
  review deadline.
- **Contributor limit:** at most 20 selected contributors per job.
- **Review-period bounds:** at least 1 hour and at most 30 days, chosen by the creator at job
  creation and immutable afterward.
- **Selection window:** selection is allowed while the job is `Open` and before the delivery
  deadline, including after the application deadline. Applications and application updates still
  close at the application deadline.

## Phase 3 Readiness

Phase 3 may implement and locally test this design. Its acceptance requires tests for every state
transition, authorization rule, deadline boundary, accounting invariant, contributor limit, review
period bound, cancellation path, settlement path, and withdrawal failure path.
