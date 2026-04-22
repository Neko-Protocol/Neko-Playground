#![no_std]

use soroban_sdk::{contract, contractimpl, Address, Env, String};

mod admin;
mod compliance;
mod identity;
mod storage;
mod token;
mod types;

use crate::types::*;

#[contract]
pub struct TrexToken;

#[contractimpl]
impl TrexToken {
    pub fn initialize(
        env: Env,
        admin: Address,
        issuer: Address,
        name: String,
        symbol: String,
        decimals: u32,
        total_supply: i128,
        compliance: ComplianceConfig,
    ) {
        assert!(
            env.storage()
                .instance()
                .get::<_, Address>(&DataKey::Admin)
                .is_none(),
            "already initialized"
        );

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Issuer, &issuer);
        env.storage().instance().set(
            &DataKey::Metadata,
            &TokenMetadata {
                name,
                symbol,
                decimals,
            },
        );
        env.storage().instance().set(&DataKey::Compliance, &compliance);

        token::mint(&env, issuer, total_supply);
    }

    pub fn balance(env: Env, id: Address) -> i128 {
        token::balance(&env, id)
    }

    pub fn transfer(env: Env, from: Address, to: Address, amount: i128) {
        token::transfer(&env, from, to, amount);
    }

    pub fn transfer_from(
        env: Env,
        spender: Address,
        from: Address,
        to: Address,
        amount: i128,
    ) {
        token::transfer_from(&env, spender, from, to, amount);
    }

    pub fn approve(
        env: Env,
        from: Address,
        spender: Address,
        amount: i128,
        expiration_ledger: u32,
    ) {
        token::approve(&env, from, spender, amount, expiration_ledger);
    }

    pub fn allowance(env: Env, from: Address, spender: Address) -> i128 {
        token::allowance(&env, from, spender)
    }

    pub fn decimals(env: Env) -> u32 {
        token::decimals(&env)
    }

    pub fn name(env: Env) -> String {
        token::name(&env)
    }

    pub fn symbol(env: Env) -> String {
        token::symbol(&env)
    }

    pub fn total_supply(env: Env) -> i128 {
        token::total_supply(&env)
    }

    pub fn burn(env: Env, from: Address, amount: i128) {
        token::burn(&env, from, amount);
    }

    pub fn can_transfer(env: Env, from: Address, to: Address, amount: i128) -> bool {
        compliance::can_transfer(&env, &from, &to, amount)
    }

    pub fn add_identity(
        env: Env,
        caller: Address,
        address: Address,
        record: IdentityRecord,
    ) {
        caller.require_auth();
        admin::require_admin(&env, &caller);
        identity::add_verified_identity(&env, &address, record);
    }

    pub fn revoke_identity(env: Env, caller: Address, address: Address) {
        caller.require_auth();
        admin::require_admin(&env, &caller);
        identity::revoke_identity(&env, &address);
    }

    pub fn get_identity(env: Env, address: Address) -> Option<IdentityRecord> {
        storage::get_identity(&env, &address)
    }

    pub fn get_compliance(env: Env) -> ComplianceConfig {
        storage::get_compliance(&env)
    }

    pub fn freeze(env: Env, caller: Address, address: Address) {
        caller.require_auth();
        admin::require_admin(&env, &caller);
        admin::freeze_address(&env, &address);
    }

    pub fn unfreeze(env: Env, caller: Address, address: Address) {
        caller.require_auth();
        admin::require_admin(&env, &caller);
        admin::unfreeze_address(&env, &address);
    }

    pub fn forced_transfer(
        env: Env,
        caller: Address,
        from: Address,
        to: Address,
        amount: i128,
    ) {
        caller.require_auth();
        admin::require_admin(&env, &caller);
        token::forced_transfer(&env, from, to, amount);
    }

    pub fn holder_count(env: Env) -> u32 {
        storage::get_holder_count(&env)
    }
}
