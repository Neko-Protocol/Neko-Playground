use soroban_sdk::{Address, Env};

use crate::types::{ComplianceConfig, DataKey, IdentityRecord, TokenMetadata};

pub fn get_admin(env: &Env) -> Address {
    env.storage().instance().get(&DataKey::Admin).unwrap()
}

pub fn get_issuer(env: &Env) -> Address {
    env.storage().instance().get(&DataKey::Issuer).unwrap()
}

pub fn get_compliance(env: &Env) -> ComplianceConfig {
    env.storage().instance().get(&DataKey::Compliance).unwrap()
}

pub fn get_metadata(env: &Env) -> TokenMetadata {
    env.storage().instance().get(&DataKey::Metadata).unwrap()
}

pub fn get_balance(env: &Env, address: &Address) -> i128 {
    env.storage()
        .persistent()
        .get(&DataKey::Balance(address.clone()))
        .unwrap_or(0)
}

pub fn set_balance(env: &Env, address: &Address, amount: i128) {
    env.storage()
        .persistent()
        .set(&DataKey::Balance(address.clone()), &amount);
}

pub fn get_total_supply(env: &Env) -> i128 {
    env.storage().instance().get(&DataKey::TotalSupply).unwrap_or(0)
}

pub fn set_total_supply(env: &Env, supply: i128) {
    env.storage().instance().set(&DataKey::TotalSupply, &supply);
}

pub fn get_identity(env: &Env, address: &Address) -> Option<IdentityRecord> {
    env.storage()
        .persistent()
        .get(&DataKey::Identity(address.clone()))
}

pub fn set_identity(env: &Env, address: &Address, record: &IdentityRecord) {
    env.storage()
        .persistent()
        .set(&DataKey::Identity(address.clone()), record);
}

pub fn is_frozen(env: &Env, address: &Address) -> bool {
    env.storage()
        .persistent()
        .get(&DataKey::Frozen(address.clone()))
        .unwrap_or(false)
}

pub fn get_holder_count(env: &Env) -> u32 {
    env.storage().instance().get(&DataKey::HolderCount).unwrap_or(0)
}

pub fn set_holder_count(env: &Env, count: u32) {
    env.storage().instance().set(&DataKey::HolderCount, &count);
}

pub fn get_purchase_time(env: &Env, address: &Address) -> u64 {
    env.storage()
        .persistent()
        .get(&DataKey::PurchaseTime(address.clone()))
        .unwrap_or(0)
}

pub fn set_purchase_time(env: &Env, address: &Address, time: u64) {
    env.storage()
        .persistent()
        .set(&DataKey::PurchaseTime(address.clone()), &time);
}

pub fn get_allowance(env: &Env, from: &Address, spender: &Address) -> i128 {
    env.storage()
        .persistent()
        .get(&DataKey::Allowance(from.clone(), spender.clone()))
        .unwrap_or(0)
}

pub fn set_allowance(env: &Env, from: &Address, spender: &Address, amount: i128) {
    env.storage().persistent().set(
        &DataKey::Allowance(from.clone(), spender.clone()),
        &amount,
    );
}
