/**
 * AlfredPay API Client — server-side only.
 * Implements the shared Anchor interface for MXN <-> USDC via SPEI on Stellar.
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
  PaymentInstructions,
  KycRequirements,
  KycSubmissionData,
  KycSubmissionResult,
} from "../types";
import { anchorRequest } from "../http";
import { AnchorError } from "../types";
import type {
  AlfredPayConfig,
  AlfredPayCreateCustomerResponse,
  AlfredPayCustomerResponse,
  AlfredPayQuoteResponse,
  AlfredPayOnRampResponse,
  AlfredPayOnRampFlatResponse,
  AlfredPayOffRampResponse,
  AlfredPayErrorResponse,
  AlfredPayKycRequirementsResponse,
  AlfredPayKycSubmissionRequest,
  AlfredPayKycSubmissionResponse,
  AlfredPayKycFileType,
  AlfredPayKycFileResponse,
  AlfredPayKycSubmissionStatusResponse,
  AlfredPayKycIframeResponse,
  AlfredPayFiatAccountResponse,
  AlfredPayFiatAccountListItem,
  AlfredPaySandboxWebhookRequest,
} from "./types";

export class AlfredPayClient implements Anchor {
  readonly name = "alfredpay";
  readonly displayName = "Alfred Pay";
  readonly capabilities: AnchorCapabilities = {
    emailLookup: true,
    kycUrl: true,
    kycFlow: "form",
    sandbox: true,
  };
  readonly supportedTokens: readonly TokenInfo[] = [
    {
      symbol: "USDC",
      name: "USD Coin",
      issuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
      description: "A fully-reserved stablecoin pegged 1:1 to the US Dollar",
    },
  ];
  readonly supportedCurrencies: readonly string[] = ["MXN"];
  readonly supportedRails: readonly string[] = ["spei"];
  private readonly config: AlfredPayConfig;

  constructor(config: AlfredPayConfig) {
    this.config = config;
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
          "api-key": this.config.apiKey,
          "api-secret": this.config.apiSecret,
        },
        body: body ? JSON.stringify(body) : undefined,
      },
      { signal }
    );

    if (!response.ok) {
      const errorText = await response.text();
      let errorData: AlfredPayErrorResponse = {
        error: { code: "UNKNOWN_ERROR", message: "" },
      };
      try {
        errorData = JSON.parse(errorText) as AlfredPayErrorResponse;
      } catch {
        // Not JSON
      }
      throw new AnchorError(
        errorData.error?.message ||
          errorText ||
          `AlfredPay API error: ${response.status}`,
        errorData.error?.code || "UNKNOWN_ERROR",
        response.status
      );
    }

    const data = await response.json();
    return data as T;
  }

  private mapQuote(response: AlfredPayQuoteResponse): Quote {
    const totalFee = response.fees
      .reduce((sum, fee) => sum + parseFloat(fee.amount), 0)
      .toFixed(2);
    return {
      id: response.quoteId,
      fromCurrency: response.fromCurrency,
      toCurrency: response.toCurrency,
      fromAmount: response.fromAmount,
      toAmount: response.toAmount,
      exchangeRate: response.rate,
      fee: totalFee,
      expiresAt: response.expiration,
      createdAt: new Date().toISOString(),
    };
  }

  private mapPaymentInstructions(
    instructions: AlfredPayOnRampResponse["fiatPaymentInstructions"],
    amount: string,
    currency: string
  ): PaymentInstructions {
    return {
      type: "spei",
      clabe: instructions.clabe,
      bankName: instructions.bankName,
      beneficiary: instructions.accountHolderName,
      reference: instructions.reference,
      amount,
      currency,
    };
  }

  private mapOnRampTransaction(
    response: AlfredPayOnRampResponse
  ): OnRampTransaction {
    const tx = response.transaction;
    const statusMap: Record<string, OnRampTransaction["status"]> = {
      CREATED: "pending",
      PENDING: "pending",
      PROCESSING: "processing",
      COMPLETED: "completed",
      FAILED: "failed",
      EXPIRED: "expired",
      CANCELLED: "cancelled",
    };
    return {
      id: tx.transactionId,
      customerId: tx.customerId,
      quoteId: tx.quoteId,
      status: statusMap[tx.status] || "pending",
      fromAmount: tx.fromAmount,
      fromCurrency: tx.fromCurrency,
      toAmount: tx.toAmount,
      toCurrency: tx.toCurrency,
      stellarAddress: tx.depositAddress,
      paymentInstructions: this.mapPaymentInstructions(
        response.fiatPaymentInstructions,
        tx.fromAmount,
        tx.fromCurrency
      ),
      stellarTxHash: tx.txHash || undefined,
      createdAt: tx.createdAt,
      updatedAt: tx.updatedAt,
    };
  }

  private mapOnRampFlatTransaction(
    response: AlfredPayOnRampFlatResponse
  ): OnRampTransaction {
    const statusMap: Record<string, OnRampTransaction["status"]> = {
      CREATED: "pending",
      PENDING: "pending",
      PROCESSING: "processing",
      COMPLETED: "completed",
      FAILED: "failed",
      EXPIRED: "expired",
      CANCELLED: "cancelled",
    };
    return {
      id: response.transactionId,
      customerId: response.customerId,
      quoteId: response.quoteId,
      status: statusMap[response.status] || "pending",
      fromAmount: response.fromAmount,
      fromCurrency: response.fromCurrency,
      toAmount: response.toAmount,
      toCurrency: response.toCurrency,
      stellarAddress: response.depositAddress,
      paymentInstructions: this.mapPaymentInstructions(
        response.fiatPaymentInstructions,
        response.fromAmount,
        response.fromCurrency
      ),
      stellarTxHash: response.txHash || undefined,
      createdAt: response.createdAt,
      updatedAt: response.updatedAt,
    };
  }

  private mapOffRampTransaction(
    response: AlfredPayOffRampResponse
  ): OffRampTransaction {
    const statusMap: Record<string, OffRampTransaction["status"]> = {
      CREATED: "pending",
      PENDING: "pending",
      PROCESSING: "processing",
      COMPLETED: "completed",
      FAILED: "failed",
      EXPIRED: "expired",
      CANCELLED: "cancelled",
    };
    return {
      id: response.transactionId,
      customerId: response.customerId,
      quoteId: response.quote?.quoteId || "",
      status: statusMap[response.status] || "pending",
      fromAmount: response.fromAmount,
      fromCurrency: response.fromCurrency,
      toAmount: response.toAmount,
      toCurrency: response.toCurrency,
      stellarAddress: response.depositAddress,
      fiatAccount: response.fiatAccountId
        ? { id: response.fiatAccountId, type: "spei", label: "SPEI Account" }
        : undefined,
      memo: response.memo,
      stellarTxHash: response.txHash,
      createdAt: response.createdAt,
      updatedAt: response.updatedAt,
    };
  }

  async createCustomer(
    input: CreateCustomerInput,
    signal?: AbortSignal
  ): Promise<Customer> {
    if (!input.email) {
      throw new AnchorError(
        "email is required for AlfredPay",
        "MISSING_EMAIL",
        400
      );
    }
    const response = await this.request<AlfredPayCreateCustomerResponse>(
      "POST",
      "/customers/create",
      {
        email: input.email,
        type: "INDIVIDUAL",
        country: input.country || "MX",
      },
      signal
    );
    return {
      id: response.customerId,
      email: input.email,
      kycStatus: "not_started",
      createdAt: response.createdAt,
      updatedAt: response.createdAt,
    };
  }

  async getCustomer(
    input: GetCustomerInput,
    signal?: AbortSignal
  ): Promise<Customer | null> {
    if (!input.email) {
      throw new AnchorError(
        "email is required for AlfredPay customer lookup",
        "MISSING_EMAIL",
        400
      );
    }
    const country = input.country || "MX";
    try {
      const response = await this.request<{ customerId: string }>(
        "GET",
        `/customers/find/${encodeURIComponent(input.email)}/${country}`,
        undefined,
        signal
      );
      return {
        id: response.customerId,
        email: input.email,
        kycStatus: "not_started",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    } catch (error) {
      if (error instanceof AnchorError && error.statusCode === 404) return null;
      throw error;
    }
  }

  async getQuote(input: GetQuoteInput, signal?: AbortSignal): Promise<Quote> {
    const body: Record<string, unknown> = {
      fromCurrency: input.fromCurrency,
      toCurrency: input.toCurrency,
      chain: "XLM",
      paymentMethodType: "SPEI",
      customerId: input.customerId || "",
      businessId: "",
      metadata: {},
    };
    if (input.fromAmount) body.fromAmount = String(input.fromAmount);
    if (input.toAmount) body.toAmount = String(input.toAmount);

    const response = await this.request<AlfredPayQuoteResponse>(
      "POST",
      "/quotes",
      body,
      signal
    );
    return this.mapQuote(response);
  }

  async createOnRamp(
    input: CreateOnRampInput,
    signal?: AbortSignal
  ): Promise<OnRampTransaction> {
    const response = await this.request<AlfredPayOnRampResponse>(
      "POST",
      "/onramp",
      {
        customerId: input.customerId,
        quoteId: input.quoteId,
        fromCurrency: input.fromCurrency,
        toCurrency: input.toCurrency,
        amount: input.amount,
        chain: "XLM",
        paymentMethodType: "SPEI",
        depositAddress: input.stellarAddress,
        memo: input.memo || "",
        onrampTransactionRequiredFieldsJson: {},
      },
      signal
    );
    return this.mapOnRampTransaction(response);
  }

  async getOnRampTransaction(
    transactionId: string,
    signal?: AbortSignal
  ): Promise<OnRampTransaction | null> {
    try {
      const response = await this.request<AlfredPayOnRampFlatResponse>(
        "GET",
        `/onramp/${transactionId}`,
        undefined,
        signal
      );
      return this.mapOnRampFlatTransaction(response);
    } catch (error) {
      if (error instanceof AnchorError && error.statusCode === 404) return null;
      throw error;
    }
  }

  async registerFiatAccount(
    input: RegisterFiatAccountInput,
    signal?: AbortSignal
  ): Promise<RegisteredFiatAccount> {
    const response = await this.request<AlfredPayFiatAccountResponse>(
      "POST",
      "/fiatAccounts",
      {
        customerId: input.customerId,
        type: "SPEI",
        fiatAccountFields: {
          accountNumber: input.account.clabe,
          accountType: "CHECKING",
          accountName: input.account.beneficiary,
          accountBankCode: input.account.bankName || "",
          accountAlias: input.account.beneficiary,
          networkIdentifier: input.account.clabe,
          metadata: { accountHolderName: input.account.beneficiary },
        },
        isExternal: true,
      },
      signal
    );
    return {
      id: response.fiatAccountId,
      customerId: response.customerId,
      type: response.type,
      status: response.status,
      createdAt: response.createdAt,
    };
  }

  async getFiatAccounts(
    customerId: string,
    signal?: AbortSignal
  ): Promise<SavedFiatAccount[]> {
    try {
      const response = await this.request<AlfredPayFiatAccountListItem[]>(
        "GET",
        `/fiatAccounts?customerId=${customerId}`,
        undefined,
        signal
      );
      return response.map((account) => ({
        id: account.fiatAccountId,
        type: account.type,
        accountNumber: account.accountNumber,
        bankName: account.bankName,
        accountHolderName:
          account.metadata?.accountHolderName ||
          account.accountAlias ||
          account.accountName,
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
    const response = await this.request<AlfredPayOffRampResponse>(
      "POST",
      "/offramp",
      {
        customerId: input.customerId,
        quoteId: input.quoteId,
        fiatAccountId: input.fiatAccountId,
        fromCurrency: input.fromCurrency,
        toCurrency: input.toCurrency,
        amount: input.amount,
        chain: "XLM",
        memo: input.memo || "",
        originAddress: input.stellarAddress,
      },
      signal
    );
    return this.mapOffRampTransaction(response);
  }

  async getOffRampTransaction(
    transactionId: string,
    signal?: AbortSignal
  ): Promise<OffRampTransaction | null> {
    try {
      const response = await this.request<AlfredPayOffRampResponse>(
        "GET",
        `/offramp/${transactionId}`,
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
    country: string = "MX",
    _publicKey?: string,
    signal?: AbortSignal
  ): Promise<string> {
    const response = await this.request<AlfredPayKycIframeResponse>(
      "GET",
      `/customers/${customerId}/kyc/${country}/url`,
      undefined,
      signal
    );
    return response.verification_url;
  }

  async getKycStatus(
    customerId: string,
    _publicKey?: string,
    signal?: AbortSignal
  ): Promise<KycStatus> {
    const response = await this.request<AlfredPayCustomerResponse>(
      "GET",
      `/customers/${customerId}`,
      undefined,
      signal
    );
    const raw = response.statusKyc?.toUpperCase();
    const statusMap: Record<string, KycStatus> = {
      IN_REVIEW: "pending",
      COMPLETED: "approved",
      APPROVED: "approved",
      REJECTED: "rejected",
      UPDATE_REQUIRED: "update_required",
      FAILED: "rejected",
    };
    return statusMap[raw ?? ""] ?? "not_started";
  }

  async getKycSubmission(
    customerId: string,
    signal?: AbortSignal
  ): Promise<AlfredPayKycSubmissionResponse | null> {
    try {
      return await this.request<AlfredPayKycSubmissionResponse>(
        "GET",
        `/customers/kyc/${customerId}`,
        undefined,
        signal
      );
    } catch (error) {
      if (error instanceof AnchorError && error.statusCode === 404) return null;
      throw error;
    }
  }

  async getKycSubmissionStatus(
    customerId: string,
    submissionId: string,
    signal?: AbortSignal
  ): Promise<AlfredPayKycSubmissionStatusResponse> {
    return this.request<AlfredPayKycSubmissionStatusResponse>(
      "GET",
      `/customers/${customerId}/kyc/${submissionId}/status`,
      undefined,
      signal
    );
  }

  async getKycRequirementsRaw(
    country: string = "MX"
  ): Promise<AlfredPayKycRequirementsResponse> {
    return this.request<AlfredPayKycRequirementsResponse>(
      "GET",
      `/kycRequirements?country=${country}`
    );
  }

  async getKycRequirements(
    _country?: string,
    _signal?: AbortSignal
  ): Promise<KycRequirements> {
    return {
      fields: [
        { key: "firstName", label: "First Name", type: "text", required: true },
        { key: "lastName", label: "Last Name", type: "text", required: true },
        {
          key: "dateOfBirth",
          label: "Date of Birth",
          type: "date",
          required: true,
        },
        {
          key: "dni",
          label: "National ID Number (CURP/INE)",
          type: "text",
          required: true,
          placeholder: "18 character CURP",
        },
        {
          key: "country",
          label: "Country",
          type: "select",
          required: true,
          options: [{ value: "MX", label: "Mexico" }],
        },
        {
          key: "address",
          label: "Street Address",
          type: "text",
          required: true,
        },
        { key: "city", label: "City", type: "text", required: true },
        { key: "state", label: "State", type: "text", required: true },
        { key: "zipCode", label: "ZIP Code", type: "text", required: true },
      ],
      documents: [
        {
          key: "idFront",
          label: "National ID - Front",
          description: "INE/IFE front side with your photo",
          accept: "image/jpeg,image/png,application/pdf",
          mode: "file_upload",
        },
        {
          key: "idBack",
          label: "National ID - Back",
          description: "INE/IFE back side",
          accept: "image/jpeg,image/png,application/pdf",
          mode: "file_upload",
        },
        {
          key: "selfie",
          label: "Selfie",
          description: "Clear photo of your face, similar to your ID photo",
          accept: "image/jpeg,image/png",
          mode: "file_upload",
        },
      ],
    };
  }

  async submitKyc(
    customerId: string,
    data: KycSubmissionData,
    signal?: AbortSignal
  ): Promise<KycSubmissionResult> {
    const kycData = {
      firstName: data.fields.firstName || "",
      lastName: data.fields.lastName || "",
      dateOfBirth: data.fields.dateOfBirth || "",
      country: data.fields.country || "MX",
      city: data.fields.city || "",
      state: data.fields.state || "",
      address: data.fields.address || "",
      zipCode: data.fields.zipCode || "",
      nationalities: [data.fields.country || "MX"],
      email: data.fields.email || "",
      dni: data.fields.dni || "",
    };

    const submission = await this.submitKycData(customerId, kycData, signal);
    const submissionId = submission.submissionId;

    const fileTypeMap: Record<string, AlfredPayKycFileType> = {
      idFront: "National ID Front",
      idBack: "National ID Back",
      selfie: "Selfie",
    };

    for (const [key, fileType] of Object.entries(fileTypeMap)) {
      const doc = data.documents[key];
      if (doc && doc instanceof Blob) {
        const filename = doc instanceof File ? doc.name : `${key}.jpg`;
        await this.submitKycFile(
          customerId,
          submissionId,
          fileType,
          doc,
          filename,
          signal
        );
      }
    }

    const statusResponse = await this.getKycSubmissionStatus(
      customerId,
      submissionId,
      signal
    );
    if (statusResponse.status === "CREATED") {
      await this.finalizeKycSubmission(customerId, submissionId, signal);
    }

    return { customerId, kycStatus: "pending", submissionId };
  }

  async submitKycData(
    customerId: string,
    data: AlfredPayKycSubmissionRequest["kycSubmission"],
    signal?: AbortSignal
  ): Promise<AlfredPayKycSubmissionResponse> {
    return this.request<AlfredPayKycSubmissionResponse>(
      "POST",
      `/customers/${customerId}/kyc`,
      { kycSubmission: data },
      signal
    );
  }

  async finalizeKycSubmission(
    customerId: string,
    submissionId: string,
    signal?: AbortSignal
  ): Promise<void> {
    await this.request<{ message: string }>(
      "POST",
      `/customers/${customerId}/kyc/${submissionId}/submit`,
      undefined,
      signal
    );
  }

  async submitKycFile(
    customerId: string,
    submissionId: string,
    fileType: AlfredPayKycFileType,
    file: Blob,
    filename: string,
    signal?: AbortSignal
  ): Promise<AlfredPayKycFileResponse> {
    const url = `${this.config.baseUrl}/customers/${customerId}/kyc/${submissionId}/files`;
    const formData = new FormData();
    formData.append("fileBody", file, filename);
    formData.append("fileType", fileType);

    const response = await anchorRequest(
      url,
      {
        method: "POST",
        headers: {
          "api-key": this.config.apiKey,
          "api-secret": this.config.apiSecret,
        },
        body: formData,
      },
      { signal }
    );

    if (!response.ok) {
      const errorText = await response.text();
      let errorData: AlfredPayErrorResponse = {
        error: { code: "UNKNOWN_ERROR", message: "" },
      };
      try {
        errorData = JSON.parse(errorText) as AlfredPayErrorResponse;
      } catch {
        // Not JSON
      }
      throw new AnchorError(
        errorData.error?.message ||
          errorText ||
          `AlfredPay API error: ${response.status}`,
        errorData.error?.code || "UNKNOWN_ERROR",
        response.status
      );
    }

    return response.json() as Promise<AlfredPayKycFileResponse>;
  }

  async sendSandboxWebhook(
    webhook: AlfredPaySandboxWebhookRequest,
    signal?: AbortSignal
  ): Promise<void> {
    await this.request<{ message: string }>(
      "POST",
      "/webhooks",
      webhook,
      signal
    );
  }

  async completeKycSandbox(
    submissionId: string,
    signal?: AbortSignal
  ): Promise<void> {
    await this.sendSandboxWebhook(
      {
        referenceId: submissionId,
        eventType: "KYC",
        status: "COMPLETED",
        metadata: null,
      },
      signal
    );
  }
}
