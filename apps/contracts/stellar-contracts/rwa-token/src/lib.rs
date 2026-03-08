#![no_std]

pub mod common;
pub mod token;
pub mod compliance;
pub mod oracle;
pub mod admin;

pub use common::error::Error;

// Import RWA Oracle WASM for reading RWA asset prices
pub mod rwa_oracle {
    soroban_sdk::contractimport!(file = "../target/wasm32v1-none/release/rwa_oracle.wasm");
}

pub mod contract;

#[cfg(test)]
mod test;
