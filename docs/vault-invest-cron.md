# Vault investment cron entry point

Vercel invokes a configured cron path with HTTP GET. The original entry in `vercel.json` pointed to `/api/vault/invest`, whose GET handler only reads vault status. Consequently, an HTTP 200 from that path did not establish that an investment job ran.

The existing cron entry now points to `/api/vault/invest/cron`. Its GET handler delegates directly to the existing authenticated POST implementation. The original cron expression, `0 2 * * *`, is preserved.

This corrects the earlier PR discussion's statement that no `vercel.json` change was required. Vercel supplies the Bearer header, but the configured path must also accept the method Vercel actually sends.

## Endpoint behavior

| Request | Behavior |
| --- | --- |
| GET `/api/vault/invest` | Existing public status read; never starts an investment job |
| POST `/api/vault/invest` | Existing authenticated manual/admin investment entry point |
| GET `/api/vault/invest/cron` | Authenticated cron adapter using the same investment implementation |

The mutation entry points both require `Authorization: Bearer <CRON_SECRET>`. A missing secret, absent token, wrong token, or spoofed `x-vercel-cron` header returns 401 before any ledger read or job invocation. The same cooldown and overlapping-lease protections apply to both entry points; a valid Bearer token does not bypass those protections.

The adapter declares the existing dynamic execution and 300-second duration settings. It adds no second scheduler and makes no network call to the POST endpoint.

Vercel's request method is documented in [How cron jobs work](https://vercel.com/docs/cron-jobs#how-cron-jobs-work). Production configuration still needs the existing server-only `CRON_SECRET`.

## Focused reproduction

From a normal checkout with the web application's dependencies installed:

```sh
cd apps/web-app
npx vitest run src/app/api/vault/__tests__/invest.route.test.ts
```

The existing nine POST cases now run against both authenticated entry points. Two integration cases cover the read-only status GET and the path actually selected by `vercel.json`.

At original head `b21750157e113112ae37da52d36b8f964734414e`, the configured-path case returned HTTP 200 but failed because the investment job was called zero times. Changing the existing cron path to the dedicated GET adapter makes that case pass with exactly one job invocation.

| Measurement | Original configured path | Repaired configured path |
| --- | --- | --- |
| HTTP status with a valid secret | 200 | 200 |
| Investment job invocations | 0 | 1 |
| Response | Vault status | Investment result with `success: true` |

All 20 focused cases pass. Execution used Node 24.19.0 and Vitest 4.1.10. The actual route, adapter, auth helper, and lease-error type were imported from source. External vault/job boundaries were controlled mocks; temporary module aliases used native Request/Response objects for the framework boundary.

These results establish route selection and authentication behavior. They do not represent a live-chain investment, a full application build, or a deployed Vercel cron run. The issue's existing post-deployment log check remains a maintainer acceptance step.
