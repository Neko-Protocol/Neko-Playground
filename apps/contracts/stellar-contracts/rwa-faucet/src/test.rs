#![cfg(test)]
extern crate std;

use crate::contract::{Faucet, FaucetClient};
use crate::types::MintRequest;
use soroban_sdk::{
    testutils::Address as _,
    token::TokenClient,
    Address, Env, Vec,
};

/// Use Stellar Asset Contract as the mintable token for testing.
/// The issuer acts as the admin who can mint.
fn create_test_token(env: &Env, admin: &Address) -> Address {
    let contract = env.register_stellar_asset_contract_v2(admin.clone());
    contract.address()
}

fn create_faucet<'a>(env: &Env) -> (FaucetClient<'a>, Address) {
    let address = env.register(Faucet, ());
    let client = FaucetClient::new(env, &address);
    (client, address)
}

#[test]
fn test_initialize() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let (faucet, _) = create_faucet(&env);

    faucet.initialize(&admin);
    assert_eq!(faucet.admin(), admin);
}

#[test]
#[should_panic(expected = "Faucet: already initialized")]
fn test_initialize_twice_panics() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let (faucet, _) = create_faucet(&env);

    faucet.initialize(&admin);
    faucet.initialize(&admin);
}

#[test]
fn test_bulk_mint_single_token() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);

    let token_addr = create_test_token(&env, &admin);
    let token_client = TokenClient::new(&env, &token_addr);

    let (faucet, _) = create_faucet(&env);
    faucet.initialize(&admin);

    let requests = Vec::from_array(
        &env,
        [MintRequest {
            token: token_addr.clone(),
            to: user.clone(),
            amount: 1_000_0000000, // 1000 with 7 decimals
        }],
    );

    faucet.bulk_mint(&requests);

    assert_eq!(token_client.balance(&user), 1_000_0000000);
}

#[test]
fn test_bulk_mint_multiple_tokens() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);

    let token_a = create_test_token(&env, &admin);
    let token_b = create_test_token(&env, &admin);
    let client_a = TokenClient::new(&env, &token_a);
    let client_b = TokenClient::new(&env, &token_b);

    let (faucet, _) = create_faucet(&env);
    faucet.initialize(&admin);

    let requests = Vec::from_array(
        &env,
        [
            MintRequest {
                token: token_a.clone(),
                to: user.clone(),
                amount: 500_0000000,
            },
            MintRequest {
                token: token_b.clone(),
                to: user.clone(),
                amount: 100_0000000,
            },
        ],
    );

    faucet.bulk_mint(&requests);

    assert_eq!(client_a.balance(&user), 500_0000000);
    assert_eq!(client_b.balance(&user), 100_0000000);
}

#[test]
fn test_bulk_mint_multiple_recipients() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user_a = Address::generate(&env);
    let user_b = Address::generate(&env);

    let token_addr = create_test_token(&env, &admin);
    let token_client = TokenClient::new(&env, &token_addr);

    let (faucet, _) = create_faucet(&env);
    faucet.initialize(&admin);

    let requests = Vec::from_array(
        &env,
        [
            MintRequest {
                token: token_addr.clone(),
                to: user_a.clone(),
                amount: 200_0000000,
            },
            MintRequest {
                token: token_addr.clone(),
                to: user_b.clone(),
                amount: 300_0000000,
            },
        ],
    );

    faucet.bulk_mint(&requests);

    assert_eq!(token_client.balance(&user_a), 200_0000000);
    assert_eq!(token_client.balance(&user_b), 300_0000000);
}
