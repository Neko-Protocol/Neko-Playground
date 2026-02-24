//! End-to-end integration test: RWA Oracle → RWA Token (and optionally RWA Lending).
//!
//! Ensures that:
//! 1. Oracle is deployed and accepts a price for an asset.
//! 2. Token is deployed with oracle as price source and reads the set price.
//! 3. (Optional) Lending uses the same oracle for collateral valuation.
//!
//! Run after building oracle WASM from workspace root:
//!   cargo build -p rwa-oracle --target wasm32-unknown-unknown --release
//!   cargo test -p integration_tests rwa_flow

use integration_tests::{
    rwa_oracle_wasm, LendingContract, LendingContractClient, PoolState, RWATokenContract,
    RWATokenContractClient,
};
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    vec,
    Address, Env, String, Symbol, Vec,
};

const ORACLE_DECIMALS: u32 = 14;
const ORACLE_RESOLUTION_MS: u32 = 300;
const LEDGER_TIMESTAMP: u64 = 2_000_000_000;

fn set_ledger_timestamp(e: &Env, timestamp: u64) {
    e.ledger().with_mut(|li| li.timestamp = timestamp);
}

/// Deploy and initialize the RWA Oracle (from WASM), with one RWA asset (e.g. NVDA).
fn deploy_oracle<'a>(
    e: &'a Env,
    admin: &Address,
    asset_id: Symbol,
    base_asset: Symbol,
) -> (rwa_oracle_wasm::Client<'a>, Address) {
    set_ledger_timestamp(e, LEDGER_TIMESTAMP);
    let asset = rwa_oracle_wasm::Asset::Other(asset_id.clone());
    let base = rwa_oracle_wasm::Asset::Other(base_asset.clone());
    let assets: Vec<rwa_oracle_wasm::Asset> = vec![e, asset.clone(), base.clone()];

    let contract_address = e.register(
        rwa_oracle_wasm::WASM,
        (
            admin.clone(),
            assets.clone(),
            base.clone(),
            ORACLE_DECIMALS,
            ORACLE_RESOLUTION_MS,
        ),
    );

    let client = rwa_oracle_wasm::Client::new(e, &contract_address);
    (client, contract_address)
}

/// Deploy and initialize the RWA Token pointing at the given oracle and pegged asset.
/// Returns (client, token_contract_address).
fn deploy_token(
    e: &Env,
    admin: Address,
    oracle_address: Address,
    pegged_asset: Symbol,
    name: String,
    symbol: String,
    decimals: u32,
) -> (RWATokenContractClient<'_>, Address) {
    let contract_id = e.register(
        RWATokenContract,
        (
            admin,
            oracle_address,
            pegged_asset,
            name,
            symbol,
            decimals,
        ),
    );
    let client = RWATokenContractClient::new(e, &contract_id);
    (client, contract_id)
}

/// Create minimal RWA metadata for the oracle (so lending can resolve token → asset_id).
/// Uses types from the WASM module so set_rwa_metadata accepts them.
fn make_rwa_metadata(
    env: &Env,
    asset_id: Symbol,
    token_contract: Address,
) -> rwa_oracle_wasm::RWAMetadata {
    rwa_oracle_wasm::RWAMetadata {
        asset_id: asset_id.clone(),
        name: String::from_str(env, "Test RWA"),
        description: String::from_str(env, "Integration test RWA"),
        asset_type: rwa_oracle_wasm::RWAAssetType::Equity,
        underlying_asset: String::from_str(env, "Test"),
        issuer: Address::generate(env),
        jurisdiction: Symbol::new(env, "US"),
        tokenization_info: rwa_oracle_wasm::TokenizationInfo {
            token_contract: Some(token_contract),
            total_supply: Some(1_000_000_000),
            underlying_asset_id: Some(String::from_str(env, "TEST-RWA")),
            tokenization_date: Some(1_700_000_000),
        },
        external_ids: Vec::new(env),
        legal_docs_uri: None,
        valuation_method: rwa_oracle_wasm::ValuationMethod::Oracle,
        metadata: Vec::new(env),
        created_at: env.ledger().timestamp(),
        updated_at: env.ledger().timestamp(),
    }
}

/// **Integration test: Oracle → Token**
/// Deploy oracle, set a price, deploy token that uses the oracle, then read price from the token.
#[test]
fn test_oracle_to_token_price_flow() {
    let e = Env::default();
    e.mock_all_auths();

    let admin = Address::generate(&e);
    let asset_nvda = Symbol::new(&e, "NVDA");
    let base_usdc = Symbol::new(&e, "USDC");

    // 1) Deploy oracle with NVDA and USDC
    let (oracle_client, oracle_address) = deploy_oracle(&e, &admin, asset_nvda.clone(), base_usdc);

    // 2) Set price for NVDA (e.g. 150.00 with 14 decimals => 150 * 10^14)
    let price: i128 = 150_000_000_000_000;
    let ts = LEDGER_TIMESTAMP;
    oracle_client.set_asset_price(
        &rwa_oracle_wasm::Asset::Other(asset_nvda.clone()),
        &price,
        &ts,
    );

    let last = oracle_client
        .lastprice(&rwa_oracle_wasm::Asset::Other(asset_nvda.clone()))
        .unwrap();
    assert_eq!(last.price, price);
    assert_eq!(last.timestamp, ts);

    // 3) Deploy RWA token configured to use this oracle and pegged asset NVDA
    let (token, _token_address) = deploy_token(
        &e,
        admin.clone(),
        oracle_address,
        asset_nvda.clone(),
        String::from_str(&e, "NVIDIA Token"),
        String::from_str(&e, "NVDA"),
        7,
    );

    // 4) Token must return the same price from the oracle (returns Result; unwrap for test)
    let token_price = token.try_get_price().unwrap().unwrap();
    assert_eq!(token_price.price, price);
    assert_eq!(token_price.timestamp, ts);
}

/// **Integration test: Oracle → Lending (collateral valuation)**
/// Deploy oracle, set price, deploy token, register token in oracle metadata,
/// deploy lending with oracle, set collateral factor, add collateral, then calculate borrow limit
/// (which uses oracle price for collateral value).
#[test]
fn test_oracle_to_lending_collateral_valuation() {
    let e = Env::default();
    e.mock_all_auths();

    set_ledger_timestamp(&e, LEDGER_TIMESTAMP);

    let admin = Address::generate(&e);
    let asset_nvda = Symbol::new(&e, "NVDA");
    let base_usdc = Symbol::new(&e, "USDC");

    // 1) Deploy oracle
    let (oracle_client, oracle_address) = deploy_oracle(&e, &admin, asset_nvda.clone(), base_usdc);

    // 2) Deploy RWA token (so we have a token address for lending)
    let (token_client, token_address) = deploy_token(
        &e,
        admin.clone(),
        oracle_address.clone(),
        asset_nvda.clone(),
        String::from_str(&e, "NVIDIA Token"),
        String::from_str(&e, "NVDA"),
        7,
    );

    // 3) Register RWA metadata with token_contract so lending's get_asset_id_from_token works
    let metadata = make_rwa_metadata(&e, asset_nvda.clone(), token_address.clone());
    oracle_client.set_rwa_metadata(&asset_nvda, &metadata);

    // 4) Set price for NVDA (required for collateral valuation)
    let price: i128 = 200_000_000_000_000; // 200.00 (14 decimals)
    oracle_client.set_asset_price(
        &rwa_oracle_wasm::Asset::Other(asset_nvda.clone()),
        &price,
        &LEDGER_TIMESTAMP,
    );

    // 5) Deploy and initialize lending (same oracle for RWA and "reflector" in this test)
    let lending_id = e.register(LendingContract, ());
    let lending_client = LendingContractClient::new(&e, &lending_id);
    lending_client.initialize(
        &admin,
        &oracle_address,
        &oracle_address,
        &1_000_000_000_000,
        &500_000,
    );

    // 6) Set collateral factor for this RWA token and set pool state
    lending_client.set_collateral_factor(&token_address, &7_500_000); // 75%
    lending_client.set_pool_state(&PoolState::Active);

    // 7) Mint some token to a borrower and add as collateral
    let borrower = Address::generate(&e);
    token_client.set_authorized(&borrower, &true);
    token_client.mint(&borrower, &100_0000000); // 100 tokens (7 decimals)
    token_client.set_authorized(&lending_id, &true);
    lending_client.add_collateral(&borrower, &token_address, &50_0000000); // 50 tokens

    // 8) Borrow limit depends on collateral value from oracle (returns Result; unwrap for test)
    let borrow_limit = lending_client
        .try_calculate_borrow_limit(&borrower)
        .unwrap()
        .unwrap();
    assert!(borrow_limit > 0, "borrow limit should be positive when collateral and price are set");
}
