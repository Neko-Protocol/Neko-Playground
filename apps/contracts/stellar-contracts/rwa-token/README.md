<h1 align="center">RWA Token Contract</h1>

<p align="center">
  <strong>Part of the <a href="https://github.com/Neko-Protocol">Neko Protocol</a> DeFi ecosystem on Stellar</strong>
</p>

A regulated fungible token contract for Real-World Assets (RWAs) on Stellar Soroban. This contract implements the **SEP-41 Token Interface** with **SEP-57 (T-REX) compatibility** for regulated token transfers, freeze enforcement, and delegated compliance. It powers the tokenized stocks and RWA trading on Neko Protocol.

## Neko Protocol Integration

This token is a core component of the Neko Protocol ecosystem:

```
┌─────────────────────────────────────────────────────────────────┐
│                      Neko Protocol                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌──────────────┐    prices    ┌──────────────┐               │
│   │  RWA Oracle  │─────────────▶│  RWA Token   │               │
│   │   (SEP-40)   │              │   (SEP-41)   │               │
│   └──────────────┘              └──────┬───────┘               │
│                                        │                        │
│                                        │ collateral / trading   │
│                                        │                        │
│                    ┌───────────────────┼───────────────────┐   │
│                    │                   │                   │   │
│                    ▼                   ▼                   ▼   │
│             ┌──────────────┐    ┌──────────────┐    ┌──────┐  │
│             │ RWA Lending  │    │  RWA Perps   │    │ Swap │  │
│             │  (Borrow)    │    │  (Futures)   │    │      │  │
│             └──────────────┘    └──────────────┘    └──────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

- **Dashboard**: Users view their RWA token holdings and portfolio value
- **Lending**: RWA tokens serve as collateral for borrowing
- **Swap**: Exchange RWA tokens via SoroSwap integration

## Standards Compliance

| Standard   | Description             | Implementation                                                                                                                          |
| ---------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **SEP-41** | Token Interface         | Full implementation (`transfer`, `transfer_from`, `approve`, `allowance`, `balance`, `burn`, `burn_from`, `decimals`, `name`, `symbol`) |
| **SEP-57** | Regulated Token (T-REX) | Freeze enforcement, delegated compliance via external contract, identity verifier configuration                                         |
| **SEP-40** | Oracle Integration      | Price queries via RWA Oracle contract import                                                                                            |

## Features

- **SEP-41 Token Interface**: Complete fungible token implementation
- **SEP-57 Compliance**: Freeze enforcement + delegated compliance checks
- **RWA Oracle Integration**: Query real-time prices and metadata from RWA Oracle
- **Total Supply Tracking**: Automatic tracking on mint/burn/clawback
- **Admin Controls**: Mint, clawback, freeze, upgrade
- **Allowance Helpers**: `increase_allowance` / `decrease_allowance` convenience functions
- **MuxedAddress Support**: Transfer function accepts muxed addresses

## Project Structure

```
src/
├── lib.rs              # Crate root, module declarations
├── contract.rs         # #[contract] RWATokenContract entry point
├── common/
│   ├── mod.rs
│   ├── error.rs        # Error enum (13 variants)
│   ├── events.rs       # Event types (mint, burn, transfer, approve, clawback)
│   ├── metadata.rs     # MetadataStorage (admin, token metadata)
│   └── types.rs        # DataKey, storage keys, TokenStorage
├── token/
│   ├── mod.rs
│   ├── interface.rs    # TokenInterface trait (SEP-41) + TokenInterfaceImpl
│   ├── balance.rs      # BalanceStorage
│   └── allowance.rs    # AllowanceStorage
├── compliance/
│   ├── mod.rs
│   ├── freeze.rs       # AuthorizationStorage + require_authorized guard
│   └── sep57.rs        # Compliance delegation + check_transfer
├── oracle/
│   └── mod.rs          # Oracle price/metadata queries
├── admin/
│   ├── mod.rs          # Admin operations
│   └── supply.rs       # TotalSupplyStorage
└── test/
    └── mod.rs          # 16 tests
```

## SEP-57 Compliance Model

This token implements SEP-57 (T-REX framework) with two layers of compliance, essential for regulated RWA trading:

### 1. Freeze Enforcement (Built-in)

Every address has an authorization status. Transfers are blocked if either sender or receiver is frozen:

```
transfer(from, to, amount)
    ├── require_authorized(from)  ← Sender must not be frozen
    ├── require_authorized(to)    ← Receiver must not be frozen
    └── execute transfer
```

### 2. Delegated Compliance (Optional)

When a compliance contract is configured, the token delegates transfer approval:

```
transfer(from, to, amount)
    ├── require_authorized(from)
    ├── require_authorized(to)
    ├── if compliance_contract configured:
    │   └── invoke compliance_contract.can_xfer(from, to, amount)
    │       └── if false → Error::ComplianceCheckFailed
    └── execute transfer
```

The compliance contract can implement any logic: KYC verification, transfer limits, jurisdiction checks, accredited investor requirements, etc.

## Constructor

```rust
pub fn __constructor(
    env: Env,
    admin: Address,              // Admin with mint/freeze/upgrade permissions
    asset_contract: Address,     // RWA Oracle contract address
    pegged_asset: Symbol,        // Asset symbol in oracle (e.g., "NVDA")
    name: String,                // Token name
    symbol: String,              // Token symbol
    decimals: u32,               // Decimal places
)
```

## Token Functions (SEP-41)

### Core Operations

```rust
// Transfer tokens (checks freeze + compliance)
token.transfer(&from, &to, &amount);

// Transfer using allowance (checks freeze + compliance)
token.transfer_from(&spender, &from, &to, &amount);

// Approve spender
token.approve(&from, &spender, &amount, &live_until_ledger);

// Get allowance
let allowance = token.allowance(&from, &spender);

// Get balance
let balance = token.balance(&address);

// Burn tokens
token.burn(&from, &amount);

// Burn using allowance
token.burn_from(&spender, &from, &amount);

// Token metadata
let name = token.name();
let symbol = token.symbol();
let decimals = token.decimals();
```

### Allowance Helpers

```rust
// Increase allowance (avoids race conditions)
token.increase_allowance(&from, &spender, &amount);

// Decrease allowance (floors at 0)
token.decrease_allowance(&from, &spender, &amount);

// Spendable balance (same as balance for this token)
let spendable = token.spendable_balance(&address);
```

## Admin Functions

```rust
// Mint tokens (updates total_supply)
token.mint(&to, &amount);

// Clawback tokens (updates total_supply)
token.clawback(&from, &amount);

// Freeze/unfreeze address
token.set_authorized(&address, &false);  // Freeze
token.set_authorized(&address, &true);   // Unfreeze

// Check authorization status
let is_authorized = token.authorized(&address);

// Get admin address
let admin = token.admin();

// Upgrade contract
token.upgrade(&new_wasm_hash);
```

## SEP-57 Configuration

```rust
// Set compliance contract (admin only)
token.set_compliance(&compliance_contract_address);

// Set identity verifier contract (admin only)
token.set_identity_verifier(&identity_contract_address);

// Query configured contracts
let compliance = token.compliance();           // Option<Address>
let identity = token.identity_verifier();      // Option<Address>

// Get total supply
let supply = token.total_supply();
```

## Oracle Integration

The token integrates with the RWA Oracle to provide real-time pricing for the Neko Protocol dashboard and DeFi features:

```rust
// Get current price from RWA Oracle
let price_data = token.get_price()?;
println!("Price: {} at {}", price_data.price, price_data.timestamp);

// Get price at specific timestamp
let historical = token.get_price_at(&timestamp)?;

// Get oracle decimals
let decimals = token.oracle_decimals()?;

// Get RWA metadata from oracle
let metadata = token.get_rwa_metadata()?;

// Get asset type
let asset_type = token.get_asset_type()?;

// Get oracle contract address
let oracle = token.asset_contract();

// Get pegged asset symbol
let pegged = token.pegged_asset();
```

## Error Codes

| Code | Name                     | Description                           |
| ---- | ------------------------ | ------------------------------------- |
| 1    | `InsufficientBalance`    | Balance too low for operation         |
| 2    | `NotInitialized`         | Contract not initialized              |
| 3    | `AlreadyInitialized`     | Contract already initialized          |
| 4    | `ValueNotPositive`       | Amount must be positive               |
| 5    | `CannotTransferToSelf`   | Cannot transfer to same address       |
| 6    | `InsufficientAllowance`  | Allowance too low                     |
| 7    | `ArithmeticError`        | Overflow/underflow in calculation     |
| 8    | `OraclePriceFetchFailed` | Failed to fetch price from oracle     |
| 9    | `AddressFrozen`          | Address is frozen (not authorized)    |
| 10   | `ComplianceCheckFailed`  | Compliance contract rejected transfer |
| 11   | `AllowanceExpired`       | Allowance has expired                 |
| 12   | `MetadataNotFound`       | RWA metadata not found in oracle      |
| 13   | `Unauthorized`           | Caller not authorized                 |

## Events

| Event      | Topics                       | Data                          |
| ---------- | ---------------------------- | ----------------------------- |
| `mint`     | `("mint", admin, to)`        | `amount`                      |
| `burn`     | `("burn", from)`             | `amount`                      |
| `transfer` | `("transfer", from, to)`     | `amount`                      |
| `approve`  | `("approve", from, spender)` | `(amount, live_until_ledger)` |
| `clawback` | `("clawback", admin, from)`  | `amount`                      |

## Usage Example

```rust
// Deploy NVDA token for Neko Protocol
let contract_id = env.register(
    RWATokenContract,
    (
        admin,
        oracle_address,
        Symbol::new(&env, "NVDA"),
        String::from_str(&env, "NVIDIA Token"),
        String::from_str(&env, "NVDA"),
        7u32,
    ),
);

let token = RWATokenContractClient::new(&env, &contract_id);

// Authorize addresses for transfers
token.set_authorized(&alice, &true);
token.set_authorized(&bob, &true);

// Mint tokens
token.mint(&alice, &1_000_0000000);  // 1000 tokens (7 decimals)
assert_eq!(token.total_supply(), 1_000_0000000);

// Transfer (both parties must be authorized)
token.transfer(&alice, &bob, &100_0000000);

// Freeze an address
token.set_authorized(&alice, &false);
// Now transfers from/to alice will fail with AddressFrozen

// Configure external compliance (optional)
token.set_compliance(&compliance_contract);
// Now transfers also check compliance_contract.can_xfer()

// Get price from oracle for dashboard display
if let Ok(price) = token.get_price() {
    println!("Current NVDA price: {}", price.price);
}
```

## Compliance Contract Interface

If you configure a compliance contract, it must implement:

```rust
fn can_xfer(from: Address, to: Address, amount: i128) -> bool
```

The token calls this via `env.invoke_contract()` with `symbol_short!("can_xfer")`.

## Testing

```bash
cargo test -p rwa-token
```

**Test coverage**: 16 tests covering token operations, freeze enforcement, allowances, total supply tracking, SEP-57 configuration, and oracle integration.

## Building

```bash
# Build oracle WASM first (required for token import)
cargo build --target wasm32v1-none --release -p rwa-oracle

# Build token WASM
cargo build --target wasm32v1-none --release -p rwa-token

# Output: target/wasm32v1-none/release/rwa_token.wasm
```

## Dependencies

The token contract imports the RWA Oracle WASM at compile time:

```rust
pub mod rwa_oracle {
    soroban_sdk::contractimport!(file = "../target/wasm32v1-none/release/rwa_oracle.wasm");
}
```

Build the oracle before building the token.

## Related Contracts

| Contract                      | Description                      | Relationship              |
| ----------------------------- | -------------------------------- | ------------------------- |
| [rwa-oracle](../rwa-oracle)   | SEP-40 price feed + RWA metadata | Token imports oracle WASM |
| [rwa-lending](../rwa-lending) | Lending/borrowing protocol       | Uses token as collateral  |

## License

MIT

---

<p align="center">
  Built with ❤️ by the <a href="https://github.com/Neko-Protocol">Neko Protocol</a> team
</p>
