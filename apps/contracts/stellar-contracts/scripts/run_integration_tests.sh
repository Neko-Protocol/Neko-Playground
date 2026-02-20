#!/usr/bin/env bash
# Run Stellar RWA integration tests (Oracle -> Token / Lending).
# Builds rwa-oracle WASM first, then runs the full workspace test suite including integration_tests.
set -e
cd "$(dirname "$0")/.."
echo "Building rwa-oracle WASM (required by integration_tests)..."
cargo build --package rwa-oracle --target wasm32-unknown-unknown --release
echo "Running all workspace tests (including integration tests)..."
cargo test --workspace
