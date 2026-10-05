# Faucet shared Redis acceptance

The existing contribution for [issue #223](https://github.com/Neko-Protocol/Neko-Playground/issues/223) now has a real shared-store execution receipt. On source `848d0faec281bea69411cef965f97b36acf8186d`, independent Node processes used the actual `@upstash/redis@1.39.0` client through Serverless Redis HTTP to Redis 7.2.5. The limiter, cooldown constant, route and submission helper were unchanged.

## Observed result

[The focused job](https://github.com/woahwhattheheck/Neko-Playground/actions/runs/37200526292/job/111431111578) completed successfully on 2026-10-04. The acceptance step ran once and took about 2.6 seconds, including child-process startup; that duration is not a production latency benchmark.

| Requirement or supporting check | Observation |
| --- | --- |
| Parallel independent instances | Two processes, PIDs 2722 and 2723, began acquisitions after the same parent barrier. One was admitted and one was blocked. |
| Fresh process retains the cooldown | A newly started process, PID 2738, was blocked after the first two had exited. No in-memory state was shared between these processes. |
| Existing cooldown is preserved | The original constant was 300,000 ms. Redis reported 299,675 ms remaining after the initial requests. |
| Existing route reports 429 with seconds remaining | The actual route returned HTTP 429 and `Rate limit: please wait 299s before requesting again`. |
| Ownership-safe cleanup reaches real Redis | The owner's Lua cleanup freed its slot; repeating that old cleanup after a successor acquisition left the successor blocked. |
| Documented local fallback | Without KV configuration in development, the first acquisition passed, the next was blocked and one in-memory warning was emitted. |

The raw [result](validation/faucet-shared-redis-20261004/result.json) contains the observed process IDs, source blob identities and outcomes.

## Scope and limits

The limiter's Redis client, HTTP requests, Redis NX/TTL operations and ownership Lua script were real. This models separate serverless process lifetimes with independent Node processes in one isolated runner. It does not establish behavior on a deployed Vercel function, managed Upstash availability, geographic consistency, Redis restarts or a live Stellar transaction.

The complete original constants, limiter, route and submission-helper files were loaded from the checkout without source rewriting. TypeScript 5.8.3 transpiled them for this opt-in fixture. Unrelated framework response construction, input-validation and chain-module boundaries were explicit fixture seams. The 429 path returns before chain work. No source-level typecheck or full Next.js application build is claimed by this run.

The five-minute TTL was observed in Redis; the fixture did not wait five minutes or alter the configured duration. It sampled an ordinary remaining TTL, not the subsecond TTL-zero boundary. It did not exercise stalled provider requests or revise the separate pending-mint outcome coverage in [faucet-pending-outcomes.md](faucet-pending-outcomes.md). Later source changes must be assessed against their own source identity.

## Reproduction and provenance

The opt-in driver is [acceptance.cts](../scripts/validation/faucet-shared-redis/acceptance.cts). The exact executed [controller workflow](https://github.com/woahwhattheheck/Neko-Playground/blob/96c9b7188c4519e42e3e93ee84106b9e541c7755/.github/workflows/faucet-shared-redis.yml) provides the service and dependency setup. Its original application files were compared with the pinned source before execution. This documentation commit adds no application workflow.

For local execution, provide an isolated Redis service behind [Serverless Redis HTTP](https://github.com/hiett/serverless-redis-http) at `http://127.0.0.1:8079`. The driver intentionally rejects non-loopback endpoints and uses only its fixed fixture key. Install `@upstash/redis@1.39.0` and `typescript@5.8.3` in an isolated dependency directory, then run from the repository root with Node 22.23.3:

```sh
NODE_PATH=/absolute/path/to/isolated/node_modules \
UPSTASH_REDIS_REST_URL=http://127.0.0.1:8079 \
UPSTASH_REDIS_REST_TOKEN=isolated-neko-acceptance \
PRODUCT_SOURCE_REVISION=848d0faec281bea69411cef965f97b36acf8186d \
node --experimental-strip-types scripts/validation/faucet-shared-redis/acceptance.cts
```

Only a dedicated fixture service should use the sample token. The driver creates and removes its fixture key. It creates a fresh `artifacts/faucet-shared-redis/result.json` after execution.

The successful controller is `96c9b7188c4519e42e3e93ee84106b9e541c7755`. A preceding [setup attempt](https://github.com/woahwhattheheck/Neko-Playground/actions/runs/37200457867) stopped at the source comparison because the default shallow checkout lacked the pinned commit. No acceptance code executed in that attempt. Fetching that exact commit corrected the fixture setup; application source and acceptance script were unchanged.

Retained evidence:

- [result.json](validation/faucet-shared-redis-20261004/result.json)
- [dependencies.json](validation/faucet-shared-redis-20261004/dependencies.json)
- [images.json](validation/faucet-shared-redis-20261004/images.json)
- [controller.txt](validation/faucet-shared-redis-20261004/controller.txt)

These four files were downloaded from artifact `11302622664`. Its 3,505-byte ZIP had verified SHA-256 `5e2defa5f6f788bd2199a3d50aa0ca551d08404acb21d7df5aafb969514b5c0d`. The retained image metadata pins the actual images used:

- Redis: `redis@sha256:6aaf3f5e6bc8a592fbfe2cccf19eb36d27c39d12dab4f4b01556b7449e7b1f44`
- REST bridge: `hiett/serverless-redis-http@sha256:5b0bb9239fce53abf87b2018a7a0deb9ec7bd900c5360738fe5fbeeb426f9150`
