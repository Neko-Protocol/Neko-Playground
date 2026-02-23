//! Integration tests for the Stellar RWA flow: Oracle → Token and Oracle → Lending.
//!
//! Run after building oracle WASM:
//!   cargo build -p rwa-oracle --target wasm32-unknown-unknown --release
//!   cargo test -p integration_tests

pub mod rwa_oracle_wasm {
    soroban_sdk::contractimport!(
        file = "../target/wasm32-unknown-unknown/release/rwa_oracle.wasm"
    );
}

// Re-export so integration test binary (tests/*.rs) can use these types
pub use rwa_lending::{LendingContract, LendingContractClient, PoolState};
pub use rwa_oracle::{Asset, RWAAssetType, RWAMetadata, TokenizationInfo, ValuationMethod};
pub use rwa_token::contract::{RWATokenContract, RWATokenContractClient};
