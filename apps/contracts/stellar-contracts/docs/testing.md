# Testing Stellar Contracts

This document describes how to run unit and integration tests for the Stellar RWA contracts.

## Unit tests

Each contract crate has unit tests in its `src/test/` module (or inline `#[cfg(test)]`). They run in the Soroban test environment and do not require WASM artifacts.

```bash
# All unit tests
cargo test --workspace

# Per package
cargo test --package rwa-oracle
cargo test --package rwa-token
cargo test --package rwa-lending
```

## Integration tests

The **integration_tests** crate runs end-to-end tests that deploy multiple contracts and assert on the full RWA flow:

1. **Oracle → Token:** Deploy rwa-oracle, set an asset price, deploy rwa-token with that oracle, then call `token.get_price()` and assert it matches the set price.
2. **Oracle → Lending:** Deploy oracle, set price, deploy token, register token in oracle metadata, deploy rwa-lending, set collateral factor, add collateral, and assert `calculate_borrow_limit` is positive (collateral valuation uses the oracle price).

These tests ensure the intended deployment and call order (oracle → token → lending) and catch integration bugs between contracts.

### Prerequisite: Oracle WASM

The integration tests load the rwa-oracle contract from its WASM file. Install the Rust WASM target (once) and build the oracle:

```bash
# From apps/contracts/stellar-contracts/
rustup target add wasm32-unknown-unknown
cargo build --package rwa-oracle --target wasm32-unknown-unknown --release
```

WASM is written to `target/wasm32-unknown-unknown/release/rwa_oracle.wasm`. The `integration_tests` crate expects this path relative to the workspace root.

### Run integration tests

```bash
# Run all integration tests
cargo test --package integration_tests

# Run specific test
cargo test --package integration_tests test_oracle_to_token_price_flow
cargo test --package integration_tests test_oracle_to_lending_collateral_valuation
```

### One-shot: build WASM and run all tests

Use the helper script so CI or local runs can do a single command:

```bash
./scripts/run_integration_tests.sh
```

This builds rwa-oracle WASM then runs `cargo test --workspace` (unit + integration).

## CI

To run tests in CI:

1. **Unit only (no WASM):** `cargo test --workspace --exclude integration_tests`
2. **Full suite (with integration):**
   - `cargo build -p rwa-oracle --target wasm32-unknown-unknown --release`
   - `cargo test --workspace`

Or run `./scripts/run_integration_tests.sh` if the repo is checked out at `apps/contracts/stellar-contracts`.

## What the integration tests cover

| Test                                          | Contracts                                 | Flow                                                                                                                                                    |
| --------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `test_oracle_to_token_price_flow`             | rwa-oracle (WASM), rwa-token              | Set price on oracle → deploy token with oracle → `token.get_price()` returns that price                                                                 |
| `test_oracle_to_lending_collateral_valuation` | rwa-oracle (WASM), rwa-token, rwa-lending | Set price, deploy token, set RWA metadata (token→asset), deploy lending, set collateral factor, add collateral → `calculate_borrow_limit(borrower) > 0` |

This documents the intended deployment order (oracle first, then token and lending) and validates that price flows from oracle to token and to lending collateral valuation.
