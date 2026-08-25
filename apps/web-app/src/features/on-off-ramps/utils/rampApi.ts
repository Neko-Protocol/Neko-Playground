import type {
  Customer,
  Quote,
  OnRampTransaction,
  OffRampTransaction,
  SavedFiatAccount,
  RegisteredFiatAccount,
  KycStatus,
  KycRequirements,
  KycSubmissionResult,
  AnchorProvider,
} from "@/lib/anchors/types";
import { RAMP_API_TIMEOUT_MS } from "../constants/ramp.config";

export class RampApiError extends Error {
  code: string;
  status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = "RampApiError";
    this.code = code;
    this.status = status;
  }
}

export interface RampApiRequestInit extends RequestInit {
  timeoutMs?: number;
}

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  );
}

function combineSignals(
  timeoutMs: number,
  callerSignal?: AbortSignal
): { signal: AbortSignal; cleanup: () => void } {
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => {
    timeoutController.abort("timeout");
  }, timeoutMs);

  const onCallerAbort = () => {
    timeoutController.abort(callerSignal?.reason);
  };

  if (callerSignal) {
    if (callerSignal.aborted) {
      clearTimeout(timeoutId);
      timeoutController.abort(callerSignal.reason);
    } else {
      callerSignal.addEventListener("abort", onCallerAbort, { once: true });
    }
  }

  const cleanup = () => {
    clearTimeout(timeoutId);
    if (callerSignal) {
      callerSignal.removeEventListener("abort", onCallerAbort);
    }
  };

  return { signal: timeoutController.signal, cleanup };
}

function isTimeoutAbort(signal: AbortSignal): boolean {
  return signal.aborted && signal.reason === "timeout";
}

async function apiFetch<T>(
  url: string,
  options: RampApiRequestInit = {}
): Promise<T> {
  const {
    timeoutMs = RAMP_API_TIMEOUT_MS,
    signal: callerSignal,
    ...init
  } = options;
  const { signal, cleanup } = combineSignals(
    timeoutMs,
    callerSignal ?? undefined
  );

  try {
    if (signal.aborted) {
      if (isTimeoutAbort(signal)) {
        throw new RampApiError("Request timed out", "TIMEOUT", 504);
      }
      throw new DOMException("Aborted", "AbortError");
    }

    const res = await fetch(url, { ...init, signal });

    if (!res.ok) {
      let body: { error?: string; code?: string } = {};
      try {
        body = await res.json();
      } catch {
        // ignore
      }
      throw new RampApiError(
        body.error || `API error ${res.status}`,
        body.code || "UNKNOWN_ERROR",
        res.status
      );
    }

    return res.json() as Promise<T>;
  } catch (error) {
    if (isAbortError(error)) {
      if (isTimeoutAbort(signal)) {
        throw new RampApiError("Request timed out", "TIMEOUT", 504);
      }
      throw error;
    }

    if (error instanceof RampApiError) {
      throw error;
    }

    throw new RampApiError(
      error instanceof Error ? error.message : "Network request failed",
      "UNREACHABLE",
      503
    );
  } finally {
    cleanup();
  }
}

const BASE = "/api/anchor";

// Customers
export async function createCustomer(
  provider: AnchorProvider,
  data: { email?: string; country?: string; publicKey?: string },
  options?: RampApiRequestInit
): Promise<Customer> {
  return apiFetch<Customer>(`${BASE}/${provider}/customers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
    ...options,
  });
}

export async function getCustomer(
  provider: AnchorProvider,
  params: { email?: string; customerId?: string; country?: string },
  options?: RampApiRequestInit
): Promise<Customer | null> {
  const query = new URLSearchParams();
  if (params.email) query.set("email", params.email);
  if (params.customerId) query.set("customerId", params.customerId);
  if (params.country) query.set("country", params.country);
  try {
    return await apiFetch<Customer>(
      `${BASE}/${provider}/customers?${query}`,
      options
    );
  } catch (err) {
    if (err instanceof RampApiError && err.status === 404) return null;
    throw err;
  }
}

// Quotes
export async function getQuote(
  provider: AnchorProvider,
  data: {
    fromCurrency: string;
    toCurrency: string;
    fromAmount?: string;
    toAmount?: string;
    customerId?: string;
    stellarAddress?: string;
    resourceId?: string;
  },
  options?: RampApiRequestInit
): Promise<Quote> {
  return apiFetch<Quote>(`${BASE}/${provider}/quotes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
    ...options,
  });
}

// On-Ramp
export async function createOnRamp(
  provider: AnchorProvider,
  data: {
    customerId: string;
    quoteId: string;
    stellarAddress: string;
    fromCurrency: string;
    toCurrency: string;
    amount: string;
    memo?: string;
    bankAccountId?: string;
  },
  options?: RampApiRequestInit
): Promise<OnRampTransaction> {
  return apiFetch<OnRampTransaction>(`${BASE}/${provider}/onramp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
    ...options,
  });
}

export async function getOnRampTransaction(
  provider: AnchorProvider,
  transactionId: string,
  options?: RampApiRequestInit
): Promise<OnRampTransaction | null> {
  try {
    return await apiFetch<OnRampTransaction>(
      `${BASE}/${provider}/onramp?transactionId=${transactionId}`,
      options
    );
  } catch (err) {
    if (err instanceof RampApiError && err.status === 404) return null;
    throw err;
  }
}

// Off-Ramp
export async function createOffRamp(
  provider: AnchorProvider,
  data: {
    customerId: string;
    quoteId: string;
    stellarAddress: string;
    fromCurrency: string;
    toCurrency: string;
    amount: string;
    fiatAccountId?: string;
    bankAccount?: { clabe: string; beneficiary: string; bankName?: string };
    memo?: string;
  },
  options?: RampApiRequestInit
): Promise<OffRampTransaction> {
  return apiFetch<OffRampTransaction>(`${BASE}/${provider}/offramp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
    ...options,
  });
}

export async function getOffRampTransaction(
  provider: AnchorProvider,
  transactionId: string,
  options?: RampApiRequestInit
): Promise<OffRampTransaction | null> {
  try {
    return await apiFetch<OffRampTransaction>(
      `${BASE}/${provider}/offramp?transactionId=${transactionId}`,
      options
    );
  } catch (err) {
    if (err instanceof RampApiError && err.status === 404) return null;
    throw err;
  }
}

export async function submitSignedXdr(
  provider: AnchorProvider,
  signedXdr: string,
  transactionId: string,
  options?: RampApiRequestInit
): Promise<{ success: boolean; hash: string }> {
  return apiFetch<{ success: boolean; hash: string }>(
    `${BASE}/${provider}/offramp/sign`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signedXdr, transactionId }),
      ...options,
    }
  );
}

// KYC
export async function getKycStatus(
  provider: AnchorProvider,
  customerId: string,
  publicKey?: string,
  options?: RampApiRequestInit
): Promise<KycStatus> {
  const query = new URLSearchParams({ customerId });
  if (publicKey) query.set("publicKey", publicKey);
  const res = await apiFetch<{ status: KycStatus }>(
    `${BASE}/${provider}/kyc?${query}`,
    options
  );
  return res.status;
}

export async function getKycUrl(
  provider: AnchorProvider,
  customerId: string,
  publicKey?: string,
  bankAccountId?: string,
  options?: RampApiRequestInit
): Promise<string> {
  const query = new URLSearchParams({ customerId, type: "iframe" });
  if (publicKey) query.set("publicKey", publicKey);
  if (bankAccountId) query.set("bankAccountId", bankAccountId);
  const res = await apiFetch<{ url: string }>(
    `${BASE}/${provider}/kyc?${query}`,
    options
  );
  return res.url;
}

export async function getKycRequirements(
  provider: AnchorProvider,
  country: string = "MX",
  options?: RampApiRequestInit
): Promise<KycRequirements> {
  return apiFetch<KycRequirements>(
    `${BASE}/${provider}/kyc?type=requirements&country=${country}`,
    options
  );
}

export async function submitKyc(
  provider: AnchorProvider,
  customerId: string,
  data: {
    fields: Record<string, string>;
    documents: Record<string, File | string>;
  },
  options?: RampApiRequestInit
): Promise<KycSubmissionResult> {
  return apiFetch<KycSubmissionResult>(
    `${BASE}/${provider}/kyc?type=submit-kyc`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerId, data }),
      ...options,
    }
  );
}

// Fiat Accounts
export async function getFiatAccounts(
  provider: AnchorProvider,
  customerId: string,
  options?: RampApiRequestInit
): Promise<SavedFiatAccount[]> {
  return apiFetch<SavedFiatAccount[]>(
    `${BASE}/${provider}/fiat-accounts?customerId=${customerId}`,
    options
  );
}

export async function registerFiatAccount(
  provider: AnchorProvider,
  data: {
    customerId: string;
    clabe: string;
    beneficiary: string;
    bankName?: string;
    publicKey?: string;
  },
  options?: RampApiRequestInit
): Promise<RegisteredFiatAccount> {
  return apiFetch<RegisteredFiatAccount>(`${BASE}/${provider}/fiat-accounts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
    ...options,
  });
}

// Assets (Etherfuse — trustline check)
export async function getEtherfuseAssets(
  provider: AnchorProvider,
  wallet: string,
  options?: RampApiRequestInit
): Promise<{
  assets: { symbol: string; identifier: string; balance: string | null }[];
}> {
  return apiFetch(
    `${BASE}/${provider}/assets?wallet=${encodeURIComponent(wallet)}`,
    options
  );
}

// Sandbox
export async function simulateFiatReceived(
  provider: AnchorProvider,
  orderId: string,
  options?: RampApiRequestInit
): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`${BASE}/${provider}/sandbox`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "simulateFiatReceived", orderId }),
    ...options,
  });
}
