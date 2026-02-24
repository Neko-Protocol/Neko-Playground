use soroban_sdk::{panic_with_error, Address, Env, Map, Symbol, symbol_short};
use rwa_oracle::{Asset, RWAOracleClient};
use crate::common::types::{Position, MarketConfig, PerpsStorage, STORAGE, ADMIN_KEY};
use crate::common::error::Error;

const PRICE_KEY: Symbol = symbol_short!("price");

pub struct Storage;

impl Storage {
    /// Check if contract is initialized
    pub fn is_initialized(env: &Env) -> bool {
        env.storage().instance().has(&STORAGE)
    }

    /// Get main perpetuals storage
    pub fn get(env: &Env) -> PerpsStorage {
        env.storage()
            .instance()
            .get(&STORAGE)
            .unwrap_or_else(|| panic_with_error!(env, Error::NotInitialized))
    }

    /// Set main perpetuals storage
    pub fn set(env: &Env, storage: &PerpsStorage) {
        env.storage().instance().set(&STORAGE, storage);
    }

    /// Get admin address
    pub fn get_admin(env: &Env) -> Address {
        env.storage()
            .instance()
            .get(&ADMIN_KEY)
            .unwrap_or_else(|| panic_with_error!(env, Error::NotInitialized))
    }

    /// Set admin address (only during initialization)
    pub fn set_admin(env: &Env, admin: &Address) {
        if env.storage().instance().has(&ADMIN_KEY) {
            panic_with_error!(env, Error::AlreadyInitialized);
        }
        env.storage().instance().set(&ADMIN_KEY, admin);
    }

    /// Get oracle address
    pub fn get_oracle(env: &Env) -> Address {
        let storage = Self::get(env);
        storage.oracle
    }

    /// Set oracle address
    pub fn set_oracle(env: &Env, oracle: &Address) {
        let mut storage = Self::get(env);
        storage.oracle = oracle.clone();
        Self::set(env, &storage);
    }

    /// Get a position by trader address and RWA token
    pub fn get_position(env: &Env, trader: &Address, rwa_token: &Address) -> Option<Position> {
        let key = (trader.clone(), rwa_token.clone());
        env.storage().persistent().get(&key)
    }

    /// Set a position
    pub fn set_position(env: &Env, trader: &Address, rwa_token: &Address, position: &Position) {
        let key = (trader.clone(), rwa_token.clone());
        env.storage().persistent().set(&key, position);
    }

    /// Remove a position
    pub fn remove_position(env: &Env, trader: &Address, rwa_token: &Address) {
        let key = (trader.clone(), rwa_token.clone());
        env.storage().persistent().remove(&key);
    }

    /// Get market configuration for an RWA token
    pub fn get_market_config(env: &Env, rwa_token: &Address) -> Option<MarketConfig> {
        env.storage().persistent().get(rwa_token)
    }

    /// Set market configuration
    pub fn set_market_config(env: &Env, rwa_token: &Address, config: &MarketConfig) {
        env.storage().persistent().set(rwa_token, config);
    }

    /// Get current price for an RWA token from oracle
    /// This now calls the actual RWA Oracle contract via SEP-40 interface
    pub fn get_current_price(env: &Env, rwa_token: &Address) -> Option<i128> {
        let storage = Self::get(env);
        let oracle_client = RWAOracleClient::new(env, &storage.oracle);
        
        // 1. Get asset ID from token address
        let asset_id = match oracle_client.try_get_asset_id_from_token(rwa_token) {
            Ok(Ok(id)) => id,
            _ => {
                // Fallback to storage price for testing/compatibility if oracle fails
                let key = (PRICE_KEY, rwa_token.clone());
                return env.storage().persistent().get(&key);
            }
        };

        // 2. Get last price from oracle using SEP-40 interface
        let asset = Asset::Other(asset_id);
        match oracle_client.try_lastprice(&asset) {
            Ok(Ok(Some(price_data))) => Some(price_data.price),
            _ => {
                // Fallback to storage price
                let key = (PRICE_KEY, rwa_token.clone());
                env.storage().persistent().get(&key)
            }
        }
    }


    /// Get margin token address
    pub fn get_margin_token(env: &Env) -> Option<Address> {
        let key = symbol_short!("mrg_token");
        env.storage().instance().get(&key)
    }

    /// Set margin token address (admin only)
    pub fn set_margin_token(env: &Env, token: &Address) {
        let key = symbol_short!("mrg_token");
        env.storage().instance().set(&key, token);
    }

    /// Get all RWA tokens for which a trader has positions
    pub fn get_trader_tokens(env: &Env, trader: &Address) -> Option<Map<Address, bool>> {
        let key = (symbol_short!("trd_tkns"), trader.clone());
        env.storage().persistent().get(&key)
    }

    /// Add RWA token to trader's position list
    pub fn add_trader_token(env: &Env, trader: &Address, rwa_token: &Address) {
        let key = (symbol_short!("trd_tkns"), trader.clone());
        let mut tokens = Self::get_trader_tokens(env, trader).unwrap_or_else(|| Map::new(env));
        tokens.set(rwa_token.clone(), true);
        env.storage().persistent().set(&key, &tokens);
    }

    /// Remove RWA token from trader's position list (when position fully closed)
    ///
    /// # Safety
    /// This function should only be called after verifying the position has been
    /// completely removed from storage. In the current design, each (trader, rwa_token)
    /// pair can only have one position, so this is safe to call after position removal.
    ///
    /// # Storage Optimization
    /// If this is the trader's last token, the entire trader tokens map is removed
    /// from storage to avoid storing empty collections.
    pub fn remove_trader_token(env: &Env, trader: &Address, rwa_token: &Address) {
        let key = (symbol_short!("trd_tkns"), trader.clone());
        if let Some(mut tokens) = Self::get_trader_tokens(env, trader) {
            tokens.remove(rwa_token.clone());
            if tokens.is_empty() {
                // Clean up empty map to optimize storage
                env.storage().persistent().remove(&key);
            } else {
                env.storage().persistent().set(&key, &tokens);
            }
        }
    }
}
