use soroban_sdk::{contracttype, Address, BytesN, Symbol};

#[contracttype]
#[derive(Clone)]
pub enum OracleAsset {
    Stellar(Address),
    Other(Symbol),
}

#[contracttype]
#[derive(Clone)]
pub enum OracleMethod {
    LastPrice,
    CrossPrice,
}

#[contracttype]
#[derive(Clone)]
pub struct OracleConfig {
    pub oracle: Address,
    pub method: OracleMethod,
    pub base: OracleAsset,
    pub quote: Option<OracleAsset>,
    pub premium_bps: i32,
    pub max_staleness_secs: u64,
}

#[contracttype]
#[derive(Clone)]
pub enum Pricing {
    Fixed(i128),
    Oracle(OracleConfig),
}

#[contracttype]
#[derive(Clone)]
pub struct PriceData {
    pub price: i128,
    pub timestamp: u64,
}

#[contracttype]
#[derive(Clone)]
pub struct Listing {
    pub issuer: Address,
    pub token_contract: Address,
    pub escrow_id: BytesN<32>,
    pub escrow_address: Address,
    pub available: i128,
    pub pricing: Pricing,
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
