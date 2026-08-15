# Security Model

## Wallet authentication (anchor & automation APIs)

Ramp and automation endpoints require a server-issued session established through a Stellar signed-challenge flow:

1. `POST /api/auth/challenge` — issues a single-use nonce and domain-bound message.
2. The client signs the message with the connected wallet.
3. `POST /api/auth/verify` — verifies the Ed25519 signature and sets an HttpOnly session cookie (`neko_session`).

Cookie flags: `httpOnly`, `secure` (production), `sameSite=strict`, `path=/`, `maxAge=3600`.

## Authorization

Customer-scoped anchor routes enforce ownership via a server-side binding:

```
(provider, customerId) → publicKey
```

Bindings are written when a customer is created through `POST /api/anchor/[provider]/customers`. Unknown bindings **fail closed** (403).

On/off-ramp transaction reads require a matching transaction binding created at order creation time.

## Defence in depth

- Next.js middleware returns `401` for `/api/anchor/*` and `/api/automation/*` without a session cookie.
- Each route also calls `requireSession()` and resource-level checks before upstream anchor calls.
- Per-IP and per-session rate limits return `429` before anchor quota is consumed.

## Admin UI (separate concern)

`/dashboard/admin` uses the `neko-stellar-address` cookie as a **UX routing hint only**. It is not cryptographic proof of wallet ownership. Privileged on-chain mutations remain the real boundary.

## Required secrets

| Variable | Purpose |
|----------|---------|
| `UPSTASH_REDIS_REST_URL` | Nonces, sessions metadata, ownership bindings, rate limits |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash auth |
| `AUTH_SESSION_SECRET` | HMAC signing key for session cookies (≥ 32 chars) |
| `AUTH_ENFORCEMENT` | Set `false` only for local dev without Redis |

## Assets endpoint

`GET /api/anchor/[provider]/assets?wallet=` is restricted to the authenticated wallet address to prevent enumeration via our anchor credentials.
