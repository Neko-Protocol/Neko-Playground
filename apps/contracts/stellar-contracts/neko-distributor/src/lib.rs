#![no_std]

use soroban_sdk::{contract, contractimpl, token, Address, Env};

mod storage;
mod types;

use storage::*;
use types::*;

mod trex {
    use soroban_sdk::contractclient;

    #[contractclient(name = "TrexClient")]
    #[allow(dead_code)]
    pub trait TrexToken {
        fn transfer(
            env: soroban_sdk::Env,
            from: soroban_sdk::Address,
            to: soroban_sdk::Address,
            amount: i128,
        );
        fn can_transfer(
            env: soroban_sdk::Env,
            from: soroban_sdk::Address,
            to: soroban_sdk::Address,
            amount: i128,
        ) -> bool;
        fn balance(env: soroban_sdk::Env, id: soroban_sdk::Address) -> i128;
    }
}

#[contract]
pub struct NekoDistributor;

#[contractimpl]
impl NekoDistributor {
    pub fn initialize(
        env: Env,
        admin: Address,
        fee_address: Address,
        fee_bps: u32,
        xlm_token: Address,
    ) {
        assert!(
            env.storage()
                .instance()
                .get::<_, Address>(&DataKey::Admin)
                .is_none(),
            "already initialized"
        );
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::FeeAddress, &fee_address);
        env.storage().instance().set(&DataKey::FeeBps, &fee_bps);
        env.storage().instance().set(&DataKey::XlmToken, &xlm_token);
    }

    pub fn list(
        env: Env,
        issuer: Address,
        token_contract: Address,
        amount: i128,
        price_per_token: i128,
    ) {
        issuer.require_auth();

        assert!(amount > 0, "amount must be positive");
        assert!(price_per_token > 0, "price must be positive");
        assert!(
            get_listing(&env, &token_contract).is_none(),
            "already listed — use update_listing"
        );

        let trex = trex::TrexClient::new(&env, &token_contract);
        trex.transfer(
            &issuer,
            &env.current_contract_address(),
            &amount,
        );

        set_listing(
            &env,
            &token_contract,
            &Listing {
                issuer,
                token_contract: token_contract.clone(),
                available: amount,
                price_per_token,
                total_raised: 0,
            },
        );
    }

    pub fn buy(env: Env, buyer: Address, token_contract: Address, token_amount: i128) {
        buyer.require_auth();

        let mut listing = get_listing(&env, &token_contract).expect("listing not found");

        assert!(token_amount > 0, "amount must be positive");
        assert!(listing.available >= token_amount, "insufficient supply");

        let trex = trex::TrexClient::new(&env, &token_contract);
        let compliant = trex.can_transfer(
            &env.current_contract_address(),
            &buyer,
            &token_amount,
        );
        assert!(
            compliant,
            "transfer not compliant: buyer not verified or restricted"
        );

        let total_xlm = token_amount * listing.price_per_token;
        let fee_bps = get_fee_bps(&env);
        let fee_xlm = (total_xlm * fee_bps) / 10_000;
        let issuer_xlm = total_xlm - fee_xlm;

        let xlm = token::Client::new(&env, &get_xlm_token(&env));
        xlm.transfer_from(
            &env.current_contract_address(),
            &buyer,
            &env.current_contract_address(),
            &total_xlm,
        );

        xlm.transfer(
            &env.current_contract_address(),
            &listing.issuer,
            &issuer_xlm,
        );

        if fee_xlm > 0 {
            xlm.transfer(
                &env.current_contract_address(),
                &get_fee_address(&env),
                &fee_xlm,
            );
        }

        trex.transfer(
            &env.current_contract_address(),
            &buyer,
            &token_amount,
        );

        listing.available -= token_amount;
        listing.total_raised += issuer_xlm;
        set_listing(&env, &token_contract, &listing);
    }

    pub fn withdraw(env: Env, issuer: Address, token_contract: Address) {
        issuer.require_auth();

        let listing = get_listing(&env, &token_contract).expect("listing not found");

        assert!(listing.issuer == issuer, "not the issuer");
        assert!(listing.available > 0, "nothing to withdraw");

        let trex = trex::TrexClient::new(&env, &token_contract);
        trex.transfer(
            &env.current_contract_address(),
            &issuer,
            &listing.available,
        );

        remove_listing(&env, &token_contract);
    }

    pub fn top_up(env: Env, issuer: Address, token_contract: Address, amount: i128) {
        issuer.require_auth();

        let mut listing = get_listing(&env, &token_contract).expect("listing not found");

        assert!(listing.issuer == issuer, "not the issuer");

        let trex = trex::TrexClient::new(&env, &token_contract);
        trex.transfer(
            &issuer,
            &env.current_contract_address(),
            &amount,
        );

        listing.available += amount;
        set_listing(&env, &token_contract, &listing);
    }

    pub fn get_listing(env: Env, token_contract: Address) -> Option<Listing> {
        get_listing(&env, &token_contract)
    }

    pub fn get_fee_bps(env: Env) -> i128 {
        storage::get_fee_bps(&env)
    }

    pub fn get_admin(env: Env) -> Address {
        storage::get_admin(&env)
    }
}
