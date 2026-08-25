/**
 * Etherfuse API Client — server-side only.
 * Implements the shared Anchor interface for MXN <-> CETES via SPEI on Stellar.
 */

import type {
  Anchor,
  AnchorCapabilities,
  TokenInfo,
  Customer,
  Quote,
  OnRampTransaction,
  OffRampTransaction,
  CreateCustomerInput,
  GetCustomerInput,
  GetQuoteInput,
  CreateOnRampInput,
  CreateOffRampInput,
  RegisterFiatAccountInput,
  RegisteredFiatAccount,
  SavedFiatAccount,
  KycStatus,
  TransactionStatus,
} from "../types";
import { anchorRequest } from "../http";
import { AnchorError } from "../types";
import type {
  EtherfuseConfig,
  EtherfuseOnboardingResponse,
  EtherfuseCustomerResponse,
  EtherfuseQuoteResponse,
  EtherfuseCreateOnRampResponse,
  EtherfuseCreateOffRampResponse,
  EtherfuseOrderResponse,
  EtherfuseKycStatusResponse,
  EtherfuseBankAccountResponse,
  EtherfuseBankAccountListResponse,
  EtherfuseAssetsResponse,
  EtherfuseAgreementResponse,
  EtherfuseErrorResponse,
  EtherfuseOrderStatus,
  EtherfuseKycIdentityRequest,
  EtherfuseKycDocumentRequest,
} from "./types";

export class EtherfuseClient implements Anchor {
  readonly name = "etherfuse";
  readonly displayName = "Etherfuse";
  readonly capabilities: AnchorCapabilities = {
    kycUrl: true,
    requiresOffRampSigning: true,
    kycFlow: "redirect",
    deferredOffRampSigning: true,
    sandbox: true,
  };
  readonly supportedTokens: readonly TokenInfo[] = [
    {
      symbol: "CETES",
      name: "Etherfuse CETES",
      issuer: "GC3CW7EDYRTWQ635VDIGY6S4ZUF5L6TQ7AA4MWS7LEQDBLUSZXV7UPS4",
      description:
        "Mexican Federal Treasury Certificates — Mexico's oldest short-term debt securities.",
    },
  ];
  readonly supportedCurrencies: readonly string[] = ["MXN"];
  readonly supportedRails: readonly string[] = ["spei"];
  private readonly config: EtherfuseConfig;
  private readonly blockchain: string;

  constructor(config: EtherfuseConfig) {
    this.config = config;
    this.blockchain = config.defaultBlockchain || "stellar";
  }

  private dashboardUrl(path: string): string {
    const isSandbox = this.config.baseUrl.includes("sand");
    const base = isSandbox
      ? "https://devnet.etherfuse.com"
      : "https://app.etherfuse.com";
    return `${base}${path}`;
  }

  private async resolveAssetPair(
    fromCurrency: string,
    toCurrency: string,
    wallet: string,
    signal?: AbortSignal
  ): Promise<[string, string]> {
    if (fromCurrency.includes(":") && toCurrency.includes(":")) {
      return [fromCurrency, toCurrency];
    }
    const response = await this.getAssets(
      this.blockchain,
      "mxn",
      wallet,
      signal
    );
    const identifiers = new Map(
      response.assets.map((a) => [a.symbol, a.identifier])
    );
    return [
      identifiers.get(fromCurrency) ?? fromCurrency,
      identifiers.get(toCurrency) ?? toCurrency,
    ];
  }

  private async request<T>(
    method: "GET" | "POST" | "PUT" | "DELETE",
    endpoint: string,
    body?: unknown,
    signal?: AbortSignal
  ): Promise<T> {
    const url = `${this.config.baseUrl}${endpoint}`;
    const response = await anchorRequest(
      url,
      {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: this.config.apiKey,
        },
        body: body ? JSON.stringify(body) : undefined,
      },
      { signal }
    );

    if (!response.ok) {
      const errorText = await response.text();
      let errorData: EtherfuseErrorResponse = {
        error: { code: "UNKNOWN_ERROR", message: "" },
      };
      try {
        errorData = JSON.parse(errorText) as EtherfuseErrorResponse;
      } catch {
        // Not JSON
      }
      throw new AnchorError(
        errorData.error?.message ||
          errorText ||
          `Etherfuse API error: ${response.status}`,
        errorData.error?.code || "UNKNOWN_ERROR",
        response.status
      );
    }

    const text = await response.text();
    if (!text) return undefined as T;
    return JSON.parse(text) as T;
  }

  private mapOrderStatus(status: EtherfuseOrderStatus): TransactionStatus {
    const statusMap: Record<EtherfuseOrderStatus, TransactionStatus> = {
      created: "pending",
      funded: "processing",
      completed: "completed",
      failed: "failed",
      refunded: "refunded",
      canceled: "cancelled",
    };
    return statusMap[status] || "pending";
  }

  private mapKycStatus(status: string): KycStatus {
    const statusMap: Record<string, KycStatus> = {
      not_started: "not_started",
      proposed: "pending",
      approved: "approved",
      approved_chain_deploying: "approved",
      rejected: "rejected",
    };
    return statusMap[status] || "not_started";
  }

  private mapOnRampTransaction(
    response: EtherfuseOrderResponse
  ): OnRampTransaction {
    return {
      id: response.orderId,
      customerId: response.customerId,
      quoteId: "",
      status: this.mapOrderStatus(response.status),
      fromAmount: response.amountInFiat || "",
      fromCurrency: "MXN",
      toAmount: response.amountInTokens || "",
      toCurrency: "CETES",
      stellarAddress: "",
      feeBps: response.feeBps,
      feeAmount: response.feeAmountInFiat,
      paymentInstructions: response.depositClabe
        ? {
            type: "spei" as const,
            clabe: response.depositClabe,
            amount: response.amountInFiat || "",
            currency: "MXN",
          }
        : undefined,
      stellarTxHash: response.confirmedTxSignature,
      statusPage: response.statusPage,
      createdAt: response.createdAt,
      updatedAt: response.updatedAt,
    };
  }

  private mapOffRampTransaction(
    response: EtherfuseOrderResponse
  ): OffRampTransaction {
    return {
      id: response.orderId,
      customerId: response.customerId,
      quoteId: "",
      status: this.mapOrderStatus(response.status),
      fromAmount: response.amountInTokens || "",
      fromCurrency: "CETES",
      toAmount: response.amountInFiat || "",
      toCurrency: "MXN",
      stellarAddress: "",
      feeBps: response.feeBps,
      feeAmount: response.feeAmountInFiat,
      fiatAccount: response.bankAccountId
        ? { id: response.bankAccountId, type: "spei", label: "Bank Account" }
        : undefined,
      stellarTxHash: response.confirmedTxSignature,
      signableTransaction: response.burnTransaction,
      statusPage: response.statusPage,
      createdAt: response.createdAt,
      updatedAt: response.updatedAt,
    };
  }

  async createCustomer(
    input: CreateCustomerInput,
    signal?: AbortSignal
  ): Promise<Customer> {
    if (!input.publicKey) {
      throw new AnchorError(
        "publicKey is required to create an Etherfuse customer",
        "MISSING_PUBLIC_KEY",
        400
      );
    }

    const customerId = crypto.randomUUID();
    const bankAccountId = crypto.randomUUID();

    try {
      // Do NOT send claimOwnership here — that flag links the wallet to the
      // org's KYB, skipping individual KYC entirely. Customer wallets must go
      // through the Hosted UI so their KYC status starts as "not_started".
      const onboarding = await this.request<EtherfuseOnboardingResponse>(
        "POST",
        "/ramp/onboarding-url",
        {
          customerId,
          bankAccountId,
          publicKey: input.publicKey,
          blockchain: this.blockchain,
        },
        signal
      );

      const now = new Date().toISOString();
      return {
        id: customerId,
        email: input.email,
        kycStatus: "not_started",
        bankAccountId,
        onboardingUrl: onboarding.presigned_url,
        createdAt: now,
        updatedAt: now,
      };
    } catch (err) {
      if (err instanceof AnchorError && err.statusCode === 409) {
        const match = err.message.match(/see org:\s*([0-9a-f-]+)/i);
        if (match) {
          const existingCustomerId = match[1];
          // Try to recover the real bankAccountId from Etherfuse.
          // If no accounts exist yet (not bound), fall back to the one we just generated —
          // Etherfuse binds it on first use, so any valid UUID works.
          let resolvedBankAccountId: string = bankAccountId;
          try {
            const accounts = await this.getFiatAccounts(
              existingCustomerId,
              signal
            );
            if (accounts.length > 0) resolvedBankAccountId = accounts[0].id;
          } catch {
            // ignore — keep the generated bankAccountId as fallback
          }

          // Attempt to get a fresh presigned URL for the existing customer.
          // claimOwnership is omitted since the wallet is already registered.
          let onboardingUrl: string | undefined;
          try {
            onboardingUrl = await this.getKycUrl(
              existingCustomerId,
              input.publicKey,
              resolvedBankAccountId,
              signal
            );
          } catch {
            // If the URL can't be refreshed, the client will use the stored one.
          }

          const now = new Date().toISOString();
          return {
            id: existingCustomerId,
            email: input.email,
            kycStatus: "not_started",
            bankAccountId: resolvedBankAccountId,
            onboardingUrl,
            createdAt: now,
            updatedAt: now,
          };
        }
      }
      throw err;
    }
  }

  async getCustomer(
    input: GetCustomerInput,
    signal?: AbortSignal
  ): Promise<Customer | null> {
    if (!input.customerId) {
      throw new AnchorError(
        "customerId is required for Etherfuse customer lookup",
        "MISSING_CUSTOMER_ID",
        400
      );
    }
    try {
      const response = await this.request<EtherfuseCustomerResponse>(
        "GET",
        `/ramp/customer/${input.customerId}`,
        undefined,
        signal
      );
      return {
        id: response.customerId,
        email: "",
        kycStatus: "not_started",
        createdAt: response.createdAt,
        updatedAt: response.updatedAt,
      };
    } catch (error) {
      if (error instanceof AnchorError && error.statusCode === 404) return null;
      throw error;
    }
  }

  async getQuote(input: GetQuoteInput, signal?: AbortSignal): Promise<Quote> {
    const quoteId = crypto.randomUUID();
    const [sourceAsset, targetAsset] = await this.resolveAssetPair(
      input.fromCurrency,
      input.toCurrency,
      input.stellarAddress || "",
      signal
    );
    const type = sourceAsset.includes(":") ? "offramp" : "onramp";

    const response = await this.request<EtherfuseQuoteResponse>(
      "POST",
      "/ramp/quote",
      {
        quoteId,
        customerId: input.customerId,
        bankAccountId: input.resourceId,
        blockchain: this.blockchain,
        quoteAssets: { type, sourceAsset, targetAsset },
        sourceAmount: String(input.fromAmount || input.toAmount || ""),
      },
      signal
    );

    return {
      id: response.quoteId,
      fromCurrency: response.quoteAssets.sourceAsset,
      toCurrency: response.quoteAssets.targetAsset,
      fromAmount: response.sourceAmount,
      toAmount:
        response.destinationAmountAfterFee || response.destinationAmount,
      exchangeRate: response.exchangeRate,
      fee: response.feeAmount || "0",
      expiresAt: response.expiresAt,
      createdAt: response.createdAt,
    };
  }

  async createOnRamp(
    input: CreateOnRampInput,
    signal?: AbortSignal
  ): Promise<OnRampTransaction> {
    const orderId = crypto.randomUUID();
    let bankAccountId = input.bankAccountId;
    if (!bankAccountId && input.customerId) {
      const accounts = await this.getFiatAccounts(input.customerId, signal);
      if (accounts.length > 0) bankAccountId = accounts[0].id;
    }

    const response = await this.request<EtherfuseCreateOnRampResponse>(
      "POST",
      "/ramp/order",
      {
        orderId,
        bankAccountId,
        publicKey: input.stellarAddress,
        quoteId: input.quoteId,
        memo: input.memo || undefined,
      },
      signal
    );

    const { onramp } = response;
    return {
      id: onramp.orderId,
      customerId: input.customerId,
      quoteId: input.quoteId,
      status: "pending" as const,
      fromAmount: input.amount,
      fromCurrency: input.fromCurrency,
      toAmount: "",
      toCurrency: input.toCurrency,
      stellarAddress: input.stellarAddress,
      paymentInstructions: {
        type: "spei" as const,
        clabe: onramp.depositClabe,
        amount: onramp.depositAmount,
        currency: input.fromCurrency,
      },
      statusPage: this.dashboardUrl(`/ramp/order/${onramp.orderId}`),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  async getOnRampTransaction(
    transactionId: string,
    signal?: AbortSignal
  ): Promise<OnRampTransaction | null> {
    try {
      const response = await this.request<EtherfuseOrderResponse>(
        "GET",
        `/ramp/order/${transactionId}`,
        undefined,
        signal
      );
      return this.mapOnRampTransaction(response);
    } catch (error) {
      if (error instanceof AnchorError && error.statusCode === 404) return null;
      throw error;
    }
  }

  async registerFiatAccount(
    input: RegisterFiatAccountInput,
    signal?: AbortSignal
  ): Promise<RegisteredFiatAccount> {
    if (!input.publicKey) {
      throw new AnchorError(
        "publicKey is required to register a bank account with Etherfuse",
        "MISSING_PUBLIC_KEY",
        400
      );
    }
    const presignedUrl = await this.getKycUrl(
      input.customerId,
      input.publicKey,
      undefined,
      signal
    );
    const response = await this.request<EtherfuseBankAccountResponse>(
      "POST",
      "/ramp/bank-account",
      {
        presignedUrl,
        account: {
          clabe: input.account.clabe,
          beneficiary: input.account.beneficiary,
          bankName: input.account.bankName || undefined,
        },
      },
      signal
    );
    return {
      id: response.bankAccountId,
      customerId: response.customerId,
      type: "SPEI",
      status: response.status,
      createdAt: response.createdAt,
    };
  }

  async getFiatAccounts(
    customerId: string,
    signal?: AbortSignal
  ): Promise<SavedFiatAccount[]> {
    try {
      const response = await this.request<EtherfuseBankAccountListResponse>(
        "POST",
        `/ramp/customer/${customerId}/bank-accounts`,
        { pageSize: 100, pageNumber: 0 },
        signal
      );
      return response.items.map((account) => ({
        id: account.bankAccountId,
        type: "SPEI",
        accountNumber: account.abbrClabe,
        bankName: "",
        accountHolderName: "",
        createdAt: account.createdAt,
      }));
    } catch (error) {
      if (error instanceof AnchorError && error.statusCode === 404) return [];
      throw error;
    }
  }

  async createOffRamp(
    input: CreateOffRampInput,
    signal?: AbortSignal
  ): Promise<OffRampTransaction> {
    const orderId = crypto.randomUUID();
    let bankAccountId = input.fiatAccountId;
    if (!bankAccountId && input.customerId) {
      const accounts = await this.getFiatAccounts(input.customerId, signal);
      if (accounts.length > 0) bankAccountId = accounts[0].id;
    }

    const response = await this.request<EtherfuseCreateOffRampResponse>(
      "POST",
      "/ramp/order",
      {
        orderId,
        bankAccountId,
        publicKey: input.stellarAddress,
        quoteId: input.quoteId,
        memo: input.memo || undefined,
      },
      signal
    );

    return {
      id: response.offramp.orderId,
      customerId: input.customerId,
      quoteId: input.quoteId,
      status: "pending" as const,
      fromAmount: input.amount,
      fromCurrency: input.fromCurrency,
      toAmount: "",
      toCurrency: input.toCurrency,
      stellarAddress: input.stellarAddress,
      fiatAccount: bankAccountId
        ? { id: bankAccountId, type: "spei", label: "Bank Account" }
        : undefined,
      signableTransaction: undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  async getOffRampTransaction(
    transactionId: string,
    signal?: AbortSignal
  ): Promise<OffRampTransaction | null> {
    try {
      const response = await this.request<EtherfuseOrderResponse>(
        "GET",
        `/ramp/order/${transactionId}`,
        undefined,
        signal
      );
      return this.mapOffRampTransaction(response);
    } catch (error) {
      if (error instanceof AnchorError && error.statusCode === 404) return null;
      throw error;
    }
  }

  async getKycUrl(
    customerId: string,
    publicKey?: string,
    bankAccountId?: string,
    signal?: AbortSignal
  ): Promise<string> {
    if (!publicKey) {
      throw new AnchorError(
        "publicKey is required for KYC onboarding",
        "MISSING_PUBLIC_KEY",
        400
      );
    }
    const resolvedBankAccountId = bankAccountId || crypto.randomUUID();
    // Do NOT send claimOwnership here — ownership was already claimed during
    // createCustomer. Sending it again for an existing wallet causes a 409.
    const response = await this.request<EtherfuseOnboardingResponse>(
      "POST",
      "/ramp/onboarding-url",
      {
        customerId,
        bankAccountId: resolvedBankAccountId,
        publicKey,
        blockchain: this.blockchain,
      },
      signal
    );
    return response.presigned_url;
  }

  async getKycStatus(
    customerId: string,
    publicKey?: string,
    signal?: AbortSignal
  ): Promise<KycStatus> {
    if (!publicKey) {
      throw new AnchorError(
        "publicKey is required for KYC status checks",
        "MISSING_PUBLIC_KEY",
        400
      );
    }
    const response = await this.request<EtherfuseKycStatusResponse>(
      "GET",
      `/ramp/customer/${customerId}/kyc/${publicKey}`,
      undefined,
      signal
    );
    return this.mapKycStatus(response.status);
  }

  // Etherfuse-specific methods

  async getAssets(
    blockchain: string,
    currency: string,
    wallet: string,
    signal?: AbortSignal
  ): Promise<EtherfuseAssetsResponse> {
    const params = new URLSearchParams({ blockchain, currency, wallet });
    return this.request<EtherfuseAssetsResponse>(
      "GET",
      `/ramp/assets?${params.toString()}`,
      undefined,
      signal
    );
  }

  async submitKycIdentity(
    customerId: string,
    identity: EtherfuseKycIdentityRequest
  ): Promise<unknown> {
    return this.request("POST", `/ramp/customer/${customerId}/kyc`, identity);
  }

  async submitKycDocuments(
    customerId: string,
    document: EtherfuseKycDocumentRequest
  ): Promise<unknown> {
    return this.request(
      "POST",
      `/ramp/customer/${customerId}/kyc/documents`,
      document
    );
  }

  async acceptElectronicSignature(
    presignedUrl: string
  ): Promise<EtherfuseAgreementResponse> {
    return this.request<EtherfuseAgreementResponse>(
      "POST",
      "/ramp/agreements/electronic-signature",
      { presignedUrl }
    );
  }

  async acceptTermsAndConditions(
    presignedUrl: string
  ): Promise<EtherfuseAgreementResponse> {
    return this.request<EtherfuseAgreementResponse>(
      "POST",
      "/ramp/agreements/terms-and-conditions",
      { presignedUrl }
    );
  }

  async acceptCustomerAgreement(
    presignedUrl: string
  ): Promise<EtherfuseAgreementResponse> {
    return this.request<EtherfuseAgreementResponse>(
      "POST",
      "/ramp/agreements/customer-agreement",
      { presignedUrl }
    );
  }

  async acceptAgreements(
    presignedUrl: string
  ): Promise<EtherfuseAgreementResponse> {
    await this.acceptElectronicSignature(presignedUrl);
    await this.acceptTermsAndConditions(presignedUrl);
    return this.acceptCustomerAgreement(presignedUrl);
  }

  async simulateFiatReceived(
    orderId: string,
    signal?: AbortSignal
  ): Promise<number> {
    const url = `${this.config.baseUrl}/ramp/order/fiat_received`;
    const response = await anchorRequest(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: this.config.apiKey,
        },
        body: JSON.stringify({ orderId }),
      },
      { signal }
    );
    return response.status;
  }
}
