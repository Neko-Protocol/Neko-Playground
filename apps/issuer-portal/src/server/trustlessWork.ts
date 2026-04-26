import { createHash } from "node:crypto";
import {
  Address,
  BASE_FEE,
  Contract,
  Keypair,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  scValToNative,
} from "@stellar/stellar-sdk";
import { NETWORK_PASSPHRASE, RPC_URL, XLM_SAC } from "@/lib/constants";

/**
 * Trustless Work integration. Escrows custody the issuer's tokens; releases
 * are triggered by the Neko backend after observing `buy_executed` events
 * from the listing registry contract.
 *
 * In production this calls the TW REST API:
 *   - POST /deployer/multi-release   → unsigned deploy XDR (issuer signs in
 *     the browser, then POST /api/escrow/submit-deploy → helper/send-transaction).
 *   - POST /escrow/multi-release/release-milestone-funds → unsigned XDR;
 *                                       Neko admin (releaseSigner) signs.
 *   - POST /helper/send-transaction  → broadcast a signed XDR.
 *
 * For POC convenience this module also has a MOCK MODE that activates when
 * `TRUSTLESS_WORK_API_KEY` is missing. In mock mode the escrow address is the
 * Neko admin pubkey and releases are executed as direct token transfers
 * signed server-side. This makes the end-to-end flow testable on testnet
 * without needing a TW account.
 */

const TW_BASE_URL =
  process.env.TRUSTLESS_WORK_API_URL ?? "https://dev.api.trustlesswork.com";

/** Normalized API key (trim + strip accidental `Bearer ` prefix from copy-paste). */
function twApiKey(): string {
  const raw = process.env.TRUSTLESS_WORK_API_KEY ?? "";
  let k = raw.trim();
  if (k.toLowerCase().startsWith("bearer ")) {
    k = k.slice(7).trim();
  }
  return k;
}

/** Headers TW accepts (docs show `Authorization: Bearer`; some stacks also check `x-api-key`). */
function twJsonHeaders(): Record<string, string> {
  const key = twApiKey();
  return {
    "content-type": "application/json",
    Authorization: `Bearer ${key}`,
    "x-api-key": key,
  };
}

export function isTrustlessWorkConfigured(): boolean {
  return Boolean(twApiKey());
}

function twUnauthorizedHint(): string {
  return (
    " Trustless Work returned 401: the key is present but rejected. " +
    "Keys are tied to the API host: use a **Testnet** key from TW BackOffice with " +
    "`TRUSTLESS_WORK_API_URL=https://dev.api.trustlesswork.com`, or a **Mainnet** key with " +
    "`https://api.trustlesswork.com` — do not mix. Trim spaces in the key; restart `npm run dev` after editing `.env.local`."
  );
}

/** Log full TW HTTP error for debugging (server terminal / Vercel logs). */
function logTwApiError(
  label: string,
  url: string,
  method: string,
  status: number,
  bodyText: string,
  requestPayload?: unknown
): void {
  let parsed: unknown = bodyText;
  try {
    parsed = JSON.parse(bodyText) as unknown;
  } catch {
    /* keep raw string */
  }
  console.error("[TrustlessWork API]", label, {
    method,
    url,
    status,
    responseBody: parsed,
    requestPayload: requestPayload ?? undefined,
  });
}

function twIssuerInvalidHint(tokenContract: string): string {
  const soroban = tokenContract.startsWith("C");
  const classicIssuer =
    process.env.TRUSTLESS_WORK_TRUSTLINE_ISSUER?.trim() ?? "";
  const parts = [
    " Trustless Work returned `Issuer is invalid` — check:",
    "(1) **`signer`** and all **`roles`** are the listing wallet (`G…`); it must be allowed for this API key in TW BackOffice.",
    "(2) **`trustline.address`** must be a valid `G…` Stellar address for that asset/symbol (TW does not accept `trustline.issuer`).",
  ];
  if (soroban && !classicIssuer) {
    parts.push(
      "(3) For Soroban `C…` tokens, pass **`trustlineAddress`** (optional `G…`) or set `TRUSTLESS_WORK_TRUSTLINE_ISSUER` / `trustlineClassicIssuer` for the classic SAC issuer if TW rejects the listing wallet as trustline."
    );
  }
  return parts.join(" ");
}

function adminPublicKey(): string {
  const v = process.env.NEKO_ADMIN_PUBLIC_KEY;
  if (!v) throw new Error("NEKO_ADMIN_PUBLIC_KEY not configured");
  return v;
}

function adminKeypair(): Keypair {
  const secret = process.env.NEKO_ADMIN_SECRET_KEY;
  if (!secret)
    throw new Error("NEKO_ADMIN_SECRET_KEY not configured (release signer)");
  return Keypair.fromSecret(secret);
}

const sorobanServer = new rpc.Server(RPC_URL, { allowHttp: true });

export interface CreateEscrowInput {
  issuer: string;
  tokenContract: string;
  tokenDecimals: number;
  /** Human-readable listing size, e.g. "100" or "10.5" (same as issuer UI). */
  totalAmount: string;
  /** Soroban token symbol for TW trustline metadata (required by TW API). */
  symbol: string;
  /**
   * Optional classic asset issuer (`G…`) used as **`trustline.address`** (TW
   * only accepts `address`+`symbol`, not `issuer`). Overrides env
   * `TRUSTLESS_WORK_TRUSTLINE_ISSUER` when set; otherwise defaults to {@link issuer}.
   */
  trustlineClassicIssuer?: string;
  /**
   * Explicit `G…` for **`trustline.address`** (highest priority). When empty,
   * uses {@link trustlineClassicIssuer} or env, then {@link issuer}.
   */
  trustlineAddress?: string;
  listingId: string; // engagement id (we use token contract id)
  title: string;
  description: string;
}

/** Convert human token amount to base units as a JSON-safe number for TW milestones. */
function humanAmountToBaseUnitsNumber(human: string, decimals: number): number {
  const s = human.trim();
  if (!s) throw new Error("total amount is empty");
  const [whole, frac = ""] = s.split(".");
  const padded = (frac + "0".repeat(decimals)).slice(0, decimals);
  const combined = (whole || "0") + padded;
  const bi = BigInt(combined);
  if (bi > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error(
      "Listing amount exceeds numeric limit for Trustless Work API"
    );
  }
  return Number(bi);
}

export interface CreateEscrowResult {
  /** Display-friendly id (engagement id, mock id, …). */
  escrowId: string;
  /** 32-byte hex digest used as `BytesN<32>` in the on-chain `list(...)` call. */
  escrowIdHex: string;
  escrowAddress: string;
  mock: boolean;
  /** Set to a hint for the issuer's UI when funding will be a direct transfer. */
  fundingMode: "direct-transfer" | "tw-funding-endpoint";
  /**
   * Unsigned Soroban XDR from TW `deployer/multi-release`. The connected wallet
   * must sign it; then POST to `/api/escrow/submit-deploy`.
   */
  deployUnsignedXdr?: string;
}

/** Deterministic 32-byte digest of a TW escrow id, suitable for `BytesN<32>`. */
function escrowIdHashHex(escrowId: string): string {
  return createHash("sha256").update(escrowId, "utf8").digest("hex");
}

export async function createEscrow(
  input: CreateEscrowInput
): Promise<CreateEscrowResult> {
  if (!isTrustlessWorkConfigured()) {
    const escrowId = `mock_${input.listingId.slice(-8)}_${Date.now().toString(
      36
    )}`;
    const admin = adminPublicKey();
    console.log("[TrustlessWork] createEscrow MOCK (no TW API key)", {
      escrowId,
      escrowAddress: admin.slice(0, 10) + "…",
      listingId: input.listingId,
    });
    return {
      escrowId,
      escrowIdHex: escrowIdHashHex(escrowId),
      escrowAddress: admin,
      mock: true,
      fundingMode: "direct-transfer",
    };
  }

  const milestoneAmount = humanAmountToBaseUnitsNumber(
    input.totalAmount,
    input.tokenDecimals
  );
  const trustlineSymbol = input.symbol.trim() || "TOKEN";
  const classicIssuer = (
    input.trustlineClassicIssuer ??
    process.env.TRUSTLESS_WORK_TRUSTLINE_ISSUER ??
    ""
  ).trim();
  const roleG = input.issuer.trim();
  const explicitTl = input.trustlineAddress?.trim() ?? "";
  // TW `/deployer/multi-release` validates `trustline` as `{ address: G…, symbol }`
  // only — sending `issuer` returns 400 "property issuer should not exist".
  const trustlineAddrG =
    explicitTl.length > 0
      ? explicitTl
      : classicIssuer.length > 0
        ? classicIssuer
        : roleG;
  const trustline = { address: trustlineAddrG, symbol: trustlineSymbol };

  // Match a successful TW payload: `signer`, every `roles` field, milestone
  // `receiver`, and `trustline.address` (classic asset issuer or listing wallet).
  // Note: `releaseMilestone` still signs server-side with `NEKO_ADMIN_*`; if TW
  // binds on-chain release to `releaseSigner` from deploy, that path may need
  // issuer-signed XDRs instead.
  const body = {
    signer: roleG,
    engagementId: input.listingId,
    title: input.title,
    description: input.description,
    roles: {
      approver: roleG,
      serviceProvider: roleG,
      platformAddress: roleG,
      releaseSigner: roleG,
      disputeResolver: roleG,
    },
    platformFee: 0,
    milestones: [
      {
        description: `Initial release pool for ${input.listingId}`,
        amount: milestoneAmount,
        receiver: roleG,
      },
    ],
    trustline,
  };

  const deployUrl = `${TW_BASE_URL}/deployer/multi-release`;
  console.log("[TrustlessWork] createEscrow POST deployer/multi-release", {
    url: deployUrl,
    engagementId: body.engagementId,
    signer: body.signer?.slice(0, 10) + "…",
    trustline: body.trustline,
    milestoneAmount: body.milestones[0]?.amount,
    platformFee: body.platformFee,
  });
  const res = await fetch(deployUrl, {
    method: "POST",
    headers: twJsonHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text();
    logTwApiError(
      "createEscrow / deployer/multi-release",
      deployUrl,
      "POST",
      res.status,
      txt,
      body
    );
    let hint = "";
    if (res.status === 401) hint = twUnauthorizedHint();
    else if (res.status === 400 && /issuer is invalid/i.test(txt)) {
      hint = twIssuerInvalidHint(input.tokenContract);
    }
    throw new Error(`TW deployer failed: ${res.status} ${txt}.${hint}`);
  }
  const json = (await res.json()) as {
    status: string;
    unsignedTransaction?: string;
    contractId?: string;
  };
  if (!json.unsignedTransaction?.trim()) {
    throw new Error(
      "TW deployer response missing unsignedTransaction (cannot request wallet signature)"
    );
  }
  console.log("[TrustlessWork] createEscrow TW response", {
    twStatus: json.status,
    unsignedTransactionLen: json.unsignedTransaction.length,
    contractIdFromTw: json.contractId ?? null,
    responseKeys: Object.keys(json),
  });
  const escrowId = input.listingId;
  return {
    escrowId,
    escrowIdHex: escrowIdHashHex(escrowId),
    escrowAddress: (json.contractId ?? "").trim(),
    mock: false,
    fundingMode: "tw-funding-endpoint",
    deployUnsignedXdr: json.unsignedTransaction.trim(),
  };
}

export interface ReleaseMilestoneInput {
  escrowId: string;
  escrowAddress: string;
  tokenContract: string;
  tokenDecimals: number;
  beneficiary: string;
  /** base units (i128), e.g. "1500000000" for 150 with 7 decimals */
  amountBaseUnits: string;
}

export interface ReleaseMilestoneResult {
  releaseTx: string;
  mock: boolean;
}

export async function releaseMilestone(
  input: ReleaseMilestoneInput
): Promise<ReleaseMilestoneResult> {
  if (!isTrustlessWorkConfigured()) {
    return mockReleaseDirect(input);
  }

  // Update receiver to the buyer, then call release.
  const updatePayload = {
    contractId: input.escrowAddress,
    signer: adminPublicKey(),
    roles: { receiver: input.beneficiary },
  };
  const updateUrl = `${TW_BASE_URL}/escrow/multi-release/update-escrow`;
  const updateRes = await fetch(updateUrl, {
    method: "PUT",
    headers: twJsonHeaders(),
    body: JSON.stringify(updatePayload),
  });
  if (!updateRes.ok) {
    const txt = await updateRes.text();
    logTwApiError(
      "releaseMilestone / update-escrow",
      updateUrl,
      "PUT",
      updateRes.status,
      txt,
      updatePayload
    );
    const hint = updateRes.status === 401 ? twUnauthorizedHint() : "";
    throw new Error(
      `TW update-escrow failed: ${updateRes.status} ${txt}.${hint}`
    );
  }
  const updateXdr = (
    (await updateRes.json()) as { unsignedTransaction: string }
  ).unsignedTransaction;
  await signAndBroadcast(updateXdr);

  const releasePayload = {
    contractId: input.escrowAddress,
    releaseSigner: adminPublicKey(),
    milestoneIndex: 0,
  };
  const releaseUrl = `${TW_BASE_URL}/escrow/multi-release/release-milestone-funds`;
  const releaseRes = await fetch(releaseUrl, {
    method: "POST",
    headers: twJsonHeaders(),
    body: JSON.stringify(releasePayload),
  });
  if (!releaseRes.ok) {
    const txt = await releaseRes.text();
    logTwApiError(
      "releaseMilestone / release-milestone-funds",
      releaseUrl,
      "POST",
      releaseRes.status,
      txt,
      releasePayload
    );
    const hint = releaseRes.status === 401 ? twUnauthorizedHint() : "";
    throw new Error(`TW release failed: ${releaseRes.status} ${txt}.${hint}`);
  }
  const releaseXdr = (
    (await releaseRes.json()) as {
      unsignedTransaction: string;
    }
  ).unsignedTransaction;
  const releaseTx = await signAndBroadcast(releaseXdr);
  return { releaseTx, mock: false };
}

export interface CancelEscrowInput {
  escrowId: string;
  escrowAddress: string;
  tokenContract: string;
  tokenDecimals: number;
  returnTo: string; // issuer
  remainingBaseUnits: string;
}

export async function cancelEscrow(
  input: CancelEscrowInput
): Promise<{ cancelTx: string; mock: boolean }> {
  if (!isTrustlessWorkConfigured()) {
    if (input.remainingBaseUnits === "0") {
      return { cancelTx: "noop", mock: true };
    }
    const cancelTx = await directTokenTransfer(
      input.tokenContract,
      input.returnTo,
      input.remainingBaseUnits
    );
    return { cancelTx, mock: true };
  }

  // Real TW cancel flow would call their cancel endpoint; left as TODO until
  // we validate the exact cancel endpoint shape with TW support.
  throw new Error("cancelEscrow real path not yet implemented");
}

async function mockReleaseDirect(
  input: ReleaseMilestoneInput
): Promise<ReleaseMilestoneResult> {
  const txHash = await directTokenTransfer(
    input.tokenContract,
    input.beneficiary,
    input.amountBaseUnits
  );
  return { releaseTx: txHash, mock: true };
}

/**
 * Mock-mode helper: signs a `token.transfer(admin, to, amount)` server-side
 * with the Neko admin keypair and broadcasts it. The admin acts as the
 * escrow custodian.
 */
async function directTokenTransfer(
  tokenContract: string,
  to: string,
  amountBaseUnits: string
): Promise<string> {
  const kp = adminKeypair();
  const account = await sorobanServer.getAccount(kp.publicKey());
  const op = new Contract(tokenContract).call(
    "transfer",
    new Address(kp.publicKey()).toScVal(),
    new Address(to).toScVal(),
    nativeToScVal(BigInt(amountBaseUnits), { type: "i128" })
  );
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(op)
    .setTimeout(60)
    .build();
  const prepared = await sorobanServer.prepareTransaction(tx);
  prepared.sign(kp);
  const send = await sorobanServer.sendTransaction(prepared);
  if (send.status !== "PENDING" && send.status !== "DUPLICATE") {
    console.error(
      "[TrustlessWork mock] directTokenTransfer sendTransaction rejected",
      {
        status: send.status,
        hash: send.hash,
        errorResult: send.errorResult,
      }
    );
    throw new Error(`mock release sendTransaction failed: ${send.status}`);
  }
  for (let i = 0; i < 45; i++) {
    const st = await sorobanServer.getTransaction(send.hash);
    if (st.status === "SUCCESS") return send.hash;
    if (st.status === "FAILED") {
      console.error(
        "[TrustlessWork mock] directTokenTransfer on-chain FAILED",
        {
          hash: send.hash,
          result: st,
        }
      );
      throw new Error("mock release transaction failed on-chain");
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("mock release timeout");
}

export interface TwSubmitSignedResult {
  hash: string;
  /** Soroban `C…` escrow contract when TW/RPC exposes it. */
  contractAddress?: string;
}

function parseTwSendJsonContract(
  json: Record<string, unknown>
): string | undefined {
  const candidates = [
    json.contractId,
    json.contractAddress,
    json.escrowAddress,
    json.contract_id,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.startsWith("C") && c.length === 56) {
      return c;
    }
  }
  return undefined;
}

const CONTRACT_ID_STRKEY_RE = /^C[A-Z2-7]{55}$/;

/** After a successful Soroban tx, try `returnValue` for a deployed `C…` contract. */
async function readEscrowContractFromSorobanTxHash(
  txHash: string
): Promise<string | undefined> {
  for (let i = 0; i < 45; i++) {
    try {
      const st = await sorobanServer.getTransaction(txHash);
      if (st.status === "NOT_FOUND") {
        if (i % 10 === 0) {
          console.log(
            "[TrustlessWork] readEscrowContractFromSorobanTxHash poll",
            {
              txHash,
              attempt: i + 1,
              status: st.status,
            }
          );
        }
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }
      if (st.status === "FAILED") {
        return undefined;
      }
      if (st.status === "SUCCESS" && "returnValue" in st && st.returnValue) {
        try {
          const n = scValToNative(st.returnValue);
          if (typeof n === "string" && CONTRACT_ID_STRKEY_RE.test(n)) {
            return n;
          }
        } catch {
          /* ignore */
        }
        try {
          const addr = Address.fromScVal(st.returnValue);
          const s = addr.toString();
          if (CONTRACT_ID_STRKEY_RE.test(s)) {
            return s;
          }
        } catch {
          /* ignore */
        }
      }
      return undefined;
    } catch {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  return undefined;
}

/**
 * Network transaction id (hex) derived from a signed envelope. Trustless Work’s
 * `SendTransactionResponse` is only `{ status, message }` — it does not return
 * the hash, so we match what Stellar RPC / explorers use.
 */
function transactionHashHexFromSignedXdr(signedXdr: string): string {
  try {
    const tx = TransactionBuilder.fromXDR(signedXdr.trim(), NETWORK_PASSPHRASE);
    return tx.hash().toString("hex");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[TrustlessWork] transactionHashHexFromSignedXdr failed", {
      message,
      stack: err instanceof Error ? err.stack : undefined,
      xdrLength: signedXdr.length,
      xdrPrefix: signedXdr.slice(0, 96),
    });
    throw err;
  }
}

/** Broadcast a wallet- or server-signed XDR via Trustless Work. */
export async function submitTwSignedTransaction(
  signedXdr: string
): Promise<TwSubmitSignedResult> {
  if (!isTrustlessWorkConfigured()) {
    throw new Error("Trustless Work API key not configured");
  }
  const sendUrl = `${TW_BASE_URL}/helper/send-transaction`;
  const sendPayload = {
    signedXdr: `${signedXdr.slice(0, 48)}…(${signedXdr.length} chars)`,
  };
  const res = await fetch(sendUrl, {
    method: "POST",
    headers: twJsonHeaders(),
    body: JSON.stringify({ signedXdr }),
  });
  if (!res.ok) {
    const txt = await res.text();
    let opHint = "";
    try {
      const tx = TransactionBuilder.fromXDR(
        signedXdr.trim(),
        NETWORK_PASSPHRASE
      );
      opHint = ` (signed XDR has ${tx.operations.length} operation(s))`;
    } catch {
      /* ignore parse errors here */
    }
    logTwApiError(
      "submitTwSignedTransaction / helper/send-transaction",
      sendUrl,
      "POST",
      res.status,
      txt,
      sendPayload
    );
    if (/more than one operation/i.test(txt)) {
      console.error(
        "[TrustlessWork] send-transaction rejected multi-op tx" + opHint,
        { responseBody: txt }
      );
    }
    const hint = res.status === 401 ? twUnauthorizedHint() : "";
    throw new Error(`TW send-transaction failed: ${res.status} ${txt}.${hint}`);
  }
  let json: Record<string, unknown> = {};
  try {
    json = (await res.json()) as Record<string, unknown>;
  } catch {
    /* TW may return empty body on 200 */
  }
  console.log("[TrustlessWork] submitTwSignedTransaction TW 200 body", {
    keys: Object.keys(json),
    status: json.status,
    message: json.message,
  });
  // TW `SendTransactionResponse` is `{ status, message }` without a hash — use
  // the Stellar envelope hash (same id Soroban RPC `getTransaction` expects).
  const hash = transactionHashHexFromSignedXdr(signedXdr);
  console.log("[TrustlessWork] submitTwSignedTransaction derived tx hash", {
    hash,
    signedXdrLen: signedXdr.length,
  });
  let contractAddress = parseTwSendJsonContract(json);
  if (!contractAddress) {
    console.log(
      "[TrustlessWork] submitTwSignedTransaction no contract in TW body, polling RPC…"
    );
    contractAddress = await readEscrowContractFromSorobanTxHash(hash);
  }
  console.log("[TrustlessWork] submitTwSignedTransaction result", {
    hash,
    contractAddress: contractAddress ?? null,
  });
  return { hash, contractAddress };
}

async function signAndBroadcast(unsignedXdr: string): Promise<string> {
  const kp = adminKeypair();
  const tx = TransactionBuilder.fromXDR(unsignedXdr, NETWORK_PASSPHRASE);
  tx.sign(kp);
  const { hash } = await submitTwSignedTransaction(tx.toXDR());
  return hash;
}

// XLM SAC re-export so API routes can advertise it without depending on
// `@/lib/constants` (server-only modules tree-shaking).
export const XLM_SAC_ADDRESS = XLM_SAC;
