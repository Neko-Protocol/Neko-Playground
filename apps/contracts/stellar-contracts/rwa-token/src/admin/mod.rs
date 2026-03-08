pub mod supply;

use soroban_sdk::{assert_with_error, panic_with_error, Address, BytesN, Env, String, Symbol};

use crate::common::error::Error;
use crate::common::events::Events;
use crate::common::metadata::MetadataStorage;
use crate::common::types::TokenStorage;
use crate::compliance::freeze::AuthorizationStorage;
use crate::token::balance::BalanceStorage;

use self::supply::TotalSupplyStorage;

/// Administrative functions for the token contract
pub struct Admin;

impl Admin {
    /// Initialize the token with metadata
    pub fn initialize(
        env: &Env,
        admin: &Address,
        asset_contract: &Address,
        pegged_asset: &Symbol,
        name: &String,
        symbol: &String,
        decimals: u32,
    ) {
        if MetadataStorage::is_initialized(env) {
            panic_with_error!(env, Error::AlreadyInitialized);
        }

        MetadataStorage::set_admin(env, admin);

        let token = TokenStorage {
            name: name.clone(),
            symbol: symbol.clone(),
            decimals,
            asset_contract: asset_contract.clone(),
            pegged_asset: pegged_asset.clone(),
        };
        MetadataStorage::set_token(env, &token);
    }

    /// Get the admin address
    pub fn get_admin(env: &Env) -> Address {
        MetadataStorage::get_admin(env)
            .unwrap_or_else(|| panic_with_error!(env, Error::NotInitialized))
    }

    /// Require admin authorization
    pub fn require_admin(env: &Env) {
        let admin = Self::get_admin(env);
        admin.require_auth();
    }

    /// Mint tokens to an address
    pub fn mint(env: &Env, to: &Address, amount: i128) {
        Self::require_admin(env);
        assert_with_error!(env, amount > 0, Error::ValueNotPositive);

        BalanceStorage::add(env, to, amount);
        TotalSupplyStorage::add(env, amount);
        Events::mint(env, to, amount);
    }

    /// Clawback tokens from an address
    pub fn clawback(env: &Env, from: &Address, amount: i128) {
        Self::require_admin(env);
        assert_with_error!(env, amount > 0, Error::ValueNotPositive);

        BalanceStorage::subtract(env, from, amount);
        TotalSupplyStorage::subtract(env, amount);
        Events::clawback(env, from, amount);
    }

    /// Upgrade the contract to new wasm
    pub fn upgrade(env: &Env, new_wasm_hash: BytesN<32>) {
        Self::require_admin(env);
        env.deployer().update_current_contract_wasm(new_wasm_hash);
    }

    /// Set the authorization status for a specific address
    pub fn set_authorized(env: &Env, id: &Address, authorize: bool) {
        Self::require_admin(env);
        AuthorizationStorage::set(env, id, authorize);
    }

    /// Get the authorization status for a specific address
    pub fn authorized(env: &Env, id: &Address) -> bool {
        AuthorizationStorage::get(env, id)
    }

    /// Transfer admin role to a new address. Current admin must authorize.
    pub fn set_admin(env: &Env, new_admin: &Address) {
        Self::require_admin(env);
        MetadataStorage::update_admin(env, new_admin);
    }
}
