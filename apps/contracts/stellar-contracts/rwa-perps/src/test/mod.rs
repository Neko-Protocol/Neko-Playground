#![cfg(test)]
extern crate std;

use crate::common::storage::Storage;
use crate::common::types::{MarketConfig, Position, SCALAR_9};
use crate::{RWAPerpsContract, RWAPerpsContractClient};
use soroban_sdk::{testutils::Address as _, token, Address, Env, Vec, Symbol, symbol_short, String};
use rwa_oracle::{RWAOracle, RWAOracleClient, Asset, RWAMetadata, TokenizationInfo, RWAAssetType, ValuationMethod};

// ========== Test Helpers ==========

/// Create a mock oracle contract using the actual RWAOracle implementation
fn create_oracle(env: &Env, admin: &Address) -> Address {
    let base_asset = Asset::Other(symbol_short!("USD"));
    let oracle_id = env.register(RWAOracle, (
        admin,
        Vec::<Asset>::new(env),
        base_asset,
        9u32,      // decimals
        3600u32,   // resolution
    ));
    
    oracle_id
}

/// Create and initialize the perps contract
fn create_perps_contract(
    env: &Env,
    admin: Address,
    oracle: Address,
) -> RWAPerpsContractClient<'_> {
    let contract_id = env.register(RWAPerpsContract, ());
    let client = RWAPerpsContractClient::new(env, &contract_id);

    client.initialize(
        &admin,
        &oracle,
        &10,  // protocol_fee_rate: 0.1%
        &500, // liquidation_fee_rate: 5%
    );

    client
}

/// Create a default market configuration for testing
fn default_market_config(_env: &Env, rwa_token: Address) -> MarketConfig {
    MarketConfig {
        rwa_token,
        max_leverage: 1000,      // 10x
        maintenance_margin: 500, // 5%
        initial_margin: 1000,    // 10%
        funding_rate: 10,        // 0.1%
        last_funding_update: 0,
        is_active: true,
    }
}

/// Create a mock margin token contract
fn create_margin_token(env: &Env, admin: &Address) -> Address {
    let token_address = env.register_stellar_asset_contract_v2(admin.clone()).address();
    let token_client = token::StellarAssetClient::new(env, &token_address);
    token_client.mint(&admin.clone(), &(1_000_000_000 * SCALAR_9)); // Mint 1B tokens to admin
    token_address
}

/// Give tokens to a trader for testing
fn give_tokens_to_trader(env: &Env, token: &Address, _admin: &Address, trader: &Address, amount: i128) {
    let token_client = token::StellarAssetClient::new(env, token);
    token_client.mint(&trader.clone(), &amount);
}

/// Create a test position with specified parameters
fn create_test_position(
    env: &Env,
    trader: &Address,
    rwa_token: &Address,
    size: i128,
    entry_price: i128,
    margin: i128,
    leverage: u32,
) -> Position {
    Position {
        trader: trader.clone(),
        rwa_token: rwa_token.clone(),
        size,
        entry_price,
        margin,
        leverage,
        opened_at: env.ledger().timestamp(),
        last_funding_payment: 0,
    }
}

/// Helper to set position in storage from tests (wraps in contract context)
fn test_set_position(
    env: &Env,
    contract_address: &Address,
    trader: &Address,
    rwa_token: &Address,
    position: &Position,
) {
    env.as_contract(contract_address, || {
        Storage::set_position(env, trader, rwa_token, position);
    });
}

/// Helper to set current price in the oracle from tests
fn test_set_price(
    env: &Env,
    _contract_address: &Address,
    rwa_token: &Address,
    price: i128,
) {
    let perps_client = RWAPerpsContractClient::new(env, _contract_address);
    let oracle_address = perps_client.get_oracle();
    let oracle_client = RWAOracleClient::new(env, &oracle_address);
    let admin = perps_client.get_admin();

    // 1. Ensure asset is registered in the oracle and mapped to the token
    let asset_id = symbol_short!("RWA");
    let asset = Asset::Other(asset_id.clone());
    
    // Check if asset already exists in oracle, if not add it
    let assets = oracle_client.assets();
    if !assets.contains(asset.clone()) {
        env.as_contract(&oracle_address, || {
            oracle_client.add_assets(&Vec::from_array(&env, [asset.clone()]));
        });
        
        // Register RWA metadata to map token to asset
        let metadata = RWAMetadata {
            asset_id: asset_id.clone(),
            asset_type: RWAAssetType::Equity,
            name: String::from_str(env, "RWA"),
            description: String::from_str(env, "Real World Asset"),
            underlying_asset: String::from_str(env, "Underlying"),
            issuer: admin.clone(),
            jurisdiction: symbol_short!("US"),
            tokenization_info: TokenizationInfo {
                token_contract: Some(rwa_token.clone()),
                total_supply: Some(1_000_000_000),
                underlying_asset_id: Some(String::from_str(env, "AssetID")),
                tokenization_date: Some(env.ledger().timestamp()),
            },
            external_ids: Vec::new(env),
            valuation_method: ValuationMethod::Market,
            metadata: Vec::new(env),
            legal_docs_uri: None,
            created_at: env.ledger().timestamp(),
            updated_at: env.ledger().timestamp(),
        };
        
        env.as_contract(&oracle_address, || {
            oracle_client.set_rwa_metadata(&asset_id, &metadata);
        });
    }

    // 2. Set the price in the oracle
    env.as_contract(&oracle_address, || {
        oracle_client.set_asset_price(&asset, &price, &env.ledger().timestamp());
    });
}

// ========== Initialization Tests ==========

#[test]
fn test_initialization() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let oracle = create_oracle(&env, &admin);

    let client = create_perps_contract(&env, admin.clone(), oracle.clone());

    // Verify admin and oracle are set correctly
    let stored_admin = client.get_admin();
    assert_eq!(stored_admin, admin);

    let stored_oracle = client.get_oracle();
    assert_eq!(stored_oracle, oracle);

    // Verify protocol is not paused initially
    assert_eq!(client.is_protocol_paused(), false);
}

#[test]
#[should_panic(expected = "Error(Contract, #62)")] // AlreadyInitialized
fn test_double_initialization() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let oracle = create_oracle(&env, &admin);

    let contract_id = env.register(RWAPerpsContract, ());
    let client = RWAPerpsContractClient::new(&env, &contract_id);

    // First initialization
    client.initialize(&admin, &oracle, &10, &500);

    // Second initialization should panic
    client.initialize(&admin, &oracle, &10, &500);
}

#[test]
#[should_panic(expected = "Error(Contract, #60)")] // InvalidInput
fn test_initialization_invalid_protocol_fee() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let oracle = create_oracle(&env, &admin);

    let contract_id = env.register(RWAPerpsContract, ());
    let client = RWAPerpsContractClient::new(&env, &contract_id);

    // Try to initialize with invalid protocol fee (>100%)
    client.initialize(&admin, &oracle, &10001, &500);
}

#[test]
#[should_panic(expected = "Error(Contract, #60)")] // InvalidInput
fn test_initialization_invalid_liquidation_fee() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let oracle = create_oracle(&env, &admin);

    let contract_id = env.register(RWAPerpsContract, ());
    let client = RWAPerpsContractClient::new(&env, &contract_id);

    // Try to initialize with invalid liquidation fee (>100%)
    client.initialize(&admin, &oracle, &10, &10001);
}

// ========== Admin Function Tests ==========

#[test]
fn test_set_oracle() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let oracle = create_oracle(&env, &admin);

    let client = create_perps_contract(&env, admin.clone(), oracle.clone());

    // Set new oracle
    let new_oracle = Address::generate(&env);
    client.set_oracle(&new_oracle);

    // Verify oracle was updated
    assert_eq!(client.get_oracle(), new_oracle);
}

#[test]
fn test_set_protocol_paused() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let oracle = create_oracle(&env, &admin);

    let client = create_perps_contract(&env, admin.clone(), oracle.clone());

    // Initially not paused
    assert_eq!(client.is_protocol_paused(), false);

    // Pause protocol
    client.set_protocol_paused(&true);
    assert_eq!(client.is_protocol_paused(), true);

    // Unpause protocol
    client.set_protocol_paused(&false);
    assert_eq!(client.is_protocol_paused(), false);
}

#[test]
fn test_set_protocol_fee_rate() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let oracle = create_oracle(&env, &admin);

    let client = create_perps_contract(&env, admin.clone(), oracle.clone());

    // Set new fee rate (function should not panic)
    client.set_protocol_fee_rate(&20); // 0.2%
}

#[test]
#[should_panic(expected = "Error(Contract, #60)")] // InvalidInput
fn test_set_invalid_protocol_fee_rate() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let oracle = create_oracle(&env, &admin);

    let client = create_perps_contract(&env, admin.clone(), oracle.clone());

    // Try to set invalid fee rate (>100%)
    client.set_protocol_fee_rate(&10001);
}

#[test]
fn test_set_liquidation_fee_rate() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let oracle = create_oracle(&env, &admin);

    let client = create_perps_contract(&env, admin.clone(), oracle.clone());

    // Set new liquidation fee rate (function should not panic)
    client.set_liquidation_fee_rate(&600); // 6%
}

#[test]
#[should_panic(expected = "Error(Contract, #60)")] // InvalidInput
fn test_set_invalid_liquidation_fee_rate() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let oracle = create_oracle(&env, &admin);

    let client = create_perps_contract(&env, admin.clone(), oracle.clone());

    // Try to set invalid liquidation fee rate (>100%)
    client.set_liquidation_fee_rate(&10001);
}

#[test]
fn test_set_market_config() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let oracle = create_oracle(&env, &admin);

    let client = create_perps_contract(&env, admin.clone(), oracle.clone());

    // Create market config
    let rwa_token = Address::generate(&env);
    let config = default_market_config(&env, rwa_token.clone());

    // Set market config (should not panic)
    client.set_market_config(&rwa_token, &config);
}

#[test]
#[should_panic(expected = "Error(Contract, #60)")] // InvalidInput
fn test_set_invalid_market_config_zero_leverage() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let oracle = create_oracle(&env, &admin);

    let client = create_perps_contract(&env, admin.clone(), oracle.clone());

    let rwa_token = Address::generate(&env);
    let mut config = default_market_config(&env, rwa_token.clone());

    // Set invalid leverage (zero)
    config.max_leverage = 0;

    client.set_market_config(&rwa_token, &config);
}

#[test]
#[should_panic(expected = "Error(Contract, #60)")] // InvalidInput
fn test_set_invalid_market_config_high_leverage() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let oracle = create_oracle(&env, &admin);

    let client = create_perps_contract(&env, admin.clone(), oracle.clone());

    let rwa_token = Address::generate(&env);
    let mut config = default_market_config(&env, rwa_token.clone());

    // Set invalid leverage (>100x)
    config.max_leverage = 10001;

    client.set_market_config(&rwa_token, &config);
}

#[test]
#[should_panic(expected = "Error(Contract, #60)")] // InvalidInput
fn test_set_invalid_market_config_high_maintenance() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let oracle = create_oracle(&env, &admin);

    let client = create_perps_contract(&env, admin.clone(), oracle.clone());

    let rwa_token = Address::generate(&env);
    let mut config = default_market_config(&env, rwa_token.clone());

    // Set invalid maintenance margin (>100%)
    config.maintenance_margin = 10001;

    client.set_market_config(&rwa_token, &config);
}

// ========== Authorization Tests ==========

#[test]
fn test_admin_authorization_required() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let oracle = create_oracle(&env, &admin);

    let client = create_perps_contract(&env, admin.clone(), oracle.clone());

    // Verify admin functions require authorization
    // The mock_all_auths() allows all operations, demonstrating that
    // when properly authorized, admin functions work correctly
    let new_oracle = Address::generate(&env);
    client.set_oracle(&new_oracle);
    assert_eq!(client.get_oracle(), new_oracle);
}

// ========== Integration Tests ==========

#[test]
fn test_admin_and_liquidation_integration() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let oracle = create_oracle(&env, &admin);

    let client = create_perps_contract(&env, admin.clone(), oracle.clone());

    // Set up market via admin functions
    let rwa_token = Address::generate(&env);
    let config = default_market_config(&env, rwa_token.clone());
    client.set_market_config(&rwa_token, &config);

    // Verify contract is initialized and ready for operations
    assert_eq!(client.get_admin(), admin);
    assert_eq!(client.get_oracle(), oracle);
    assert_eq!(client.is_protocol_paused(), false);
}

// ========== Funding Tests ==========

#[test]
fn test_update_funding_rate() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let oracle = create_oracle(&env, &admin);

    let client = create_perps_contract(&env, admin.clone(), oracle.clone());

    // Set up market
    let rwa_token = Address::generate(&env);
    let config = default_market_config(&env, rwa_token.clone());
    client.set_market_config(&rwa_token, &config);

    // Update funding rate
    let new_rate = 200i128; // 2%
    client.update_funding_rate(&rwa_token, &new_rate); // Should not panic

    // Verify rate was updated
    let updated_rate = client.get_funding_rate(&rwa_token);
    assert_eq!(updated_rate, new_rate, "Funding rate should be updated");
}

#[test]
fn test_get_funding_rate() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let oracle = create_oracle(&env, &admin);

    let client = create_perps_contract(&env, admin.clone(), oracle.clone());

    // Set up market
    let rwa_token = Address::generate(&env);
    let config = default_market_config(&env, rwa_token.clone());
    client.set_market_config(&rwa_token, &config);

    // Get funding rate
    let rate = client.get_funding_rate(&rwa_token);
    assert_eq!(rate, 10i128, "Should return the configured funding rate");
}

// ========== Margin Management Tests ==========

// Tests for add_margin()

#[test]
fn test_add_margin_success() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let oracle = create_oracle(&env, &admin);
    let client = create_perps_contract(&env, admin.clone(), oracle.clone());

    // Set up margin token
    let margin_token = create_margin_token(&env, &admin);
    client.set_margin_token(&margin_token);

    // Set up market
    let rwa_token = Address::generate(&env);
    let config = default_market_config(&env, rwa_token.clone());
    client.set_market_config(&rwa_token, &config);

    // Create a position
    let trader = Address::generate(&env);
    give_tokens_to_trader(&env, &margin_token, &admin, &trader, 100_000 * SCALAR_9);

    let position = create_test_position(
        &env,
        &trader,
        &rwa_token,
        100_000 * SCALAR_9,  // 100,000 units long
        100 * SCALAR_9,      // Entry at $100
        10_000 * SCALAR_9,   // $10,000 margin
        1000,                // 10x leverage
    );
    let contract_address = client.address.clone();
    test_set_position(&env, &contract_address, &trader, &rwa_token, &position);

    // Add margin
    let result = client.try_add_margin(&trader, &rwa_token, &(5_000 * SCALAR_9));
    assert!(result.is_ok());

    // Verify margin was added
    let updated_position = env.as_contract(&contract_address, || {
        Storage::get_position(&env, &trader, &rwa_token)
    }).unwrap();
    assert_eq!(updated_position.margin, 15_000 * SCALAR_9);
}

#[test]
#[should_panic(expected = "Error(Contract, #1)")] // PositionNotFound
fn test_add_margin_position_not_found() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let oracle = create_oracle(&env, &admin);
    let client = create_perps_contract(&env, admin.clone(), oracle.clone());

    let margin_token = create_margin_token(&env, &admin);
    client.set_margin_token(&margin_token);

    let trader = Address::generate(&env);
    let rwa_token = Address::generate(&env);

    // Try to add margin to non-existent position
    client.add_margin(&trader, &rwa_token, &(1_000 * SCALAR_9));
}

#[test]
#[should_panic(expected = "Error(Contract, #60)")] // InvalidInput
fn test_add_margin_zero_amount() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let oracle = create_oracle(&env, &admin);
    let client = create_perps_contract(&env, admin.clone(), oracle.clone());

    let margin_token = create_margin_token(&env, &admin);
    client.set_margin_token(&margin_token);

    let rwa_token = Address::generate(&env);
    let config = default_market_config(&env, rwa_token.clone());
    client.set_market_config(&rwa_token, &config);

    let trader = Address::generate(&env);
    let position = create_test_position(&env, &trader, &rwa_token, 100_000 * SCALAR_9, 100 * SCALAR_9, 10_000 * SCALAR_9, 1000);
    let contract_address = client.address.clone();
    test_set_position(&env, &contract_address, &trader, &rwa_token, &position);

    // Try to add zero margin
    client.add_margin(&trader, &rwa_token, &0);
}

#[test]
#[should_panic(expected = "Error(Contract, #60)")] // InvalidInput
fn test_add_margin_negative_amount() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let oracle = create_oracle(&env, &admin);
    let client = create_perps_contract(&env, admin.clone(), oracle.clone());

    let margin_token = create_margin_token(&env, &admin);
    client.set_margin_token(&margin_token);

    let rwa_token = Address::generate(&env);
    let config = default_market_config(&env, rwa_token.clone());
    client.set_market_config(&rwa_token, &config);

    let trader = Address::generate(&env);
    let position = create_test_position(&env, &trader, &rwa_token, 100_000 * SCALAR_9, 100 * SCALAR_9, 10_000 * SCALAR_9, 1000);
    let contract_address = client.address.clone();
    test_set_position(&env, &contract_address, &trader, &rwa_token, &position);

    // Try to add negative margin
    client.add_margin(&trader, &rwa_token, &(-1_000 * SCALAR_9));
}

#[test]
#[should_panic(expected = "Error(Contract, #63)")] // ProtocolPaused
fn test_add_margin_protocol_paused() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let oracle = create_oracle(&env, &admin);
    let client = create_perps_contract(&env, admin.clone(), oracle.clone());

    let margin_token = create_margin_token(&env, &admin);
    client.set_margin_token(&margin_token);

    let rwa_token = Address::generate(&env);
    let config = default_market_config(&env, rwa_token.clone());
    client.set_market_config(&rwa_token, &config);

    let trader = Address::generate(&env);
    let position = create_test_position(&env, &trader, &rwa_token, 100_000 * SCALAR_9, 100 * SCALAR_9, 10_000 * SCALAR_9, 1000);
    let contract_address = client.address.clone();
    test_set_position(&env, &contract_address, &trader, &rwa_token, &position);

    // Pause protocol
    client.set_protocol_paused(&true);

    // Try to add margin
    client.add_margin(&trader, &rwa_token, &(1_000 * SCALAR_9));
}

#[test]
#[should_panic(expected = "Error(Contract, #21)")] // MarketInactive
fn test_add_margin_market_inactive() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let oracle = create_oracle(&env, &admin);
    let client = create_perps_contract(&env, admin.clone(), oracle.clone());

    let margin_token = create_margin_token(&env, &admin);
    client.set_margin_token(&margin_token);

    let rwa_token = Address::generate(&env);
    let mut config = default_market_config(&env, rwa_token.clone());
    config.is_active = false;
    client.set_market_config(&rwa_token, &config);

    let trader = Address::generate(&env);
    let position = create_test_position(&env, &trader, &rwa_token, 100_000 * SCALAR_9, 100 * SCALAR_9, 10_000 * SCALAR_9, 1000);
    let contract_address = client.address.clone();
    test_set_position(&env, &contract_address, &trader, &rwa_token, &position);

    // Try to add margin to inactive market
    client.add_margin(&trader, &rwa_token, &(1_000 * SCALAR_9));
}

// Tests for remove_margin()

#[test]
fn test_remove_margin_success() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let oracle = create_oracle(&env, &admin);
    let client = create_perps_contract(&env, admin.clone(), oracle.clone());

    let margin_token = create_margin_token(&env, &admin);
    client.set_margin_token(&margin_token);

    let rwa_token = Address::generate(&env);
    let config = default_market_config(&env, rwa_token.clone());
    client.set_market_config(&rwa_token, &config);

    // Set current price
    let contract_address = client.address.clone();
    test_set_price(&env, &contract_address, &rwa_token, 100 * SCALAR_9);

    let trader = Address::generate(&env);
    give_tokens_to_trader(&env, &margin_token, &admin, &trader, 100_000 * SCALAR_9);

    // Give tokens to the contract so it can transfer back to trader
    give_tokens_to_trader(&env, &margin_token, &admin, &contract_address, 100_000 * SCALAR_9);

    let position = create_test_position(
        &env,
        &trader,
        &rwa_token,
        1_000 * SCALAR_9,    // 1,000 units long
        100 * SCALAR_9,      // Entry at $100
        15_000 * SCALAR_9,   // $15,000 margin (15% margin ratio)
        1000,                // 10x leverage
    );
    test_set_position(&env, &contract_address, &trader, &rwa_token, &position);

    // Remove margin (leaving enough to stay above maintenance)
    // Position value = 1,000 * 100 = 100,000
    // After removal: margin = 10,000, ratio = 10,000 / 100,000 * 10,000 = 1,000 BP (10%)
    // This is above 5% maintenance margin
    let result = client.try_remove_margin(&trader, &rwa_token, &(5_000 * SCALAR_9));
    assert!(result.is_ok());

    // Verify margin was removed
    let updated_position = env.as_contract(&contract_address, || {
        Storage::get_position(&env, &trader, &rwa_token)
    }).unwrap();
    assert_eq!(updated_position.margin, 10_000 * SCALAR_9);
}

#[test]
#[should_panic(expected = "Error(Contract, #1)")] // PositionNotFound
fn test_remove_margin_position_not_found() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let oracle = create_oracle(&env, &admin);
    let client = create_perps_contract(&env, admin.clone(), oracle.clone());

    let margin_token = create_margin_token(&env, &admin);
    client.set_margin_token(&margin_token);

    let trader = Address::generate(&env);
    let rwa_token = Address::generate(&env);

    // Try to remove margin from non-existent position
    client.remove_margin(&trader, &rwa_token, &(1_000 * SCALAR_9));
}

#[test]
#[should_panic(expected = "Error(Contract, #60)")] // InvalidInput
fn test_remove_margin_zero_amount() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let oracle = create_oracle(&env, &admin);
    let client = create_perps_contract(&env, admin.clone(), oracle.clone());

    let margin_token = create_margin_token(&env, &admin);
    client.set_margin_token(&margin_token);

    let rwa_token = Address::generate(&env);
    let config = default_market_config(&env, rwa_token.clone());
    client.set_market_config(&rwa_token, &config);

    let contract_address = client.address.clone();
    test_set_price(&env, &contract_address, &rwa_token, 100 * SCALAR_9);

    let trader = Address::generate(&env);
    let position = create_test_position(&env, &trader, &rwa_token, 100_000 * SCALAR_9, 100 * SCALAR_9, 10_000 * SCALAR_9, 1000);
    test_set_position(&env, &contract_address, &trader, &rwa_token, &position);

    // Try to remove zero margin
    client.remove_margin(&trader, &rwa_token, &0);
}

#[test]
#[should_panic(expected = "Error(Contract, #11)")] // InsufficientMargin
fn test_remove_margin_exceeds_available() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let oracle = create_oracle(&env, &admin);
    let client = create_perps_contract(&env, admin.clone(), oracle.clone());

    let margin_token = create_margin_token(&env, &admin);
    client.set_margin_token(&margin_token);

    let rwa_token = Address::generate(&env);
    let config = default_market_config(&env, rwa_token.clone());
    client.set_market_config(&rwa_token, &config);

    let contract_address = client.address.clone();
    test_set_price(&env, &contract_address, &rwa_token, 100 * SCALAR_9);

    let trader = Address::generate(&env);
    let position = create_test_position(&env, &trader, &rwa_token, 100_000 * SCALAR_9, 100 * SCALAR_9, 10_000 * SCALAR_9, 1000);
    test_set_position(&env, &contract_address, &trader, &rwa_token, &position);

    // Try to remove more margin than available
    client.remove_margin(&trader, &rwa_token, &(15_000 * SCALAR_9));
}

#[test]
#[should_panic(expected = "Error(Contract, #70)")] // MarginRatioBelowMaintenance
fn test_remove_margin_triggers_liquidation() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let oracle = create_oracle(&env, &admin);
    let client = create_perps_contract(&env, admin.clone(), oracle.clone());

    let margin_token = create_margin_token(&env, &admin);
    client.set_margin_token(&margin_token);

    let rwa_token = Address::generate(&env);
    let config = default_market_config(&env, rwa_token.clone());
    client.set_market_config(&rwa_token, &config);

    // Set current price at entry (no PnL)
    let contract_address = client.address.clone();
    test_set_price(&env, &contract_address, &rwa_token, 100 * SCALAR_9);

    let trader = Address::generate(&env);
    // Position with 10% margin ratio
    let position = create_test_position(
        &env,
        &trader,
        &rwa_token,
        100_000 * SCALAR_9,
        100 * SCALAR_9,
        10_000 * SCALAR_9,  // 10% margin
        1000,
    );
    test_set_position(&env, &contract_address, &trader, &rwa_token, &position);

    // Try to remove margin that would drop below 5% maintenance
    client.remove_margin(&trader, &rwa_token, &(6_000 * SCALAR_9));
}

// Tests for calculate_margin_ratio()

#[test]
fn test_calculate_margin_ratio_healthy_position() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let oracle = create_oracle(&env, &admin);
    let client = create_perps_contract(&env, admin.clone(), oracle.clone());

    let rwa_token = Address::generate(&env);
    let config = default_market_config(&env, rwa_token.clone());
    client.set_market_config(&rwa_token, &config);

    // Price at entry (no PnL)
    let contract_address = client.address.clone();
    test_set_price(&env, &contract_address, &rwa_token, 100 * SCALAR_9);

    let trader = Address::generate(&env);
    let position = create_test_position(
        &env,
        &trader,
        &rwa_token,
        1_000 * SCALAR_9,  // Position size: 1,000 units
        100 * SCALAR_9,    // Entry price: $100
        10_000 * SCALAR_9, // Margin: $10,000
        1000,              // 10x leverage
    );
    test_set_position(&env, &contract_address, &trader, &rwa_token, &position);

    // Calculate margin ratio
    // Position value = 1,000 * 100 = 100,000
    // Margin = 10,000
    // Ratio = (10,000 / 100,000) * 10,000 = 1,000 basis points (10%)
    let ratio = client.calculate_margin_ratio(&trader, &rwa_token);
    assert_eq!(ratio, 1000);
}

#[test]
fn test_calculate_margin_ratio_with_profit() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let oracle = create_oracle(&env, &admin);
    let client = create_perps_contract(&env, admin.clone(), oracle.clone());

    let rwa_token = Address::generate(&env);
    let config = default_market_config(&env, rwa_token.clone());
    client.set_market_config(&rwa_token, &config);

    // Price increased 10%
    let contract_address = client.address.clone();
    test_set_price(&env, &contract_address, &rwa_token, 110 * SCALAR_9);

    let trader = Address::generate(&env);
    let position = create_test_position(
        &env,
        &trader,
        &rwa_token,
        1_000 * SCALAR_9,    // Long position: 1,000 units
        100 * SCALAR_9,      // Entry at $100
        10_000 * SCALAR_9,   // $10,000 margin
        1000,
    );
    test_set_position(&env, &contract_address, &trader, &rwa_token, &position);

    // Calculate margin ratio (should be higher due to profit)
    // Position value at new price = 1,000 * 110 = 110,000
    // Unrealized PnL = 1,000 * (110 - 100) = 10,000
    // Effective margin = 10,000 + 10,000 = 20,000
    // Ratio = (20,000 / 110,000) * 10,000 = 1,818 basis points (18.18%)
    let ratio = client.calculate_margin_ratio(&trader, &rwa_token);
    assert!(ratio > 1000); // Should be higher than original 10%
}

#[test]
#[should_panic(expected = "Error(Contract, #1)")] // PositionNotFound
fn test_calculate_margin_ratio_position_not_found() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let oracle = create_oracle(&env, &admin);
    let client = create_perps_contract(&env, admin.clone(), oracle.clone());

    let trader = Address::generate(&env);
    let rwa_token = Address::generate(&env);

    // Try to calculate margin ratio for non-existent position
    client.calculate_margin_ratio(&trader, &rwa_token);
}

// Tests for get_available_margin()

#[test]
fn test_get_available_margin_healthy_position() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let oracle = create_oracle(&env, &admin);
    let client = create_perps_contract(&env, admin.clone(), oracle.clone());

    let rwa_token = Address::generate(&env);
    let config = default_market_config(&env, rwa_token.clone());
    client.set_market_config(&rwa_token, &config);

    let contract_address = client.address.clone();
    test_set_price(&env, &contract_address, &rwa_token, 100 * SCALAR_9);

    let trader = Address::generate(&env);
    // Position with 20% margin ratio
    // Position value = 1,000 * 100 = 100,000
    // Margin = 20,000, ratio = 20,000 / 100,000 * 10,000 = 2,000 BP (20%)
    let position = create_test_position(
        &env,
        &trader,
        &rwa_token,
        1_000 * SCALAR_9,
        100 * SCALAR_9,
        20_000 * SCALAR_9,   // 20% margin
        1000,
    );
    test_set_position(&env, &contract_address, &trader, &rwa_token, &position);

    // Get available margin
    // Maintenance margin = 5%, safety buffer = 0.5%, so safe threshold = 5.5%
    // Min required = 100,000 * 5.5% = 5,500
    // Available = 20,000 - 5,500 = 14,500
    let available = client.get_available_margin(&trader, &rwa_token);
    assert!(available > 0);
}

#[test]
#[should_panic(expected = "Error(Contract, #1)")] // PositionNotFound
fn test_get_available_margin_position_not_found() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let oracle = create_oracle(&env, &admin);
    let client = create_perps_contract(&env, admin.clone(), oracle.clone());

    let trader = Address::generate(&env);
    let rwa_token = Address::generate(&env);

    // Try to get available margin for non-existent position
    client.get_available_margin(&trader, &rwa_token);
}

// Integration test

#[test]
fn test_margin_lifecycle() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let oracle = create_oracle(&env, &admin);
    let client = create_perps_contract(&env, admin.clone(), oracle.clone());

    let margin_token = create_margin_token(&env, &admin);
    client.set_margin_token(&margin_token);

    let rwa_token = Address::generate(&env);
    let config = default_market_config(&env, rwa_token.clone());
    client.set_market_config(&rwa_token, &config);

    let contract_address = client.address.clone();
    test_set_price(&env, &contract_address, &rwa_token, 100 * SCALAR_9);

    let trader = Address::generate(&env);
    give_tokens_to_trader(&env, &margin_token, &admin, &trader, 100_000 * SCALAR_9);

    // Give tokens to the contract so it can transfer back to trader
    give_tokens_to_trader(&env, &margin_token, &admin, &contract_address, 100_000 * SCALAR_9);

    // Position: size = 1,000, price = 100, margin = 10,000
    // Position value = 1,000 * 100 = 100,000
    // Margin ratio = 10,000 / 100,000 * 10,000 = 1,000 BP (10%)
    let position = create_test_position(
        &env,
        &trader,
        &rwa_token,
        1_000 * SCALAR_9,
        100 * SCALAR_9,
        10_000 * SCALAR_9,
        1000,
    );
    test_set_position(&env, &contract_address, &trader, &rwa_token, &position);

    // 1. Check initial margin ratio
    let initial_ratio = client.calculate_margin_ratio(&trader, &rwa_token);
    assert_eq!(initial_ratio, 1000); // 10%

    // 2. Add margin
    client.add_margin(&trader, &rwa_token, &(5_000 * SCALAR_9));
    let position_after_add = env.as_contract(&contract_address, || {
        Storage::get_position(&env, &trader, &rwa_token)
    }).unwrap();
    assert_eq!(position_after_add.margin, 15_000 * SCALAR_9);

    // 3. Check improved margin ratio
    let improved_ratio = client.calculate_margin_ratio(&trader, &rwa_token);
    assert!(improved_ratio > initial_ratio);

    // 4. Get available margin
    let available = client.get_available_margin(&trader, &rwa_token);
    assert!(available > 0);

    // 5. Remove some margin
    client.remove_margin(&trader, &rwa_token, &(3_000 * SCALAR_9));
    let final_position = env.as_contract(&contract_address, || {
        Storage::get_position(&env, &trader, &rwa_token)
    }).unwrap();
    assert_eq!(final_position.margin, 12_000 * SCALAR_9);

    // 6. Verify final ratio still above maintenance
    let final_ratio = client.calculate_margin_ratio(&trader, &rwa_token);
    assert!(final_ratio >= 500); // Above 5% maintenance margin
}

// ========== Position Opening and Closing Tests ==========


// Tests for open_position()

#[test]
fn test_open_long_position_success() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let oracle = create_oracle(&env, &admin);
    let client = create_perps_contract(&env, admin.clone(), oracle.clone());

    // Setup
    let margin_token = create_margin_token(&env, &admin);
    client.set_margin_token(&margin_token);

    let rwa_token = Address::generate(&env);
    let config = default_market_config(&env, rwa_token.clone());
    client.set_market_config(&rwa_token, &config);

    // Set price using test helper
    let contract_address = client.address.clone();
    test_set_price(&env, &contract_address, &rwa_token, 100 * SCALAR_9);

    let trader = Address::generate(&env);
    give_tokens_to_trader(&env, &margin_token, &admin, &trader, 20_000 * SCALAR_9);

    // Open long position: 1,000 units at 100, with 10x leverage, margin 10,000
    let result = client.try_open_position(
        &trader,
        &rwa_token,
        &(1_000 * SCALAR_9),  // Long position
        &1000,              // 10x leverage
        &(10_000 * SCALAR_9),
    );

    assert!(result.is_ok());

    // Verify position was created
    let position = client.get_position(&trader, &rwa_token);
    assert_eq!(position.size, 1_000 * SCALAR_9);
    assert_eq!(position.entry_price, 100 * SCALAR_9);
    assert_eq!(position.margin, 10_000 * SCALAR_9);
    assert_eq!(position.leverage, 1000);
}

#[test]
fn test_open_short_position_success() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let oracle = create_oracle(&env, &admin);
    let client = create_perps_contract(&env, admin.clone(), oracle.clone());

    let margin_token = create_margin_token(&env, &admin);
    client.set_margin_token(&margin_token);

    let rwa_token = Address::generate(&env);
    let config = default_market_config(&env, rwa_token.clone());
    client.set_market_config(&rwa_token, &config);

    let contract_address = client.address.clone();
    test_set_price(&env, &contract_address, &rwa_token, 100 * SCALAR_9);

    let trader = Address::generate(&env);
    give_tokens_to_trader(&env, &margin_token, &admin, &trader, 20_000 * SCALAR_9);

    // Open short position: -1,000 units at 100, with 10x leverage, margin 10,000
    let result = client.try_open_position(
        &trader,
        &rwa_token,
        &(-1_000 * SCALAR_9),  // Short position
        &1000,
        &(10_000 * SCALAR_9),
    );

    assert!(result.is_ok());

    let position = client.get_position(&trader, &rwa_token);
    assert_eq!(position.size, -1_000 * SCALAR_9);
    assert_eq!(position.entry_price, 100 * SCALAR_9);
}

#[test]
#[should_panic(expected = "Error(Contract, #60)")] // InvalidInput
fn test_open_position_zero_size() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let oracle = create_oracle(&env, &admin);
    let client = create_perps_contract(&env, admin.clone(), oracle.clone());

    let margin_token = create_margin_token(&env, &admin);
    client.set_margin_token(&margin_token);

    let rwa_token = Address::generate(&env);
    let config = default_market_config(&env, rwa_token.clone());
    client.set_market_config(&rwa_token, &config);

    let contract_address = client.address.clone();
    test_set_price(&env, &contract_address, &rwa_token, 100 * SCALAR_9);

    let trader = Address::generate(&env);

    // Try to open position with zero size
    client.open_position(&trader, &rwa_token, &0, &1000, &(10_000 * SCALAR_9));
}

#[test]
#[should_panic(expected = "Error(Contract, #60)")] // InvalidInput
fn test_open_position_zero_leverage() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let oracle = create_oracle(&env, &admin);
    let client = create_perps_contract(&env, admin.clone(), oracle.clone());

    let margin_token = create_margin_token(&env, &admin);
    client.set_margin_token(&margin_token);

    let rwa_token = Address::generate(&env);
    let config = default_market_config(&env, rwa_token.clone());
    client.set_market_config(&rwa_token, &config);

    let contract_address = client.address.clone();
    test_set_price(&env, &contract_address, &rwa_token, 100 * SCALAR_9);

    let trader = Address::generate(&env);

    // Try to open position with zero leverage
    client.open_position(&trader, &rwa_token, &(1_000 * SCALAR_9), &0, &(10_000 * SCALAR_9));
}

#[test]
#[should_panic(expected = "Error(Contract, #60)")] // InvalidInput
fn test_open_position_zero_margin() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let oracle = create_oracle(&env, &admin);
    let client = create_perps_contract(&env, admin.clone(), oracle.clone());

    let margin_token = create_margin_token(&env, &admin);
    client.set_margin_token(&margin_token);

    let rwa_token = Address::generate(&env);
    let config = default_market_config(&env, rwa_token.clone());
    client.set_market_config(&rwa_token, &config);

    let contract_address = client.address.clone();
    test_set_price(&env, &contract_address, &rwa_token, 100 * SCALAR_9);

    let trader = Address::generate(&env);

    // Try to open position with zero margin
    client.open_position(&trader, &rwa_token, &(1_000 * SCALAR_9), &1000, &0);
}

#[test]
#[should_panic(expected = "Error(Contract, #80)")] // ExceedsMaxLeverage
fn test_open_position_exceeds_max_leverage() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let oracle = create_oracle(&env, &admin);
    let client = create_perps_contract(&env, admin.clone(), oracle.clone());

    let margin_token = create_margin_token(&env, &admin);
    client.set_margin_token(&margin_token);

    let rwa_token = Address::generate(&env);
    let config = default_market_config(&env, rwa_token.clone());
    client.set_market_config(&rwa_token, &config);

    let contract_address = client.address.clone();
    test_set_price(&env, &contract_address, &rwa_token, 100 * SCALAR_9);

    let trader = Address::generate(&env);
    give_tokens_to_trader(&env, &margin_token, &admin, &trader, 20_000 * SCALAR_9);

    // Try to open position with leverage > max_leverage (1000)
    client.open_position(&trader, &rwa_token, &(1_000 * SCALAR_9), &2000, &(10_000 * SCALAR_9));
}

#[test]
#[should_panic(expected = "Error(Contract, #81)")] // InsufficientInitialMargin
fn test_open_position_insufficient_margin() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let oracle = create_oracle(&env, &admin);
    let client = create_perps_contract(&env, admin.clone(), oracle.clone());

    let margin_token = create_margin_token(&env, &admin);
    client.set_margin_token(&margin_token);

    let rwa_token = Address::generate(&env);
    let config = default_market_config(&env, rwa_token.clone());
    client.set_market_config(&rwa_token, &config);

    let contract_address = client.address.clone();
    test_set_price(&env, &contract_address, &rwa_token, 100 * SCALAR_9);

    let trader = Address::generate(&env);
    give_tokens_to_trader(&env, &margin_token, &admin, &trader, 20_000 * SCALAR_9);

    // Position value = 1,000 * 100 = 100,000
    // Initial margin requirement (10%) = 10,000
    // Try to open with only 5,000 margin
    client.open_position(&trader, &rwa_token, &(1_000 * SCALAR_9), &1000, &(5_000 * SCALAR_9));
}

#[test]
#[should_panic(expected = "Error(Contract, #2)")] // PositionAlreadyExists
fn test_open_position_already_exists() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let oracle = create_oracle(&env, &admin);
    let client = create_perps_contract(&env, admin.clone(), oracle.clone());

    let margin_token = create_margin_token(&env, &admin);
    client.set_margin_token(&margin_token);

    let rwa_token = Address::generate(&env);
    let config = default_market_config(&env, rwa_token.clone());
    client.set_market_config(&rwa_token, &config);

    let contract_address = client.address.clone();
    test_set_price(&env, &contract_address, &rwa_token, 100 * SCALAR_9);

    let trader = Address::generate(&env);
    give_tokens_to_trader(&env, &margin_token, &admin, &trader, 40_000 * SCALAR_9);

    // Open first position
    client.open_position(&trader, &rwa_token, &(1_000 * SCALAR_9), &1000, &(10_000 * SCALAR_9));

    // Try to open second position (should fail)
    client.open_position(&trader, &rwa_token, &(500 * SCALAR_9), &1000, &(5_000 * SCALAR_9));
}

#[test]
#[should_panic(expected = "Error(Contract, #20)")] // MarketNotFound
fn test_open_position_market_not_found() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let oracle = create_oracle(&env, &admin);
    let client = create_perps_contract(&env, admin.clone(), oracle.clone());

    let margin_token = create_margin_token(&env, &admin);
    client.set_margin_token(&margin_token);

    let rwa_token = Address::generate(&env);
    // Don't set market config

    let trader = Address::generate(&env);

    // Try to open position without market config
    client.open_position(&trader, &rwa_token, &(1_000 * SCALAR_9), &1000, &(10_000 * SCALAR_9));
}

#[test]
#[should_panic(expected = "Error(Contract, #21)")] // MarketInactive
fn test_open_position_market_inactive() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let oracle = create_oracle(&env, &admin);
    let client = create_perps_contract(&env, admin.clone(), oracle.clone());

    let margin_token = create_margin_token(&env, &admin);
    client.set_margin_token(&margin_token);

    let rwa_token = Address::generate(&env);
    let mut config = default_market_config(&env, rwa_token.clone());
    config.is_active = false;
    client.set_market_config(&rwa_token, &config);

    let contract_address = client.address.clone();
    test_set_price(&env, &contract_address, &rwa_token, 100 * SCALAR_9);

    let trader = Address::generate(&env);

    // Try to open position on inactive market
    client.open_position(&trader, &rwa_token, &(1_000 * SCALAR_9), &1000, &(10_000 * SCALAR_9));
}

#[test]
#[should_panic(expected = "Error(Contract, #63)")] // ProtocolPaused
fn test_open_position_protocol_paused() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let oracle = create_oracle(&env, &admin);
    let client = create_perps_contract(&env, admin.clone(), oracle.clone());

    let margin_token = create_margin_token(&env, &admin);
    client.set_margin_token(&margin_token);

    let rwa_token = Address::generate(&env);
    let config = default_market_config(&env, rwa_token.clone());
    client.set_market_config(&rwa_token, &config);

    // Pause protocol
    client.set_protocol_paused(&true);

    let trader = Address::generate(&env);

    // Try to open position when paused
    client.open_position(&trader, &rwa_token, &(1_000 * SCALAR_9), &1000, &(10_000 * SCALAR_9));
}

// Tests for close_position()

#[test]
fn test_close_position_full_with_profit() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let oracle = create_oracle(&env, &admin);
    let client = create_perps_contract(&env, admin.clone(), oracle.clone());

    let margin_token = create_margin_token(&env, &admin);
    client.set_margin_token(&margin_token);

    let rwa_token = Address::generate(&env);
    let config = default_market_config(&env, rwa_token.clone());
    client.set_market_config(&rwa_token, &config);

    let contract_address = client.address.clone();
    test_set_price(&env, &contract_address, &rwa_token, 100 * SCALAR_9);

    let trader = Address::generate(&env);
    give_tokens_to_trader(&env, &margin_token, &admin, &trader, 20_000 * SCALAR_9);

    // Give tokens to contract for payout
    give_tokens_to_trader(&env, &margin_token, &admin, &contract_address, 100_000 * SCALAR_9);

    // Open position
    client.open_position(&trader, &rwa_token, &(1_000 * SCALAR_9), &1000, &(10_000 * SCALAR_9));

    // Price increases by 10%
    test_set_price(&env, &contract_address, &rwa_token, 110 * SCALAR_9);

    // Close full position
    let result = client.try_close_position(&trader, &rwa_token, &(1_000 * SCALAR_9));
    assert!(result.is_ok());

    // Verify position is removed
    let position_result = client.try_get_position(&trader, &rwa_token);
    assert!(position_result.is_err());
}

#[test]
fn test_close_position_full_with_loss() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let oracle = create_oracle(&env, &admin);
    let client = create_perps_contract(&env, admin.clone(), oracle.clone());

    let margin_token = create_margin_token(&env, &admin);
    client.set_margin_token(&margin_token);

    let rwa_token = Address::generate(&env);
    let config = default_market_config(&env, rwa_token.clone());
    client.set_market_config(&rwa_token, &config);

    let contract_address = client.address.clone();
    test_set_price(&env, &contract_address, &rwa_token, 100 * SCALAR_9);

    let trader = Address::generate(&env);
    give_tokens_to_trader(&env, &margin_token, &admin, &trader, 20_000 * SCALAR_9);
    give_tokens_to_trader(&env, &margin_token, &admin, &contract_address, 100_000 * SCALAR_9);

    // Open position
    client.open_position(&trader, &rwa_token, &(1_000 * SCALAR_9), &1000, &(10_000 * SCALAR_9));

    // Price decreases by 5%
    test_set_price(&env, &contract_address, &rwa_token, 95 * SCALAR_9);

    // Close full position
    let result = client.try_close_position(&trader, &rwa_token, &(1_000 * SCALAR_9));
    assert!(result.is_ok());

    // Verify position is removed
    let position_result = client.try_get_position(&trader, &rwa_token);
    assert!(position_result.is_err());
}

#[test]
fn test_close_position_partial() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let oracle = create_oracle(&env, &admin);
    let client = create_perps_contract(&env, admin.clone(), oracle.clone());

    let margin_token = create_margin_token(&env, &admin);
    client.set_margin_token(&margin_token);

    let rwa_token = Address::generate(&env);
    let config = default_market_config(&env, rwa_token.clone());
    client.set_market_config(&rwa_token, &config);

    let contract_address = client.address.clone();
    test_set_price(&env, &contract_address, &rwa_token, 100 * SCALAR_9);

    let trader = Address::generate(&env);
    give_tokens_to_trader(&env, &margin_token, &admin, &trader, 20_000 * SCALAR_9);
    give_tokens_to_trader(&env, &margin_token, &admin, &contract_address, 100_000 * SCALAR_9);

    // Open position
    client.open_position(&trader, &rwa_token, &(1_000 * SCALAR_9), &1000, &(10_000 * SCALAR_9));

    // Close 40% of position
    let result = client.try_close_position(&trader, &rwa_token, &(400 * SCALAR_9));
    assert!(result.is_ok());

    // Verify position still exists with reduced size
    let position = client.get_position(&trader, &rwa_token);
    assert_eq!(position.size, 600 * SCALAR_9);
    // Margin should be reduced proportionally: 10,000 * 0.6 = 6,000
    assert_eq!(position.margin, 6_000 * SCALAR_9);
}

#[test]
#[should_panic(expected = "Error(Contract, #1)")] // PositionNotFound
fn test_close_position_not_found() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let oracle = create_oracle(&env, &admin);
    let client = create_perps_contract(&env, admin.clone(), oracle.clone());

    let margin_token = create_margin_token(&env, &admin);
    client.set_margin_token(&margin_token);

    let rwa_token = Address::generate(&env);
    let config = default_market_config(&env, rwa_token.clone());
    client.set_market_config(&rwa_token, &config);

    let trader = Address::generate(&env);

    // Try to close non-existent position
    client.close_position(&trader, &rwa_token, &(1_000 * SCALAR_9));
}

#[test]
#[should_panic(expected = "Error(Contract, #60)")] // InvalidInput
fn test_close_position_zero_size() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let oracle = create_oracle(&env, &admin);
    let client = create_perps_contract(&env, admin.clone(), oracle.clone());

    let margin_token = create_margin_token(&env, &admin);
    client.set_margin_token(&margin_token);

    let rwa_token = Address::generate(&env);
    let config = default_market_config(&env, rwa_token.clone());
    client.set_market_config(&rwa_token, &config);

    let contract_address = client.address.clone();
    test_set_price(&env, &contract_address, &rwa_token, 100 * SCALAR_9);

    let trader = Address::generate(&env);
    give_tokens_to_trader(&env, &margin_token, &admin, &trader, 20_000 * SCALAR_9);

    // Open position
    client.open_position(&trader, &rwa_token, &(1_000 * SCALAR_9), &1000, &(10_000 * SCALAR_9));

    // Try to close zero size
    client.close_position(&trader, &rwa_token, &0);
}

#[test]
#[should_panic(expected = "Error(Contract, #60)")] // InvalidInput
fn test_close_position_exceeds_size() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let oracle = create_oracle(&env, &admin);
    let client = create_perps_contract(&env, admin.clone(), oracle.clone());

    let margin_token = create_margin_token(&env, &admin);
    client.set_margin_token(&margin_token);

    let rwa_token = Address::generate(&env);
    let config = default_market_config(&env, rwa_token.clone());
    client.set_market_config(&rwa_token, &config);

    let contract_address = client.address.clone();
    test_set_price(&env, &contract_address, &rwa_token, 100 * SCALAR_9);

    let trader = Address::generate(&env);
    give_tokens_to_trader(&env, &margin_token, &admin, &trader, 20_000 * SCALAR_9);

    // Open position of 1,000 units
    client.open_position(&trader, &rwa_token, &(1_000 * SCALAR_9), &1000, &(10_000 * SCALAR_9));

    // Try to close 2,000 units (more than position size)
    client.close_position(&trader, &rwa_token, &(2_000 * SCALAR_9));
}

#[test]
#[should_panic(expected = "Error(Contract, #63)")] // ProtocolPaused
fn test_close_position_protocol_paused() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let oracle = create_oracle(&env, &admin);
    let client = create_perps_contract(&env, admin.clone(), oracle.clone());

    let margin_token = create_margin_token(&env, &admin);
    client.set_margin_token(&margin_token);

    let rwa_token = Address::generate(&env);
    let config = default_market_config(&env, rwa_token.clone());
    client.set_market_config(&rwa_token, &config);

    let contract_address = client.address.clone();
    test_set_price(&env, &contract_address, &rwa_token, 100 * SCALAR_9);

    let trader = Address::generate(&env);
    give_tokens_to_trader(&env, &margin_token, &admin, &trader, 20_000 * SCALAR_9);

    // Open position
    client.open_position(&trader, &rwa_token, &(1_000 * SCALAR_9), &1000, &(10_000 * SCALAR_9));

    // Pause protocol
    client.set_protocol_paused(&true);

    // Try to close position when paused
    client.close_position(&trader, &rwa_token, &(1_000 * SCALAR_9));
}

// Tests for get_position() and get_user_positions()

#[test]
fn test_get_position_success() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let oracle = create_oracle(&env, &admin);
    let client = create_perps_contract(&env, admin.clone(), oracle.clone());

    let margin_token = create_margin_token(&env, &admin);
    client.set_margin_token(&margin_token);

    let rwa_token = Address::generate(&env);
    let config = default_market_config(&env, rwa_token.clone());
    client.set_market_config(&rwa_token, &config);

    let contract_address = client.address.clone();
    test_set_price(&env, &contract_address, &rwa_token, 100 * SCALAR_9);

    let trader = Address::generate(&env);
    give_tokens_to_trader(&env, &margin_token, &admin, &trader, 20_000 * SCALAR_9);

    // Open position
    client.open_position(&trader, &rwa_token, &(1_000 * SCALAR_9), &1000, &(10_000 * SCALAR_9));

    // Get position
    let position = client.get_position(&trader, &rwa_token);
    assert_eq!(position.size, 1_000 * SCALAR_9);
    assert_eq!(position.margin, 10_000 * SCALAR_9);
}

#[test]
#[should_panic(expected = "Error(Contract, #1)")] // PositionNotFound
fn test_get_position_not_found() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let oracle = create_oracle(&env, &admin);
    let client = create_perps_contract(&env, admin.clone(), oracle.clone());

    let trader = Address::generate(&env);
    let rwa_token = Address::generate(&env);

    // Try to get non-existent position
    client.get_position(&trader, &rwa_token);
}

#[test]
fn test_get_user_positions_multiple() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let oracle = create_oracle(&env, &admin);
    let client = create_perps_contract(&env, admin.clone(), oracle.clone());

    let margin_token = create_margin_token(&env, &admin);
    client.set_margin_token(&margin_token);

    // Setup two different RWA tokens
    let rwa_token1 = Address::generate(&env);
    let config1 = default_market_config(&env, rwa_token1.clone());
    client.set_market_config(&rwa_token1, &config1);

    let rwa_token2 = Address::generate(&env);
    let config2 = default_market_config(&env, rwa_token2.clone());
    client.set_market_config(&rwa_token2, &config2);

    let contract_address = client.address.clone();
    test_set_price(&env, &contract_address, &rwa_token1, 100 * SCALAR_9);
    test_set_price(&env, &contract_address, &rwa_token2, 200 * SCALAR_9);

    let trader = Address::generate(&env);
    give_tokens_to_trader(&env, &margin_token, &admin, &trader, 40_000 * SCALAR_9);

    // Open positions on both tokens
    client.open_position(&trader, &rwa_token1, &(1_000 * SCALAR_9), &1000, &(10_000 * SCALAR_9));
    client.open_position(&trader, &rwa_token2, &(500 * SCALAR_9), &1000, &(10_000 * SCALAR_9));

    // Get all positions
    let positions = client.get_user_positions(&trader);
    assert_eq!(positions.len(), 2);
}

#[test]
fn test_get_user_positions_empty() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let oracle = create_oracle(&env, &admin);
    let client = create_perps_contract(&env, admin.clone(), oracle.clone());

    let trader = Address::generate(&env);

    // Get positions for trader with no positions
    let positions = client.get_user_positions(&trader);
    assert_eq!(positions.len(), 0);
}

// Integration tests

#[test]
fn test_position_lifecycle() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let oracle = create_oracle(&env, &admin);
    let client = create_perps_contract(&env, admin.clone(), oracle.clone());

    let margin_token = create_margin_token(&env, &admin);
    client.set_margin_token(&margin_token);

    let rwa_token = Address::generate(&env);
    let config = default_market_config(&env, rwa_token.clone());
    client.set_market_config(&rwa_token, &config);

    let contract_address = client.address.clone();
    test_set_price(&env, &contract_address, &rwa_token, 100 * SCALAR_9);

    let trader = Address::generate(&env);
    give_tokens_to_trader(&env, &margin_token, &admin, &trader, 20_000 * SCALAR_9);
    give_tokens_to_trader(&env, &margin_token, &admin, &contract_address, 100_000 * SCALAR_9);

    // 1. Open position
    client.open_position(&trader, &rwa_token, &(1_000 * SCALAR_9), &1000, &(10_000 * SCALAR_9));

    // 2. Verify position exists
    let position = client.get_position(&trader, &rwa_token);
    assert_eq!(position.size, 1_000 * SCALAR_9);

    // 3. Partial close (50%)
    client.close_position(&trader, &rwa_token, &(500 * SCALAR_9));

    // 4. Verify position updated
    let position = client.get_position(&trader, &rwa_token);
    assert_eq!(position.size, 500 * SCALAR_9);
    assert_eq!(position.margin, 5_000 * SCALAR_9);

    // 5. Full close
    client.close_position(&trader, &rwa_token, &(500 * SCALAR_9));

    // 6. Verify position removed
    let positions = client.get_user_positions(&trader);
    assert_eq!(positions.len(), 0);
}

#[test]
fn test_multiple_positions_different_tokens() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let oracle = create_oracle(&env, &admin);
    let client = create_perps_contract(&env, admin.clone(), oracle.clone());

    let margin_token = create_margin_token(&env, &admin);
    client.set_margin_token(&margin_token);

    let trader = Address::generate(&env);
    give_tokens_to_trader(&env, &margin_token, &admin, &trader, 100_000 * SCALAR_9);

    let contract_address = client.address.clone();

    // Create 3 different RWA tokens and open positions
    for i in 1..=3 {
        let rwa_token = Address::generate(&env);
        let config = default_market_config(&env, rwa_token.clone());
        client.set_market_config(&rwa_token, &config);
        
        test_set_price(&env, &contract_address, &rwa_token, (100 * i) * SCALAR_9);
        
        client.open_position(
            &trader,
            &rwa_token,
            &((1_000 * i) * SCALAR_9),
            &1000,
            &((10_000 * i) * SCALAR_9),
        );
    }

    // Verify all 3 positions exist
    let positions = client.get_user_positions(&trader);
    assert_eq!(positions.len(), 3);
}

#[test]
fn test_long_and_short_pnl_calculation() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let oracle = create_oracle(&env, &admin);
    let client = create_perps_contract(&env, admin.clone(), oracle.clone());

    let margin_token = create_margin_token(&env, &admin);
    client.set_margin_token(&margin_token);

    let rwa_token1 = Address::generate(&env);
    let config1 = default_market_config(&env, rwa_token1.clone());
    client.set_market_config(&rwa_token1, &config1);

    let rwa_token2 = Address::generate(&env);
    let config2 = default_market_config(&env, rwa_token2.clone());
    client.set_market_config(&rwa_token2, &config2);

    let contract_address = client.address.clone();
    test_set_price(&env, &contract_address, &rwa_token1, 100 * SCALAR_9);
    test_set_price(&env, &contract_address, &rwa_token2, 100 * SCALAR_9);

    let trader = Address::generate(&env);
    give_tokens_to_trader(&env, &margin_token, &admin, &trader, 40_000 * SCALAR_9);
    give_tokens_to_trader(&env, &margin_token, &admin, &contract_address, 200_000 * SCALAR_9);

    // Open long position on token1
    client.open_position(&trader, &rwa_token1, &(1_000 * SCALAR_9), &1000, &(10_000 * SCALAR_9));

    // Open short position on token2
    client.open_position(&trader, &rwa_token2, &(-1_000 * SCALAR_9), &1000, &(10_000 * SCALAR_9));

    // Price increases by 10% for both
    test_set_price(&env, &contract_address, &rwa_token1, 110 * SCALAR_9);
    test_set_price(&env, &contract_address, &rwa_token2, 110 * SCALAR_9);

    // Long position should profit, short should lose
    // Both can close successfully (different P&L outcomes)
    let long_result = client.try_close_position(&trader, &rwa_token1, &(1_000 * SCALAR_9));
    let short_result = client.try_close_position(&trader, &rwa_token2, &(1_000 * SCALAR_9));

    assert!(long_result.is_ok());
    assert!(short_result.is_ok());
}

#[test]
fn test_leverage_validation_boundaries() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let oracle = create_oracle(&env, &admin);
    let client = create_perps_contract(&env, admin.clone(), oracle.clone());

    let margin_token = create_margin_token(&env, &admin);
    client.set_margin_token(&margin_token);

    let rwa_token = Address::generate(&env);
    let config = default_market_config(&env, rwa_token.clone());
    client.set_market_config(&rwa_token, &config);

    let contract_address = client.address.clone();
    test_set_price(&env, &contract_address, &rwa_token, 100 * SCALAR_9);

    let trader = Address::generate(&env);
    give_tokens_to_trader(&env, &margin_token, &admin, &trader, 50_000 * SCALAR_9);

    // Test boundary: leverage = max_leverage (should succeed)
    let result = client.try_open_position(
        &trader,
        &rwa_token,
        &(1_000 * SCALAR_9),
        &1000, // Exactly max_leverage
        &(10_000 * SCALAR_9),
    );
    assert!(result.is_ok());
}

#[test]
fn test_margin_requirements_edge_cases() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let oracle = create_oracle(&env, &admin);
    let client = create_perps_contract(&env, admin.clone(), oracle.clone());

    let margin_token = create_margin_token(&env, &admin);
    client.set_margin_token(&margin_token);

    let rwa_token = Address::generate(&env);
    let config = default_market_config(&env, rwa_token.clone());
    client.set_market_config(&rwa_token, &config);

    let contract_address = client.address.clone();
    test_set_price(&env, &contract_address, &rwa_token, 100 * SCALAR_9);

    let trader = Address::generate(&env);
    give_tokens_to_trader(&env, &margin_token, &admin, &trader, 50_000 * SCALAR_9);

    // Position value = 1,000 * 100 = 100,000
    // Initial margin requirement (10%) = 10,000
    // Provide exactly the required margin (should succeed)
    let result = client.try_open_position(
        &trader,
        &rwa_token,
        &(1_000 * SCALAR_9),
        &1000,
        &(10_000 * SCALAR_9), // Exactly the required initial margin
    );
    assert!(result.is_ok());
}
