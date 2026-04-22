use soroban_sdk::{Env, Address};

use crate::storage::get_admin;
use crate::types::DataKey;

pub fn require_admin(env: &Env, caller: &Address) {
    let admin = get_admin(env);
    if caller != &admin {
        panic!("not admin");
    }
}

pub fn freeze_address(env: &Env, address: &Address) {
    env.storage()
        .persistent()
        .set(&DataKey::Frozen(address.clone()), &true);
}

pub fn unfreeze_address(env: &Env, address: &Address) {
    env.storage()
        .persistent()
        .set(&DataKey::Frozen(address.clone()), &false);
}
