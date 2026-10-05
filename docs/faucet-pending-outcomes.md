# Faucet outcomes and cooldown ownership

A submission acknowledgement does not establish that a mint succeeded. The faucet keeps the acquired cooldown when a transaction may still settle and reports the transaction hash so the caller can inspect that submission.

Both the bulk faucet contract and the legacy per-token path use `submitFaucetMint`. The existing cooldown duration, Redis acquisition, and ownership-token release remain unchanged.

## Outcomes

| Outcome | HTTP response | Cooldown |
| --- | --- | --- |
| Preparation fails before submission | 500 | Released if no other mint succeeded or remains pending |
| Submission returns `ERROR` or `TRY_AGAIN_LATER` | 500 | Released if no other mint succeeded or remains pending |
| Transaction is confirmed `FAILED` | 500 | Released if no other mint succeeded or remains pending |
| Transaction is confirmed `SUCCESS` | 200 | Kept until its existing expiry |
| Submission reply is lost | 202, `success: false`, `pending: true`, locally computed hash | Kept until its existing expiry |
| A submitted transaction's status cannot be read | 202, `success: false`, `pending: true`, RPC hash | Kept until its existing expiry |
| Submission or confirmation exceeds its 30-second budget | 202, `success: false`, `pending: true`, local hash before acknowledgement, otherwise RPC hash | Kept until its existing expiry |
| Status remains `NOT_FOUND` after bounded polling | 202, `success: false`, `pending: true`, RPC hash | Kept until its existing expiry |

`DUPLICATE` submissions are checked for their final outcome too. A single monotonic 30-second budget covers the submission call, status reads, and inter-read waits. A stalled RPC or slow repeated status reads consume that same budget. The existing count limit remains an upper bound; the deadline can stop polling earlier. The helper never submits a second transaction or starts another status read after its deadline.

The deadline applies to each `submitFaucetMint` invocation. Preparation happens before it, and legacy requests can submit multiple tokens sequentially, so this is not a 30-second cap on the complete HTTP request. A timed-out RPC can still settle remotely; its eventual result is consumed without restarting polling. The SDK transport is not cancelled. As with other JavaScript timers, deadline delivery waits for the event loop to run.

In legacy mode, the response retains each token's success, error, or pending result. Any pending token makes the overall response 202; confirmed successes remain present in `results`. If some tokens succeed and the rest definitively fail, the existing partial-result response remains 200 with `success: false`. An exception after a confirmed mint also preserves the reservation.

Clients should inspect `pending` and `success`, rather than treating every 2xx response as a confirmed mint. A pending response provides the existing transaction hash; it does not invite an immediate replacement submission. The existing cooldown is not extended by this change.

Stellar documents submission acknowledgements and statuses in the [sendTransaction API reference](https://developers.stellar.org/docs/data/apis/rpc/api-reference/methods/sendTransaction).

## Focused reproduction

From a normal checkout with the web application's dependencies installed:

```sh
cd apps/web-app
npx vitest run src/lib/__tests__/faucetPending.test.ts
```

The maintained cases exercise the actual route, submission helper, and in-memory limiter. RPC and external framework boundaries are controlled mocks. Cases cover bulk and legacy paths, failed status reads, lost submission replies, polling timeout, duplicate acknowledgements, definitive rejection, on-chain failure, confirmed success, and mixed legacy outcomes.

On the original PR head `79845f236c246bcd10d1d4b2baf4cfa866f33ede` (route blob `77c908334359b156bdda9a1bd817af4ab17f30de`), these cases produced 11 failures and 6 passes. With the repair, all 17 pass. For a lost submission reply or failed status read, two requests produced the following controlled result:

| Measurement | Original route | Repaired route |
| --- | --- | --- |
| First response | 500 | 202 with pending result |
| Immediate second response | 500 | 429 |
| Mint submissions | 2 | 1 |

The local execution used Node 24.19.0 and Vitest 4.1.10. Temporary resolution aliases were used only for mocked external modules; the route, helper, and limiter were imported directly from source. The helper also passed strict TypeScript checking against Stellar SDK 12.3.0 declarations and Node 20 types.

This evidence is a controlled regression reproduction. It does not measure chain settlement time, production throughput, Redis availability, or a complete application build. See the separate [shared Redis acceptance report](faucet-shared-redis.md) for independent-process execution through a real Redis service and its deployment limits.

## Confirmation deadline reproduction

The submission helper at `848d0faec281bea69411cef965f97b36acf8186d` (blob `28cbeb81c63d644238c9a0b8dee33c88e199b338`) limited the number of status reads, but it did not bound the time spent awaiting each RPC. The unchanged helper was run with controlled promises and virtual timers on Node 24.19.0. No network or chain requests were made.

| RPC scenario | Before the deadline repair | With the deadline repair |
| --- | --- | --- |
| Submission never settles | Still unresolved after 300,000 ms; one submission | Pending at 30,000 ms with the local hash; one submission |
| First status read never settles | Still unresolved after 300,000 ms; one submission, one read | Pending at 30,000 ms with the acknowledged hash; one submission, one read |
| Each `NOT_FOUND` read takes ten seconds | Pending after 340,000 ms and 31 reads | Pending at 30,000 ms after three reads have started |

Six added cases in the existing test file exercise these three conditions through both route modes. Each observes HTTP 202 at the deadline, the expected transaction hash, a following HTTP 429, and one submission. Late acknowledgement, late rejection, and the final slow status response do not restart polling; all helper timers are cleared. The existing immediate success and definitive-failure cases remain in the same focused file.

A seventh added case delays the queued submission callback until its budget has expired. It reproduced an extra late submission before the final boundary check; the repaired helper starts no RPC. The complete focused file passed **24 of 24 cases** (17 existing and seven added) in 444 ms on Node 24.19.0 with Vitest 4.1.10. This execution included the concurrently published TTL-zero limiter repair from `19382f2d8c2d580a0378637f9aabb95f788d0cc9`; it did not repeat that repair's separate Redis-boundary coverage.

The deadline measurements use controlled monotonic time. They establish bounded helper waiting and request counts, not live RPC latency, chain settlement time, deployed response time, or overall application throughput. The route/helper/limiter are loaded directly from source; temporary local aliases resolve mocked framework and RPC modules. Vitest 4.1.10 is within the application's declared `^4.1.9` range. The installed Stellar SDK 12.3.0 is mocked in this execution, so this run does not establish compatibility with the declared SDK `^14.2.0` or claim a complete application typecheck.
