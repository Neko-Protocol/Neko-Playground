use soroban_sdk::{contracttype, Address, String, Vec};

#[contracttype]
#[derive(Clone)]
pub struct ComplianceConfig {
    pub kyc_level: String,
    pub allowed_countries: Vec<String>,
    pub lockup_days: u32,
    pub max_investors: u32,
}

#[contracttype]
#[derive(Clone)]
pub struct IdentityRecord {
    pub verified: bool,
    pub kyc_level: String,
    pub country: String,
    pub verified_at: u64,
}

#[contracttype]
#[derive(Clone)]
pub struct TokenMetadata {
    pub name: String,
    pub symbol: String,
    pub decimals: u32,
}

#[contracttype]
pub enum DataKey {
    Admin,
    Issuer,
    Metadata,
    Compliance,
    TotalSupply,
    Balance(Address),
    Allowance(Address, Address),
    Identity(Address),
    Frozen(Address),
    HolderCount,
    PurchaseTime(Address),
}
