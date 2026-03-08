use soroban_sdk::{contract, contractimpl, vec, Address, Env, IntoVal, Symbol, Vec};

use crate::storage::Storage;
use crate::types::MintRequest;

#[contract]
pub struct Faucet;

#[contractimpl]
impl Faucet {
    /// Initialize the faucet with an admin address.
    /// The admin must be the same account that controls the rwa-token contracts.
    pub fn initialize(env: Env, admin: Address) {
        assert!(!Storage::is_initialized(&env), "Faucet: already initialized");
        admin.require_auth();
        Storage::set_admin(&env, &admin);
        Storage::set_initialized(&env);
    }

    /// Mint multiple tokens in a single invocation (permissionless on testnet).
    /// The faucet contract must be the admin of each token contract so that
    /// cross-contract calls to set_authorized and mint are auto-authorized.
    pub fn bulk_mint(env: Env, requests: Vec<MintRequest>) {
        for req in requests.iter() {
            env.invoke_contract::<()>(
                &req.token,
                &Symbol::new(&env, "set_authorized"),
                vec![&env, req.to.into_val(&env), true.into_val(&env)],
            );
            env.invoke_contract::<()>(
                &req.token,
                &Symbol::new(&env, "mint"),
                vec![&env, req.to.into_val(&env), req.amount.into_val(&env)],
            );
        }
    }

    /// Return the admin address.
    pub fn admin(env: Env) -> Address {
        Storage::get_admin(&env)
    }
}
