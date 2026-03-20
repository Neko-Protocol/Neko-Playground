<h1 align="center">RWA Oracle Contract</h1>

<p align="center">
  <strong>Part of the <a href="https://github.com/Neko-Protocol">Neko Protocol</a> DeFi ecosystem on Stellar</strong>
</p>

Oracle contract for Real-World Asset (RWA) metadata and price feeds on Stellar Soroban. This contract implements the **SEP-40 Oracle Consumer Interface** and extends it with comprehensive RWA metadata management, providing the price infrastructure for the Neko Protocol's lending and borrowing features.

## Neko Protocol Integration

This oracle is a core component of the Neko Protocol ecosystem:

```
┌─────────────────────────────────────────────────────────────────┐
│                      Neko Protocol                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌──────────────┐    prices    ┌──────────────┐               │
│   │  RWA Oracle  │─────────────▶│  RWA Token   │               │
│   │   (SEP-40)   │              │   (SEP-41)   │               │
│   └──────┬───────┘              └──────┬───────┘               │
│          │                             │                        │
│          │ prices + metadata           │ collateral             │
│          │                             │                        │
│          ▼                             ▼                        │
│                                     ┌──────────────┐           │
│                                     │ RWA Lending  │           │
│                                     │  (Borrow)    │           │
│                                     └──────────────┘           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

- **RWA Token** queries the oracle for real-time prices via `get_price()`
- **RWA Lending** uses oracle prices for collateralization calculations and liquidations

## Standards Compliance

| Standard         | Description               | Implementation                                                                                                           |
| ---------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **SEP-40**       | Oracle Consumer Interface | Full implementation of price feed functions (`lastprice`, `price`, `prices`, `assets`, `base`, `decimals`, `resolution`) |
| **SEP-40 Admin** | Oracle Admin Interface    | `add_assets`, `set_asset_price` for admin operations                                                                     |

## Features

- **SEP-40 Compatible**: Full implementation of the SEP-40 price feed interface
- **RWA Metadata Management**: Store and query comprehensive metadata for real-world assets
- **Asset Type Classification**: 9 asset types covering major RWA categories
- **Valuation Methods**: 6 valuation methodologies for different asset classes
- **Tokenization Tracking**: Link on-chain tokens to their underlying assets
- **Price History**: Maintains up to 1,000 price records per asset with automatic pruning
- **Staleness Configuration**: Configurable maximum age for price data
- **TTL Management**: Automatic extension of storage TTL on updates

## Project Structure

```
src/
├── lib.rs              # Crate root, Asset, PriceData, re-exports
├── contract.rs         # #[contract] RWAOracle entry point
├── common/
│   ├── mod.rs
│   ├── error.rs        # Error enum (8 variants)
│   ├── types.rs        # DataKey, storage keys, TTL constants
│   └── storage.rs      # RWAOracleStorage struct
├── rwa/
│   ├── mod.rs
│   └── types.rs        # RWAAssetType, ValuationMethod, TokenizationInfo, RWAMetadata
├── sep40/
│   ├── mod.rs
│   └── interface.rs    # IsSep40, IsSep40Admin traits
├── admin/
│   └── mod.rs          # Admin operations
└── test/
    └── mod.rs          # 27 tests
```

## RWA Asset Types

Assets supported by Neko Protocol:

| Type             | Description                               | Example                  |
| ---------------- | ----------------------------------------- | ------------------------ |
| `RealEstate`     | Commercial or residential real estate     | Tokenized property       |
| `Equity`         | Stocks, shares, or equity instruments     | NVDA, TSLA, AAPL tokens  |
| `Bond`           | Government or corporate bonds             | US Treasury tokens       |
| `Commodity`      | Physical commodities                      | Gold, oil, silver tokens |
| `Invoice`        | Trade receivables and invoice factoring   | Invoice NFTs             |
| `Fund`           | ETFs, mutual funds, or pooled investments | Index fund tokens        |
| `PrivateDebt`    | Private credit and loan instruments       | Private loan tokens      |
| `Infrastructure` | Infrastructure projects and utilities     | Solar farm tokens        |
| `Other`          | Any other RWA not covered above           | Custom assets            |

## Valuation Methods

| Method      | Description                                    | Use Case              |
| ----------- | ---------------------------------------------- | --------------------- |
| `Appraisal` | Professional third-party appraisal             | Real estate           |
| `Market`    | Market-based pricing (comparable sales/trades) | Equities, commodities |
| `Index`     | Index-linked pricing                           | Index funds           |
| `Oracle`    | On-chain oracle price feed                     | Crypto-backed RWAs    |
| `Nav`       | Net Asset Value calculation                    | Funds, ETFs           |
| `Other`     | Other valuation methodology                    | Custom methods        |

## Data Structures

### RWAMetadata

Complete on-chain metadata for an RWA:

```rust
pub struct RWAMetadata {
    pub asset_id: Symbol,                      // Asset identifier in the oracle
    pub name: String,                          // Human-readable name
    pub description: String,                   // Asset description
    pub asset_type: RWAAssetType,              // Classification
    pub underlying_asset: String,              // Underlying asset description
    pub issuer: Address,                       // Issuer address
    pub jurisdiction: Symbol,                  // ISO 3166-1 alpha-2 code
    pub tokenization_info: TokenizationInfo,   // Token details
    pub external_ids: Vec<(Symbol, String)>,   // ISIN, LEI, CUSIP, etc.
    pub legal_docs_uri: Option<String>,        // Legal documentation URI
    pub valuation_method: ValuationMethod,     // How the asset is valued
    pub metadata: Vec<(Symbol, String)>,       // Extensible key-value pairs
    pub created_at: u64,                       // Creation timestamp
    pub updated_at: u64,                       // Last update timestamp
}
```

### TokenizationInfo

Links on-chain tokens to underlying assets:

```rust
pub struct TokenizationInfo {
    pub token_contract: Option<Address>,       // Token contract address
    pub total_supply: Option<i128>,            // Total token supply
    pub underlying_asset_id: Option<String>,   // Off-chain asset identifier
    pub tokenization_date: Option<u64>,        // When tokenization occurred
}
```

### PriceData (SEP-40)

```rust
pub struct PriceData {
    pub price: i128,    // Asset price (use `decimals()` for precision)
    pub timestamp: u64, // Unix timestamp of the price
}
```

## Usage

### Initialization

```rust
// Deploy with constructor
let contract_id = env.register(
    RWAOracle,
    (
        admin,           // Admin address
        assets,          // Initial Vec<Asset> to track
        base_asset,      // Base asset for pricing (e.g., USDC)
        14u32,           // Decimals for price precision
        300u32,          // Resolution in seconds
    ),
);

let oracle = RWAOracleClient::new(&env, &contract_id);
```

### Register RWA Metadata

```rust
let metadata = RWAMetadata {
    asset_id: Symbol::new(&env, "NVDA"),
    name: String::from_str(&env, "NVIDIA Corporation Token"),
    description: String::from_str(&env, "Tokenized NVIDIA common stock"),
    asset_type: RWAAssetType::Equity,
    underlying_asset: String::from_str(&env, "NVDA Stock"),
    issuer: issuer_address,
    jurisdiction: Symbol::new(&env, "US"),
    tokenization_info: TokenizationInfo {
        token_contract: Some(token_address),
        total_supply: Some(1_000_000_0000000),
        underlying_asset_id: Some(String::from_str(&env, "NASDAQ:NVDA")),
        tokenization_date: Some(env.ledger().timestamp()),
    },
    external_ids: Vec::from_array(&env, [
        (Symbol::new(&env, "isin"), String::from_str(&env, "US67066G1040")),
    ]),
    legal_docs_uri: Some(String::from_str(&env, "https://issuer.example/docs/nvda.pdf")),
    valuation_method: ValuationMethod::Market,
    metadata: Vec::new(&env),
    created_at: env.ledger().timestamp(),
    updated_at: env.ledger().timestamp(),
};

oracle.set_rwa_metadata(&asset_id, &metadata);
```

### Price Feed Functions (SEP-40)

```rust
// Get the most recent price
let price_data = oracle.lastprice(&asset).unwrap();
println!("Price: {} at {}", price_data.price, price_data.timestamp);

// Get price at specific timestamp
let historical = oracle.price(&asset, &timestamp).unwrap();

// Get last N price records
let history = oracle.prices(&asset, &10).unwrap();

// Get all tracked assets
let assets = oracle.assets();

// Get base asset and decimals
let base = oracle.base();
let decimals = oracle.decimals();  // e.g., 14
```

### Admin Functions

```rust
// Set asset price (admin only)
oracle.set_asset_price(&asset, &price, &timestamp);

// Add new assets to track
oracle.add_assets(&new_assets);

// Configure max staleness (default: 24 hours)
oracle.set_max_staleness(&300);  // 5 minutes for active markets
oracle.set_max_staleness(&604_800);  // 7 days for real estate

// Upgrade contract
oracle.upgrade(&new_wasm_hash);
```

### Query Functions

```rust
// Get complete RWA metadata
let metadata = oracle.get_rwa_metadata(&asset_id)?;

// Get asset type
let asset_type = oracle.get_rwa_asset_type(&asset);

// Get tokenization info
let token_info = oracle.get_tokenization_info(&asset_id)?;

// Get all registered RWA asset IDs
let all_rwa_assets = oracle.get_all_rwa_assets();

// Resolve token contract to asset ID
let asset_id = oracle.get_asset_id_from_token(&token_address)?;

// Get max staleness configuration
let staleness = oracle.max_staleness();
```

## Price Validation

The oracle enforces strict price validation:

- **Positive prices only**: Zero and negative prices are rejected
- **Timestamp ordering**: New prices must have strictly increasing timestamps
- **Future drift limit**: Timestamps cannot be more than 5 minutes in the future
- **History limit**: Maintains up to 1,000 prices per asset, auto-pruning oldest

## Error Codes

| Code | Name                 | Description                        |
| ---- | -------------------- | ---------------------------------- |
| 1    | `AssetNotFound`      | Asset not registered in the oracle |
| 2    | `AssetAlreadyExists` | Asset already exists when adding   |
| 3    | `InvalidRWAType`     | Invalid RWA type specified         |
| 4    | `InvalidMetadata`    | Metadata validation failed         |
| 5    | `InvalidPrice`       | Price is zero or negative          |
| 6    | `Unauthorized`       | Caller is not authorized           |
| 7    | `TimestampInFuture`  | Timestamp too far in the future    |
| 8    | `TimestampTooOld`    | Timestamp not strictly increasing  |

## Testing

```bash
cargo test -p rwa-oracle
```

**Test coverage**: 27 tests covering initialization, metadata, price feeds, validation, history pruning, and TTL extension.

## Building

```bash
# Build WASM
cargo build --target wasm32v1-none --release -p rwa-oracle

# Output: target/wasm32v1-none/release/rwa_oracle.wasm
```

## Related Contracts

| Contract                      | Description                         | Dependency                           |
| ----------------------------- | ----------------------------------- | ------------------------------------ |
| [rwa-token](../rwa-token)     | SEP-41 token with SEP-57 compliance | Imports oracle WASM                  |
| [rwa-lending](../rwa-lending) | Lending/borrowing protocol          | Uses oracle for collateral valuation |

## License

MIT

---

<p align="center">
  Built with ❤️ by the <a href="https://github.com/Neko-Protocol">Neko Protocol</a> team
</p>
