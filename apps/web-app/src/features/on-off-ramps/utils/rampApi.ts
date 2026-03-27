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

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
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
}

const BASE = "/api/anchor";

// Customers
export async function createCustomer(
  provider: AnchorProvider,
  data: { email?: string; country?: string; publicKey?: string }
): Promise<Customer> {
  return apiFetch<Customer>(`${BASE}/${provider}/customers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function getCustomer(
  provider: AnchorProvider,
  params: { email?: string; customerId?: string; country?: string }
): Promise<Customer | null> {
  const query = new URLSearchParams();
  if (params.email) query.set("email", params.email);
  if (params.customerId) query.set("customerId", params.customerId);
  if (params.country) query.set("country", params.country);
  try {
    return await apiFetch<Customer>(`${BASE}/${provider}/customers?${query}`);
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
  }
): Promise<Quote> {
  return apiFetch<Quote>(`${BASE}/${provider}/quotes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
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
  }
): Promise<OnRampTransaction> {
  return apiFetch<OnRampTransaction>(`${BASE}/${provider}/onramp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function getOnRampTransaction(
  provider: AnchorProvider,
  transactionId: string
): Promise<OnRampTransaction | null> {
  try {
    return await apiFetch<OnRampTransaction>(
      `${BASE}/${provider}/onramp?transactionId=${transactionId}`
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
  }
): Promise<OffRampTransaction> {
  return apiFetch<OffRampTransaction>(`${BASE}/${provider}/offramp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function getOffRampTransaction(
  provider: AnchorProvider,
  transactionId: string
): Promise<OffRampTransaction | null> {
  try {
    return await apiFetch<OffRampTransaction>(
      `${BASE}/${provider}/offramp?transactionId=${transactionId}`
    );
  } catch (err) {
    if (err instanceof RampApiError && err.status === 404) return null;
    throw err;
  }
}

export async function submitSignedXdr(
  provider: AnchorProvider,
  signedXdr: string,
  transactionId: string
): Promise<{ success: boolean; hash: string }> {
  return apiFetch<{ success: boolean; hash: string }>(
    `${BASE}/${provider}/offramp/sign`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signedXdr, transactionId }),
    }
  );
}

// KYC
export async function getKycStatus(
  provider: AnchorProvider,
  customerId: string,
  publicKey?: string
): Promise<KycStatus> {
  const query = new URLSearchParams({ customerId });
  if (publicKey) query.set("publicKey", publicKey);
  const res = await apiFetch<{ status: KycStatus }>(
    `${BASE}/${provider}/kyc?${query}`
  );
  return res.status;
}

export async function getKycUrl(
  provider: AnchorProvider,
  customerId: string,
  publicKey?: string,
  bankAccountId?: string
): Promise<string> {
  const query = new URLSearchParams({ customerId, type: "iframe" });
  if (publicKey) query.set("publicKey", publicKey);
  if (bankAccountId) query.set("bankAccountId", bankAccountId);
  const res = await apiFetch<{ url: string }>(
    `${BASE}/${provider}/kyc?${query}`
  );
  return res.url;
}

export async function getKycRequirements(
  provider: AnchorProvider,
  country: string = "MX"
): Promise<KycRequirements> {
  return apiFetch<KycRequirements>(
    `${BASE}/${provider}/kyc?type=requirements&country=${country}`
  );
}

export async function submitKyc(
  provider: AnchorProvider,
  customerId: string,
  data: {
    fields: Record<string, string>;
    documents: Record<string, File | string>;
  }
): Promise<KycSubmissionResult> {
  return apiFetch<KycSubmissionResult>(
    `${BASE}/${provider}/kyc?type=submit-kyc`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerId, data }),
    }
  );
}

// Fiat Accounts
export async function getFiatAccounts(
  provider: AnchorProvider,
  customerId: string
): Promise<SavedFiatAccount[]> {
  return apiFetch<SavedFiatAccount[]>(
    `${BASE}/${provider}/fiat-accounts?customerId=${customerId}`
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
  }
): Promise<RegisteredFiatAccount> {
  return apiFetch<RegisteredFiatAccount>(`${BASE}/${provider}/fiat-accounts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

// Assets (Etherfuse — trustline check)
export async function getEtherfuseAssets(
  provider: AnchorProvider,
  wallet: string
): Promise<{
  assets: { symbol: string; identifier: string; balance: string | null }[];
}> {
  return apiFetch(
    `${BASE}/${provider}/assets?wallet=${encodeURIComponent(wallet)}`
  );
}

// Sandbox
export async function simulateFiatReceived(
  provider: AnchorProvider,
  orderId: string
): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`${BASE}/${provider}/sandbox`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "simulateFiatReceived", orderId }),
  });
}
