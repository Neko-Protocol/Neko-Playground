use soroban_sdk::{Address, Env};

use crate::types::{DataKey, Listing};

pub fn get_admin(env: &Env) -> Address {
    env.storage().instance().get(&DataKey::Admin).unwrap()
}

pub fn get_fee_address(env: &Env) -> Address {
    env.storage().instance().get(&DataKey::FeeAddress).unwrap()
}

pub fn get_fee_bps(env: &Env) -> i128 {
    env.storage()
        .instance()
        .get::<_, u32>(&DataKey::FeeBps)
        .unwrap_or(250) as i128
}

pub fn get_xlm_token(env: &Env) -> Address {
    env.storage().instance().get(&DataKey::XlmToken).unwrap()
}

pub fn get_listing(env: &Env, token_contract: &Address) -> Option<Listing> {
    env.storage()
        .persistent()
        .get(&DataKey::Listing(token_contract.clone()))
}

pub fn set_listing(env: &Env, token_contract: &Address, listing: &Listing) {
    env.storage()
        .persistent()
        .set(&DataKey::Listing(token_contract.clone()), listing);
}

pub fn remove_listing(env: &Env, token_contract: &Address) {
    env.storage()
        .persistent()
        .remove(&DataKey::Listing(token_contract.clone()));
}
