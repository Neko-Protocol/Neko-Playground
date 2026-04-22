# neko-distributor

Soroban contract: trustless escrow for T-REX token listings, atomic XLM purchase with fee split.

## Build

From `apps/contracts/stellar-contracts/`:

```bash
cargo build -p neko-distributor --target wasm32v1-none --release
```

WASM output: `target/wasm32v1-none/release/neko_distributor.wasm`

If your environment redirects Cargo’s target directory, set:

```bash
export CARGO_TARGET_DIR="$(pwd)/target"
```

## Deploy once (Stellar testnet)

1. Fund the Neko admin account (Friendbot).
2. Upload WASM and deploy a contract instance (Stellar CLI or SDK).
3. Call `initialize(admin, fee_address, fee_bps, xlm_token)`:
   - `admin`: Neko admin `G...` (same as `NEKO_ADMIN_PUBLIC_KEY` in issuer-portal).
   - `fee_address`: address receiving protocol fees.
   - `fee_bps`: e.g. `250` for 2.5%.
   - `xlm_token`: native XLM SAC on testnet: `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC`.

4. Put the deployed contract id in `NEXT_PUBLIC_NEKO_DISTRIBUTOR_CONTRACT_ID`.
