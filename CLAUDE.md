# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Neko DApp is a DeFi protocol built on Stellar blockchain featuring liquidity pools, lending, borrowing, and RWA (Real-World Assets) token management. It's a Turborepo monorepo with a Next.js frontend and smart contracts in both Rust (Stellar/Soroban) and Solidity (EVM/Foundry).

## Commands

### Development

```bash
npm run dev              # Start all dev servers (web app at localhost:3000)
npm run build            # Build all packages and apps
npm run lint             # Run ESLint across all packages
npm run format           # Format code with Prettier
npm run format:check     # Check formatting without modifying
```

### Stellar Contracts (from apps/contracts/stellar-contracts/)

```bash
cargo build --workspace --release                              # Build all contracts
cargo build --package rwa-oracle --release                     # Build specific contract
cargo test --workspace                                         # Run all tests
cargo test --package rwa-oracle                                # Test specific contract
cargo build --workspace --target wasm32v1-none-unknown --release  # Build WASM
cargo build --profile release-with-logs --target wasm32v1-none-unknown  # Build with logging
```

### EVM Contracts (from apps/contracts/evm-contracts/rwa-lending/)

```bash
forge build              # Build contracts
forge test               # Run tests
forge fmt                # Format Solidity code
```

## Architecture

### Monorepo Structure

- **apps/web-app/**: Next.js 16 + React 19 frontend with Turbopack
- **apps/contracts/stellar-contracts/**: Rust/Soroban smart contracts (rwa-oracle, rwa-token, rwa-lending)
- **apps/contracts/evm-contracts/**: Solidity/Foundry contracts with Pyth oracle integration
- **packages/config/**: Shared ESLint, Tailwind, and TypeScript configs
- **packages/contracts/**: TypeScript contract client packages (@neko/oracle, @neko/lending)

### Frontend Architecture (apps/web-app/src/)

Uses a **feature-based architecture**:

- **features/**: Self-contained modules (borrowing, lending, stocks, swap, pools, wallet, dashboard) each with components/, hooks/, utils/
- **components/**: Shared UI components
- **lib/**: Shared utilities, constants, helpers, services
- **stores/**: Zustand stores (stellarWalletStore.ts, activityStore.ts)
- **providers/**: Context providers (ToastProvider)

### Data Flow

```
Feature Components → Feature Hooks → Services/Helpers → Contract Clients (@neko/*) → Smart Contracts
```

### State Management

- **Global state**: Zustand stores
- **Server state**: React Query (TanStack Query)
- **Provider chain**: `app/layout.tsx` mounts `app/providers.tsx` (QueryClientProvider → ToastProvider); the `(app)` route group adds RiskAlertProvider and mounts WalletAutoConnect (`app/(app)/layout.tsx`)
- **Wallet state**: single source of truth is the Zustand store `stores/stellarWalletStore.ts` — written by `hooks/useStellarWallet.ts` (connect/disconnect), read via `hooks/useWallet.ts` (balances, signing) and directly by `stores/activityStore.ts` and the activity feed

### Smart Contract Dependencies

- rwa-token depends on rwa-oracle
- rwa-lending depends on both rwa-oracle and rwa-token
- Build contracts in dependency order when compiling WASM

### Multi-Chain Support

- **Stellar**: @stellar/stellar-sdk, Stellar Wallets Kit, SoroSwap SDK
- **EVM**: viem, wagmi, RainbowKit, CoW Swap SDK, Uniswap SDK

## Code Style

- Prettier: double quotes, semicolons, 2-space indent, 80 char width, es5 trailing commas
- Foundry (Solidity): 4-space indent, 120 char line length, double quotes
- Conventional commits: feat, fix, chore, refactor, etc.

## Environment Setup

Create `apps/web-app/.env.local`:

```env
NEXT_PUBLIC_STELLAR_NETWORK=TESTNET
NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
NEXT_PUBLIC_STELLAR_RPC_URL=https://soroban-testnet.stellar.org
NEXT_PUBLIC_STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
NEXT_PUBLIC_SOROSWAP_API_KEY=your_api_key_here
```

## Prerequisites

- Node.js v18+, npm v10.2.3+
- Rust v1.70+ (for Stellar contracts)
- Stellar CLI v23.1.0+ (for contract bindings)
- Foundry (for EVM contracts)

## Skills

Additional skills available in `.claude/skills/` for specific patterns:

- **tanstack-query**: React Query best practices and patterns
- **tailwind-patterns**: Tailwind CSS component patterns
- **next-best-practices**: Next.js optimization guidelines
- **vercel-react-best-practices**: React performance patterns from Vercel
- **vercel-composition-patterns**: Component composition patterns
- **remotion-best-practices**: Video generation with Remotion
- **codex**: OpenAI Codex CLI integration

## Preferences

- Do not add Co-Authored-By signature in commits
- Use conventional commits: feat, fix, chore, refactor, docs, test, etc.
