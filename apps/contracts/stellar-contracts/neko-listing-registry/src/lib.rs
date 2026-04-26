#![no_std]

use soroban_sdk::{contract, contractimpl, token, Address, BytesN, Env, Symbol};

mod storage;
mod types;

use storage::*;
use types::*;

mod trex {
    use soroban_sdk::contractclient;

    #[contractclient(name = "TrexClient")]
    #[allow(dead_code)]
    pub trait TrexToken {
        fn can_transfer(
            env: soroban_sdk::Env,
            from: soroban_sdk::Address,
            to: soroban_sdk::Address,
            amount: i128,
        ) -> bool;
    }
}

mod reflector {
    use crate::types::{OracleAsset, PriceData};
    use soroban_sdk::contractclient;

    #[contractclient(name = "ReflectorClient")]
    #[allow(dead_code)]
    pub trait Reflector {
        fn lastprice(env: soroban_sdk::Env, asset: OracleAsset) -> Option<PriceData>;
        fn x_last_price(
            env: soroban_sdk::Env,
            base: OracleAsset,
            quote: OracleAsset,
        ) -> Option<PriceData>;
        fn decimals(env: soroban_sdk::Env) -> u32;
        fn base(env: soroban_sdk::Env) -> OracleAsset;
    }
}

#[contract]
pub struct NekoListingRegistry;

#[contractimpl]
impl NekoListingRegistry {
    pub fn initialize(
        env: Env,
        admin: Address,
        fee_address: Address,
        fee_bps: u32,
        xlm_token: Address,
    ) {
        assert!(
            env.storage()
                .instance()
                .get::<_, Address>(&DataKey::Admin)
                .is_none(),
            "already initialized"
        );
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::FeeAddress, &fee_address);
        env.storage().instance().set(&DataKey::FeeBps, &fee_bps);
        env.storage().instance().set(&DataKey::XlmToken, &xlm_token);
    }

    /// Register a listing on-chain. Tokens are NOT moved here — the issuer
    /// transfers them to `escrow_address` (Trustless Work) in a separate
    /// operation within the same atomic transaction.
    pub fn list(
        env: Env,
        issuer: Address,
        token_contract: Address,
        escrow_id: BytesN<32>,
        escrow_address: Address,
        amount: i128,
        pricing: Pricing,
    ) {
        issuer.require_auth();

        assert!(amount > 0, "amount must be positive");
        validate_pricing(&pricing);
        assert!(
            get_listing(&env, &token_contract).is_none(),
            "already listed - use top_up or withdraw first"
        );

        set_listing(
            &env,
            &token_contract,
            &Listing {
                issuer: issuer.clone(),
                token_contract: token_contract.clone(),
                escrow_id: escrow_id.clone(),
                escrow_address: escrow_address.clone(),
                available: amount,
                pricing,
                total_raised: 0,
            },
        );

        env.events().publish(
            (
                Symbol::new(&env, "listing_created"),
                issuer,
                token_contract,
            ),
            (escrow_id, escrow_address, amount),
        );
    }

    /// Buyer pays XLM directly to the issuer (+ fee to Neko) in one atomic call.
    /// Tokens are NOT released here — the backend triggers a Trustless Work
    /// `releaseMilestone` after observing the `buy_executed` event.
    pub fn buy(
        env: Env,
        buyer: Address,
        token_contract: Address,
        amount: i128,
        max_price_per_token: i128,
    ) {
        buyer.require_auth();

        let mut listing = get_listing(&env, &token_contract).expect("listing not found");
        assert!(amount > 0, "amount must be positive");
        assert!(listing.available >= amount, "insufficient supply");
        assert!(max_price_per_token > 0, "max_price must be positive");

        let trex = trex::TrexClient::new(&env, &token_contract);
        let compliant = trex.can_transfer(&listing.escrow_address, &buyer, &amount);
        assert!(
            compliant,
            "transfer not compliant: buyer not registered on the token"
        );

        let price = resolve_price(&env, &listing.pricing);
        assert!(price <= max_price_per_token, "slippage: price exceeds max");

        let total_xlm = amount.checked_mul(price).expect("xlm overflow");
        let fee_bps = get_fee_bps(&env);
        let fee_xlm = total_xlm * fee_bps / 10_000;
        let issuer_xlm = total_xlm - fee_xlm;

        let xlm = token::Client::new(&env, &get_xlm_token(&env));
        xlm.transfer(&buyer, &listing.issuer, &issuer_xlm);
        if fee_xlm > 0 {
            xlm.transfer(&buyer, &get_fee_address(&env), &fee_xlm);
        }

        listing.available -= amount;
        listing.total_raised += issuer_xlm;
        let escrow_id = listing.escrow_id.clone();
        let issuer_addr = listing.issuer.clone();
        set_listing(&env, &token_contract, &listing);

        env.events().publish(
            (Symbol::new(&env, "buy_executed"), issuer_addr, token_contract),
            (buyer, amount, price, escrow_id),
        );
    }

    /// Close the listing in the registry. The actual return of remaining
    /// tokens from the TW escrow back to the issuer is performed server-side
    /// via the TW `cancel` API once this event is observed.
    pub fn withdraw(env: Env, issuer: Address, token_contract: Address) {
        issuer.require_auth();
        let listing = get_listing(&env, &token_contract).expect("listing not found");
        assert!(listing.issuer == issuer, "not the issuer");

        env.events().publish(
            (
                Symbol::new(&env, "listing_closed"),
                issuer,
                token_contract.clone(),
            ),
            (listing.escrow_id, listing.available),
        );
        remove_listing(&env, &token_contract);
    }

    /// Add more tokens to an existing listing. Like `list`, the actual token
    /// transfer to the escrow is a separate atomic op in the same tx.
    pub fn top_up(env: Env, issuer: Address, token_contract: Address, amount: i128) {
        issuer.require_auth();
        let mut listing = get_listing(&env, &token_contract).expect("listing not found");
        assert!(listing.issuer == issuer, "not the issuer");
        assert!(amount > 0, "amount must be positive");

        listing.available += amount;
        let new_total = listing.available;
        set_listing(&env, &token_contract, &listing);

        env.events().publish(
            (
                Symbol::new(&env, "listing_topped_up"),
                issuer,
                token_contract,
            ),
            (amount, new_total),
        );
    }

    pub fn get_listing(env: Env, token_contract: Address) -> Option<Listing> {
        get_listing(&env, &token_contract)
    }

    /// Resolve the current effective price (in XLM stroops per token base unit).
    /// Useful for the marketplace UI to display live oracle prices.
    pub fn current_price(env: Env, token_contract: Address) -> i128 {
        let listing = get_listing(&env, &token_contract).expect("listing not found");
        resolve_price(&env, &listing.pricing)
    }

    pub fn get_admin(env: Env) -> Address {
        storage::get_admin(&env)
    }

    pub fn get_fee_address(env: Env) -> Address {
        storage::get_fee_address(&env)
    }

    pub fn get_fee_bps(env: Env) -> i128 {
        storage::get_fee_bps(&env)
    }
}

fn validate_pricing(pricing: &Pricing) {
    match pricing {
        Pricing::Fixed(p) => assert!(*p > 0, "fixed price must be positive"),
        Pricing::Oracle(cfg) => {
            assert!(cfg.max_staleness_secs > 0, "staleness must be positive");
            assert!(
                cfg.premium_bps > -10_000 && cfg.premium_bps < 10_000,
                "premium_bps out of range"
            );
            if let OracleMethod::CrossPrice = cfg.method {
                assert!(cfg.quote.is_some(), "cross price requires a quote asset");
            }
        }
    }
}

fn resolve_price(env: &Env, pricing: &Pricing) -> i128 {
    match pricing {
        Pricing::Fixed(p) => *p,
        Pricing::Oracle(cfg) => {
            let client = reflector::ReflectorClient::new(env, &cfg.oracle);
            let oracle_dec = client.decimals();
            let data = match cfg.method {
                OracleMethod::LastPrice => client.lastprice(&cfg.base),
                OracleMethod::CrossPrice => {
                    let q = cfg.quote.clone().expect("oracle: quote required");
                    client.x_last_price(&cfg.base, &q)
                }
            }
            .expect("oracle: no price available");

            let now = env.ledger().timestamp();
            assert!(
                now.saturating_sub(data.timestamp) <= cfg.max_staleness_secs,
                "oracle: stale price"
            );

            let stroop_dec: u32 = 7;
            let raw = if oracle_dec >= stroop_dec {
                data.price / 10i128.pow(oracle_dec - stroop_dec)
            } else {
                data.price
                    .checked_mul(10i128.pow(stroop_dec - oracle_dec))
                    .expect("decimal scale overflow")
            };
            let with_premium = raw + raw * (cfg.premium_bps as i128) / 10_000;
            assert!(with_premium > 0, "oracle: non-positive effective price");
            with_premium
        }
    }
}
