# Security Policy

## Supported Versions

The current development branch (`dev`) receives security fixes. There is no versioned release yet.

## Reporting a Vulnerability

Open a [GitHub Security Advisory](https://github.com/Neko-Protocol/Neko-DApp/security/advisories/new) (private disclosure). Do not file a public issue that includes reproduction steps or exploit details.

You can expect an acknowledgement within 48 hours and a status update within 7 days.

---

## Key Inventory

All server-side signing keys must be stored in environment variables, never in source files. The pre-commit hook and CI scan will reject any commit or PR containing a Stellar secret key literal (`S[A-Z2-7]{55}`).

| Environment Variable | Role | Capability | Storage |
|---|---|---|---|
| `VAULT_MANAGER_SECRET_KEY` | Vault Manager | `rebalance`, `report`, `lock_fees`, `distribute_fees` | Vercel env (all environments) |
| `ORACLE_UPDATER_SECRET_KEY` | Oracle Admin | Push collateral/debt prices | CI secret + local `.env` only |
| `DEPLOY_ADMIN_SECRET_KEY` | Deploy / Upgrade Admin | Deploy contracts, upgrade WASM, transfer admin roles | Local only — **never in CI or server env** |
| `FAUCET_SECRET_KEY` | Faucet Admin | Mint testnet tokens | Vercel env (testnet only) |

> **Before mainnet:** `DEPLOY_ADMIN_SECRET_KEY` and `ORACLE_UPDATER_SECRET_KEY` must be
> transferred to a multi-signature account (Stellar threshold 2/3 among core team keys).
> `VAULT_MANAGER_SECRET_KEY` should also move to a dedicated sub-account with no deploy authority.

---

## Cron Endpoint Authentication (`CRON_SECRET`)

`POST /api/vault/invest` is the Vercel cron job that runs the daily vault invest cycle. It is authenticated with a Bearer token derived from `CRON_SECRET`.

- Minimum length: 32 characters.
- Generate: `openssl rand -base64 32`
- The app **refuses to start** if this variable is absent or under 32 characters.
- Set it in the Vercel project environment **before** deploying.
- Vercel automatically injects `Authorization: Bearer <CRON_SECRET>` when executing registered cron routes.
- To rotate: generate a new value, update Vercel env, redeploy.

---

## Secret Scanning

Two layers prevent secret literals from entering the repository:

**Pre-commit hook** (`.husky/pre-commit`)
Blocks any commit where a staged file matches `S[A-Z2-7]{55}`.

**CI scan** (`.github/workflows/ci.yml` — `secret-scan` job)
Runs `git grep` against all tracked files on every PR and push to `dev`. The `verify` job depends on `secret-scan`, so a PR with a secret literal cannot pass CI.

---

## Oracle Contract ID

The canonical oracle contract used by the frontend is:

```
CDJVAFSJTERWPYEZQJGN2N5N4BMXGMG6A2AWQK4C3V36MRYB4PRSNM2S
```

All scripts in `scripts/` must target the same address via the `ORACLE_CONTRACT_ID` environment variable. If you are updating the oracle contract, update both the env var and `apps/web-app/src/lib/constants/contracts.ts` atomically.

---

## Pre-Mainnet Checklist

- [ ] Generate fresh keypairs for `VAULT_MANAGER`, `ORACLE_UPDATER`, `DEPLOY_ADMIN`
- [ ] Transfer all on-chain admin roles off the legacy key `GDEQD7CITHS4AINJTA4VSACHOXK6ZOY6WTFUNLRHXTCLZXZ5TI4Y7Y5X`
- [ ] Verify `git grep -nE '\bS[A-Z2-7]{55}\b' -- .` returns no results
- [ ] Confirm `CRON_SECRET` is set in Vercel for all environments
- [ ] Provision Vercel KV for the durable invest lock and faucet rate limiting
- [ ] Move `DEPLOY_ADMIN_SECRET_KEY` to hardware wallet or multi-sig
- [ ] Set up multi-sig for oracle updater authority
- [ ] Confirm both app and scripts reference the same `ORACLE_CONTRACT_ID`
