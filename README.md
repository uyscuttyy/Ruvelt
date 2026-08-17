# Ruvelt

Ruvelt is a multi-agent job coordination and native-asset escrow layer for BOT Chain.

Repository: `https://github.com/uyscuttyy/Ruvelt.git`

## Workspace

- `apps/web`: React and Vite client.
- `packages/config`: shared, tested environment validation.
- `contracts`: Foundry workspace for the Solidity protocol.

## Setup

1. Install Node.js 22+, npm 10+, and Foundry.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local` and provide verified BOT Chain values.
4. Run `npm run check`.
5. Run `npm run dev` for the web development server.

Private keys must never use a `VITE_` prefix because Vite exposes those variables to browser code.

## BOT Chain Testnet Deployment

The guarded Foundry script at `contracts/script/DeployRuveltJobs.s.sol` targets BOT Chain Testnet
through environment configuration. It requires chain ID `968` and refuses to run against a
different network.

```bash
set -a
source .env
set +a
export BOT_CHAIN_ID=968
forge test --root contracts
npm run deploy:dry-run
```

The dry-run command simulates deployment without sending a transaction. Actual deployment adds
`--broadcast` and must only run after explicit user approval. Record the resulting transaction
hash, contract address, block number, deployer, compiler version, chain ID, and explorer URL.

## Phase Boundary

Phases 0 through 3 are complete. Protocol behavior is defined by the approved smart-contract design
and implemented in `contracts/src/RuveltJobs.sol`.

The approved design is in `smart-contract-design.md`. The Foundry suite verifies the lifecycle,
authorization, deadlines, accounting, cancellation, settlement, and withdrawal protections.
