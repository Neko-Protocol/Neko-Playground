# Required repository gates for PR #328

The repository root acceptance commands passed on source [`cb37d07e4ecc6231d9186040bd1494e93ade59da`](https://github.com/woahwhattheheck/Neko-Playground/commit/cb37d07e4ecc6231d9186040bd1494e93ade59da) in [run 37202788075](https://github.com/woahwhattheheck/Neko-Playground/actions/runs/37202788075).

| Command | Exit code |
| --- | ---: |
| `npm ci` | 0 |
| `npm run lint` | 0 |
| `npm run typecheck` | 0 |
| `npm run test` | 0 |

Lint reports 16 warnings and no errors. The remaining warning sites are unchanged: 13 warning-bearing files match the sponsor base `d2cd669e0d22df05bafd9568ad859ed74eb211b1` byte-for-byte; the automation execute route's warned `walletAddress` binding is unchanged in the PR diff. This is a source comparison, not a separate baseline lint execution.

## Reproduction and scope

The job used Node 22.23.3 and npm 10.9.9 on Ubuntu 24.04, installed the unchanged root lockfile with `npm ci`, and ran the three commands above once from the repository root. It used the same four public Stellar testnet values as the existing CI configuration. Each command's true exit code was recorded even when an earlier command failed.

The [isolated workflow](https://github.com/woahwhattheheck/Neko-Playground/blob/829a6308b1b3464cc388e6f1bba9ec3aa96ea04a/.github/workflows/neko328-required-gates.yml) checks out the exact original PR source into `source`. The workflow carrier is a separate branch; its workflow file is not part of this PR. The source tree tested is `9195b1a5facc927a643403263f7439fad513fbb7`.

Package manifests, `package-lock.json`, npm scripts, TypeScript configuration, the existing CI file, and the four public environment values were preserved. The Vitest configuration was deliberately consolidated, and the shared setup boundary was corrected as described below. This run did not include a production build or deployment.

## Actual failures and repairs

| Run | Source | Result and subsequent repair |
| --- | --- | --- |
| [37200945987](https://github.com/woahwhattheheck/Neko-Playground/actions/runs/37200945987) | `cd9dcbb1` | Checkout failed with Git exit 128 because an orphan worktree gitlink had no `.gitmodules` URL. Install and all three gates did not execute. Commit `7552a024` removed only that gitlink from the tree. |
| [37201269207](https://github.com/woahwhattheheck/Neko-Playground/actions/runs/37201269207) | `7552a024` | Install and lint passed. Typecheck found one TS1117 duplicate-property diagnostic; tests exposed two incomplete vault environment mocks and two automation execute contract failures. Commit `28af81e4` integrated the existing repairs listed below. |
| [37202121591](https://github.com/woahwhattheheck/Neko-Playground/actions/runs/37202121591) | `28af81e4` | Install, lint and typecheck passed. Activating the existing setup file exposed its unconditional browser `window` fixture: server suites correctly hit the production browser-import guard. |
| [37202788075](https://github.com/woahwhattheheck/Neko-Playground/actions/runs/37202788075) | `cb37d07e` | Install and all three required gates passed after deleting only the six-line unconditional `window` block from `vitest.setup.ts`. |

The test and typecheck repair in `28af81e4` reuses source already published for [PR #327](https://github.com/Neko-Protocol/Neko-Playground/pull/327):

- Automation failure-event integration from `516275a9515c713d82b13c89a050a7240fd7e4c9`.
- The automation and two vault fixtures, plus Vitest configuration consolidation, from `79845f236c246bcd10d1d4b2baf4cfa866f33ede`.
- The integration uses PR #328's shared structured logger for outbox-delivery failures. Its fixture asserts exactly one matching diagnostic with the expected level, route, plan ID and original error; the existing event, ownership, retry and no-reexecution assertions remain.
- The two vault fixtures are identical to the donor versions and remove incomplete client environment mocks.
- Consolidating the duplicate `test` properties preserves the declared environment values and makes the previously overwritten `setupFiles` setting active.
- The setup boundary repair preserves the production `env.server.ts` browser guard, the local-storage fixture, public environment defaults and all assertions. Node suites retain a Node environment; browser suites opt into jsdom.
- Two unused logger lint-suppression comments were removed without changing executable logger code.

No suites were excluded, assertions relaxed, acceptance scripts replaced, or optional substitutes introduced. The final run covers the earlier cyclic-redaction and reserved-envelope repairs on the original branch as well.

## Evidence

[results.json](results.json) records the source and controller pins, command exits, original artifact identifiers and SHA-256 digests, input blob identities, and donor provenance.

[job-logs.zip](job-logs.zip) contains the decoded native GitHub job logs for all four runs, including the initial checkout failure. It is a separate archive assembled from the exact returned log text, not a byte-for-byte copy of the original Actions artifact ZIPs. The original artifact records remain linked in `results.json`; their retention is controlled by GitHub Actions.

This directory is evidence only. The acceptance source pin remains `cb37d07e4ecc6231d9186040bd1494e93ade59da`; adding these records does not change any tested source, package, lock, configuration or script blob.
