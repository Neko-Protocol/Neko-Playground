use soroban_sdk::{Address, Env};

use crate::storage::{get_identity, set_identity};
use crate::types::IdentityRecord;

pub fn add_verified_identity(env: &Env, address: &Address, record: IdentityRecord) {
    set_identity(env, address, &record);
}

pub fn revoke_identity(env: &Env, address: &Address) {
    if let Some(mut record) = get_identity(env, address) {
        record.verified = false;
        set_identity(env, address, &record);
    }
}
