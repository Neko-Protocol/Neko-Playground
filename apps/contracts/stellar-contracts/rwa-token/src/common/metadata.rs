use soroban_sdk::{panic_with_error, Address, Env, String};

use crate::common::error::Error;
use crate::common::types::{TokenStorage, STORAGE, ADMIN_KEY};

/// Token metadata and admin storage operations
pub struct MetadataStorage;

impl MetadataStorage {
    pub fn get_admin(env: &Env) -> Option<Address> {
        env.storage().instance().get(&ADMIN_KEY)
    }

    pub fn set_admin(env: &Env, admin: &Address) {
        if env.storage().instance().has(&ADMIN_KEY) {
            panic!("admin already set");
        }
        env.storage().instance().set(&ADMIN_KEY, admin);
    }

    pub fn update_admin(env: &Env, new_admin: &Address) {
        env.storage().instance().set(&ADMIN_KEY, new_admin);
    }

    pub fn get_token(env: &Env) -> TokenStorage {
        env.storage()
            .instance()
            .get(&STORAGE)
            .unwrap_or_else(|| panic_with_error!(env, Error::NotInitialized))
    }

    pub fn set_token(env: &Env, storage: &TokenStorage) {
        env.storage().instance().set(&STORAGE, storage);
    }

    pub fn is_initialized(env: &Env) -> bool {
        env.storage().instance().has(&STORAGE)
    }

    // Convenience getters
    pub fn get_name(env: &Env) -> String {
        Self::get_token(env).name
    }

    pub fn get_symbol(env: &Env) -> String {
        Self::get_token(env).symbol
    }

    pub fn get_decimals(env: &Env) -> u32 {
        Self::get_token(env).decimals
    }

    pub fn get_asset_contract(env: &Env) -> Address {
        Self::get_token(env).asset_contract
    }

    pub fn get_pegged_asset(env: &Env) -> soroban_sdk::Symbol {
        Self::get_token(env).pegged_asset
    }
}
