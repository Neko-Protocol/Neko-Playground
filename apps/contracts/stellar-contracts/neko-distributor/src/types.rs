use soroban_sdk::{contracttype, Address};

#[contracttype]
#[derive(Clone)]
pub struct Listing {
    pub issuer: Address,
    pub token_contract: Address,
    pub available: i128,
    pub price_per_token: i128,
    pub total_raised: i128,
}

#[contracttype]
pub enum DataKey {
    Admin,
    FeeAddress,
    FeeBps,
    XlmToken,
    Listing(Address),
}
