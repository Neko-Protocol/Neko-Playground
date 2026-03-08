use soroban_sdk::{contracttype, Address};

#[contracttype]
#[derive(Clone, Debug)]
pub struct MintRequest {
    pub token: Address,
    pub to: Address,
    pub amount: i128,
}
