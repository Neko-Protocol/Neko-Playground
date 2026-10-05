/* Opt-in issue #223 integration: real Redis client/store, isolated processes. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const Module = require("node:module");
const { fork } = require("node:child_process");
const ts = require("typescript");
const { Redis } = require("@upstash/redis");

const root = process.cwd();
const source = path.join(root, "apps/web-app/src");
const address = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
const key = `faucet:rl:${address}`;
const endpoint = new URL(process.env.UPSTASH_REDIS_REST_URL);
assert.equal(endpoint.hostname, "127.0.0.1", "Use an isolated loopback Redis fixture");

function product() {
  const originalLoad = Module._load;
  // Only unrelated framework, input-validation and chain boundaries are seams.
  // The complete limiter, constants module, route and submission helper are read
  // unchanged from this checkout. Redis operations are never mocked.
  const seams = {
    "@stellar/stellar-sdk": {},
    "@/lib/env.client": {
      clientEnv: { stellarNetwork: "TESTNET", faucetContractId: "fixture" },
    },
    "@/lib/env.server": { serverEnv: { FAUCET_SECRET_KEY: "synthetic-fixture" } },
    "@/lib/helpers/stellar/sorobanServer": {
      getSorobanServer() { throw new Error("Unexpected chain access"); },
    },
    "@/lib/validation/schemas": { FaucetBodySchema: {} },
    "@/lib/validation/parse": {
      parseJsonBody: async (request) => ({ data: await request.json() }),
    },
    "next/server": {
      NextResponse: {
        json: (body, options = {}) => new Response(JSON.stringify(body), {
          status: options.status || 200,
          headers: { "Content-Type": "application/json" },
        }),
      },
    },
  };
  Module._extensions[".ts"] = (module, filename) => {
    const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
      fileName: filename,
    });
    module._compile(compiled.outputText, filename);
  };
  Module._load = function (id, parent, isMain) {
    if (Object.hasOwn(seams, id)) return seams[id];
    if (id.startsWith("@/")) id = path.join(source, id.slice(2)) + ".ts";
    return originalLoad.call(this, id, parent, isMain);
  };
  return {
    ...require(path.join(source, "lib/faucetRateLimit.ts")),
    cooldown: require(path.join(source, "lib/constants/faucet.ts")).FAUCET_COOLDOWN_MS,
    POST: require(path.join(source, "app/api/faucet/route.ts")).POST,
  };
}

if (process.send) {
  const api = product();
  process.send({ ready: true, pid: process.pid });
  process.once("message", async ({ action, token }) => {
    try {
      let result;
      if (action === "local") {
        for (const name of ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN", "KV_REST_API_URL", "KV_REST_API_TOKEN"])
          delete process.env[name];
        process.env.NODE_ENV = "development";
        result = [await api.acquireFaucetRateLimit(address), await api.acquireFaucetRateLimit(address)];
      } else if (action === "route") {
        const response = await api.POST(new Request("http://fixture/api/faucet", {
          method: "POST", body: JSON.stringify({ address }),
          headers: { "Content-Type": "application/json" },
        }));
        result = { status: response.status, body: await response.json() };
      } else if (action === "release") {
        await api.releaseFaucetRateLimit(address, token);
        result = { released: true };
      } else {
        result = await api.acquireFaucetRateLimit(address);
      }
      process.send({ result, pid: process.pid, cooldown: api.cooldown });
    } catch (error) {
      process.send({ error: error.stack, pid: process.pid });
      process.exitCode = 1;
    } finally { process.disconnect(); }
  });
} else {
  const report = {
    sourceRevision: process.env.PRODUCT_SOURCE_REVISION,
    node: process.version,
    typescript: ts.version,
    fixture: "Real Redis 7.2.5 through Serverless Redis HTTP; @upstash/redis 1.39.0",
    sourceBlobs: {}, observations: {}, status: "RUNNING",
  };
  for (const file of ["lib/faucetRateLimit.ts", "lib/constants/faucet.ts", "app/api/faucet/route.ts", "lib/faucetSubmission.ts"]) {
    const bytes = fs.readFileSync(path.join(source, file));
    report.sourceBlobs[file] = crypto.createHash("sha1")
      .update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
  }
  const redis = new Redis({ url: endpoint.href, token: process.env.UPSTASH_REDIS_REST_TOKEN });

  async function start() {
    const child = fork(__filename, [], {
      env: { ...process.env, NODE_ENV: "production", FAUCET_RATE_LIMIT_DISABLED: "false" },
      stdio: ["ignore", "pipe", "pipe", "ipc"],
    });
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    const ready = new Promise((resolve, reject) => {
      child.once("message", (message) => message.ready ? resolve() : reject(new Error(JSON.stringify(message))));
      child.once("error", reject);
      child.once("exit", (code) => reject(new Error(`Worker exited before ready: ${code}; ${stderr}`)));
    });
    const result = new Promise((resolve, reject) => {
      let received;
      const timer = setTimeout(() => { child.kill(); reject(new Error("Worker timed out")); }, 30000);
      child.on("message", (message) => { if (!message.ready) received = message; });
      child.once("error", (error) => { clearTimeout(timer); reject(error); });
      child.once("exit", (code) => {
        clearTimeout(timer);
        if (code !== 0 || !received || received.error) reject(new Error(received?.error || stderr || `Worker exit ${code}`));
        else resolve({ ...received, stderr });
      });
    });
    // Attach rejection immediately; the caller awaits the same promise later.
    result.catch(() => {});
    await ready;
    return { child, result };
  }
  async function run(action, token) {
    const worker = await start();
    worker.child.send({ action, token });
    return worker.result;
  }

  (async () => {
    try {
      await redis.ping();
      await redis.del(key);
      const workers = await Promise.all([start(), start()]);
      workers.forEach(({ child }) => child.send({ action: "acquire" }));
      const parallel = await Promise.all(workers.map(({ result }) => result));
      assert.notEqual(parallel[0].pid, parallel[1].pid);
      assert.equal(parallel.filter(({ result }) => result.allowed).length, 1);
      const winner = parallel.find(({ result }) => result.allowed);
      const loser = parallel.find(({ result }) => !result.allowed);
      assert.equal(winner.cooldown, 300000);
      assert.ok(loser.result.retryAfterSeconds > 0 && loser.result.retryAfterSeconds <= 300);
      report.observations.parallel = { processes: parallel.map(({ pid }) => pid), admitted: 1, blocked: 1 };

      const cold = await run("acquire");
      assert.ok(!parallel.some(({ pid }) => pid === cold.pid));
      assert.equal(cold.result.allowed, false);
      const pttl = await redis.pttl(key);
      assert.ok(pttl > 280000 && pttl <= winner.cooldown);
      report.observations.coldStart = { pid: cold.pid, blocked: true };
      report.observations.cooldown = { configuredMs: winner.cooldown, observedRemainingMs: pttl };

      const denied = await run("route");
      assert.equal(denied.result.status, 429);
      const seconds = Number(denied.result.body.error.match(/wait (\d+)s/)[1]);
      assert.ok(seconds > 0 && seconds <= 300);
      report.observations.route = { status: 429, secondsRemaining: seconds, error: denied.result.body.error };

      await run("release", winner.result.releaseToken);
      assert.equal(await redis.exists(key), 0);
      const successor = await run("acquire");
      assert.equal(successor.result.allowed, true);
      await run("release", winner.result.releaseToken);
      const afterStaleRelease = await run("acquire");
      assert.equal(afterStaleRelease.result.allowed, false);
      report.observations.ownedRelease = { ownReleaseFreed: true, staleReleaseKeptSuccessor: true };

      const local = await run("local");
      assert.equal(local.result[0].allowed, true);
      assert.equal(local.result[1].allowed, false);
      assert.equal((local.stderr.match(/Rate limit using in-memory Map/g) || []).length, 1);
      report.observations.localFallback = { admitted: 1, blocked: 1, warnings: 1 };
      report.status = "PASS";
    } catch (error) {
      report.status = "FAIL";
      report.error = error.stack;
      process.exitCode = 1;
    } finally {
      await redis.del(key).catch(() => {});
      fs.mkdirSync("artifacts/faucet-shared-redis", { recursive: true });
      fs.writeFileSync("artifacts/faucet-shared-redis/result.json", JSON.stringify(report, null, 2) + "\n");
      console.log(JSON.stringify(report, null, 2));
    }
  })();
}
