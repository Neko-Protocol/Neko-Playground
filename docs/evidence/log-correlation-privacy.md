# Correlation metadata privacy

This is a focused follow-up on existing PR #328 and issue #318. The unchanged
comparison source is `a248e3732c0d29dcdb08f7d92456c43ff9a6b327`, which preserves
the earlier GET/coordinator repair at `8ef587664f327298c7ace5d5741333ae4ed905da`.
Those handler changes and their [retained evidence](get-error-correlation.md)
are preserved by this follow-up.

## Reproduction and repair

The logger previously redacted nested context and errors, but wrote its
top-level `requestId`, `route`, and `msg` values directly. A client could place
a wallet, bearer token, JWT, or signed-XDR-shaped value in a correlation header
and have it appear verbatim in a server log and the error-response request ID.
All values used in this reproduction are constructed local fixtures, not real
wallets, credentials, signatures, or customer data.

The logger now applies the existing string-redaction policy to those three
fields. A small shared request-ID helper applies the same policy before
middleware forwards a request: ordinary IDs retain the existing trimming and
128-character limit, and an ID recognized by the redactor is replaced with a new
UUID. Middleware forwards that safe ID, and the error helper reuses it in the
response header, response body, and server log. An explicit error-helper ID
uses the same normalization. Ordinary `x-correlation-id` values now survive
middleware consistently with the helper's existing alternate-header support.

The existing redaction patterns and sensitive-key rules are unchanged. This
does not establish that every possible secret can be recognized in free text.

## Executed checks

The selected tests execute the actual Next 16.1.6 `NextRequest` and
`NextResponse`, repository middleware, error helper, redactor, and JSON logger.
They copy the request header emitted by `NextResponse.next` into the request
passed to the error helper, matching the header forwarding represented by the
middleware result. This is direct module execution; it is not a running Next
HTTP application, deployed service, or edge-runtime launch.

| Source | Selected result |
| --- | --- |
| Unchanged `a248e373` production modules, with the new regressions | 10 failed, 5 passed |
| Repaired production modules | 15 passed |

The selection contains 11 new correlation/privacy cases and the four existing
redaction cases. Failures on the unchanged source are assertion failures for
sensitive IDs, explicit error-helper IDs, alternate-header correlation, and
the three top-level log fields. The ordinary primary-header case and existing
redaction cases already pass there.

The complete command output is retained in
[the original-source run](log-correlation-privacy-before.log) and
[the repaired-source run](log-correlation-privacy-after.log). Each log records
its working directory, exact command, stdout, stderr, and exit status.

The actual command, run from each copy's `apps/web-app` directory, was:

```sh
node --max-old-space-size=192 /workspace/scratch/dbed016667b3/neko328-cached-runtime/node_modules/vitest/vitest.mjs run src/lib/observability/__tests__/correlationPrivacy.test.ts src/lib/observability/__tests__/redact.test.ts --maxWorkers=1 --pool=threads --no-file-parallelism
```

The repository's unchanged `vitest.config.ts` was used. With the repository's
ordinary dependencies available, the same selection can be run with:

```sh
npm test -- src/lib/observability/__tests__/correlationPrivacy.test.ts src/lib/observability/__tests__/redact.test.ts --maxWorkers=1 --pool=threads --no-file-parallelism
```

Additional checks passed:

- Strict TypeScript 5.9.3 checking of `logger.ts`, `requestId.ts`, `redact.ts`,
  `errorResponse.ts`, and `middleware.ts`, using the real Next declarations:
  `--noEmit --strict --skipLibCheck --target ES2022 --module ESNext
  --moduleResolution Bundler --lib ES2022,DOM`.
- Prettier 3.8.1 `--check` for the four changed/new production files and the new
  regression file, using the repository's `.prettierrc.json`.

## Bounded dependency runtime

The earlier shared runtime had been removed during workspace cleanup. The
replacement used Node 24.19.0 and restored only the dependency closure needed
for Next 16.1.6 and Vitest 4.1.9 from existing npm-cache tarballs. Every archive
was checked against its integrity value in the unchanged repository lockfile.
The closure includes Vite 8.1.0 and React/React DOM 19.2.3, plus the Linux x64
GNU native bindings needed by Vite. Next's optional build and image packages
were not needed for this direct-module execution.

The measured closure is 59 packages: 46,959,668 compressed bytes and
192,035,846 expanded file bytes (about 183 MiB, before filesystem allocation
overhead). It was restored in isolated disk scratch, with no downloads,
installation scripts, monorepo dependency installation, or shared-runtime
writes. The checks used one worker and a 192 MiB Node heap limit. The
disposable restored packages can be released after retaining these records.

## Remaining validation

The full repository test suite, repository-wide lint, project-wide typecheck,
production build, and hosted CI were not executed for this follow-up. The
earlier GET-handler regression suite was not rerun in this smaller runtime;
its source and prior evidence are preserved. These focused results do not
replace the contribution guide's complete CI and review requirements or claim
complete issue acceptance. No live provider, wallet, transaction, customer
data, or production service was used.
