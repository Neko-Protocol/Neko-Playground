use soroban_sdk::{contracttype, Address, Env};

#[contracttype]
enum DataKey {
    Admin,
    Initialized,
}

pub struct Storage;

impl Storage {
    pub fn set_admin(env: &Env, admin: &Address) {
        env.storage().instance().set(&DataKey::Admin, admin);
    }

    pub fn get_admin(env: &Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("Faucet: admin not set")
    }

    pub fn set_initialized(env: &Env) {
        env.storage().instance().set(&DataKey::Initialized, &true);
    }

    pub fn is_initialized(env: &Env) -> bool {
        env.storage()
            .instance()
            .get(&DataKey::Initialized)
            .unwrap_or(false)
    }
}
