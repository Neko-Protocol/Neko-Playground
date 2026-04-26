# neko-listing-registry

Decentralized listing + buy authorizer for Neko v2.

This contract is deliberately slim. It does **NOT** custody any tokens — tokens
sit in a Trustless Work escrow address chosen at listing time. The contract:

1. Persists listing metadata (issuer, token, escrow id/address, pricing).
2. Authorizes buys, charges the buyer XLM (issuer cut + Neko fee), and emits
   `buy_executed` events that the Neko backend listens to in order to
   trigger the matching `releaseMilestone` on Trustless Work.
3. Supports static (`Fixed`) or dynamic (`Oracle` via Reflector / SEP-40)
   pricing per listing, with slippage protection (`max_price_per_token`).

## Build

```bash
cargo build --package neko-listing-registry --target wasm32v1-none --release
```

The WASM lands at:

```
apps/contracts/stellar-contracts/target/wasm32v1-none/release/neko_listing_registry.wasm
```

Copy it to the portal's public folder for client-side deployment uploads:

```bash
cp apps/contracts/stellar-contracts/target/wasm32v1-none/release/neko_listing_registry.wasm \
   apps/issuer-portal/public/neko-listing-registry.wasm
```

## Deploy & initialize (testnet)

```bash
WASM=apps/contracts/stellar-contracts/target/wasm32v1-none/release/neko_listing_registry.wasm

WASM_HASH=$(stellar contract upload \
  --source neko-admin \
  --network testnet \
  --wasm "$WASM")

CONTRACT_ID=$(stellar contract deploy \
  --source neko-admin \
  --network testnet \
  --wasm-hash "$WASM_HASH")

stellar contract invoke \
  --source neko-admin \
  --network testnet \
  --id "$CONTRACT_ID" \
  -- initialize \
  --admin       <NEKO_ADMIN_ADDRESS> \
  --fee_address <NEKO_FEE_ADDRESS> \
  --fee_bps     250 \
  --xlm_token   CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC
```

`xlm_token` is the Stellar Asset Contract (SAC) for native XLM on testnet.

## Public API

| Method                                                            | Auth     | Notes                                                                               |
| ----------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------- |
| `initialize(admin, fee_address, fee_bps, xlm_token)`              | one-shot | Idempotent guard.                                                                   |
| `list(issuer, token, escrow_id, escrow_address, amount, pricing)` | issuer   | Pure registration. Pair with a token `transfer` to `escrow_address` in the same tx. |
| `buy(buyer, token, amount, max_price_per_token)`                  | buyer    | Charges XLM, emits `buy_executed`. Slippage protected.                              |
| `withdraw(issuer, token)`                                         | issuer   | Removes the listing; backend cancels the escrow.                                    |
| `top_up(issuer, token, amount)`                                   | issuer   | Pair with a token transfer to the escrow.                                           |
| `get_listing(token) -> Option<Listing>`                           | view     | Listing snapshot.                                                                   |
| `current_price(token) -> i128`                                    | view     | Effective stroops/token (resolves oracle if any).                                   |
| `get_admin()` / `get_fee_address()` / `get_fee_bps()`             | view     | Config getters.                                                                     |

## `Pricing`

```rust
enum Pricing {
    Fixed(i128),                   // stroops per token base unit
    Oracle(OracleConfig),
}

struct OracleConfig {
    oracle: Address,                  // any SEP-40 oracle (Reflector recommended)
    method: OracleMethod,             // LastPrice | CrossPrice
    base: OracleAsset,                // Stellar(Address) | Other(Symbol)
    quote: Option<OracleAsset>,       // required if method == CrossPrice
    premium_bps: i32,                 // +500 = +5%, -300 = -3% discount
    max_staleness_secs: u64,
}
```

Reflector testnet oracles (drop into the `oracle` field):

| Oracle           | Address                                                    | Base |
| ---------------- | ---------------------------------------------------------- | ---- |
| Stellar Pubnet   | `CAVLP5DH2GJPZMVO7IJY4CVOD5MWEFTJFVPD2YY2FQXOQHRGHK4D6HLP` | XLM  |
| External CEX/DEX | `CCYOZJCOPG34LLQQ7N24YXBM7LL62R7ONMZ3G6WZAAYPB5OYKOMJRN63` | USD  |
| Foreign Exchange | `CCSSOHTBL3LEWUCBBEB5NJFC2OKFRC74OWEIJIZLRJBGAAU4VMU5NV4W` | USD  |

If the oracle's base is not XLM, use `CrossPrice` with `quote = Other(Symbol("XLM"))`.

## Events

| Topic[0]            | Topic[1] | Topic[2] | Data                                     |
| ------------------- | -------- | -------- | ---------------------------------------- |
| `listing_created`   | issuer   | token    | `(escrow_id, escrow_address, amount)`    |
| `buy_executed`      | issuer   | token    | `(buyer, amount, price_used, escrow_id)` |
| `listing_topped_up` | issuer   | token    | `(amount, new_available)`                |
| `listing_closed`    | issuer   | token    | `(escrow_id, remaining_available)`       |
