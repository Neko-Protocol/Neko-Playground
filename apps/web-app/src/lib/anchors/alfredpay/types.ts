/**
 * AlfredPay-specific API types
 */

export interface AlfredPayConfig {
  apiKey: string;
  apiSecret: string;
  baseUrl: string;
}

export interface AlfredPayCreateCustomerRequest {
  email: string;
  type: "INDIVIDUAL" | "BUSINESS";
  country: string;
  phoneNumber?: string;
  businessId?: string;
}

export interface AlfredPayQuoteRequest {
  fromCurrency: string;
  toCurrency: string;
  fromAmount?: string;
  toAmount?: string;
  chain: "XLM";
  paymentMethodType: "SPEI";
  customerId: string;
  businessId: string;
  metadata: Record<string, unknown>;
}

export interface AlfredPayCreateCustomerResponse {
  customerId: string;
  createdAt: string;
}

export interface AlfredPayCustomerResponse {
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  country?: string;
  city?: string;
  zipCode?: string;
  address?: string;
  statusKyc?: string;
  nationalities?: string[];
  phoneNumber?: string | null;
  occupation?: string | null;
  dni?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AlfredPayQuoteFee {
  type: "commissionFee" | "processingFee" | "taxFee" | "networkFee";
  amount: string;
  currency: string;
}

export interface AlfredPayQuoteResponse {
  quoteId: string;
  fromCurrency: string;
  toCurrency: string;
  fromAmount: string;
  toAmount: string;
  chain: string;
  paymentMethodType: string;
  expiration: string;
  fees: AlfredPayQuoteFee[];
  rate: string;
}

export interface AlfredPayPaymentInstructions {
  type: "spei";
  bank_name: string;
  account_number: string;
  clabe: string;
  beneficiary: string;
  reference: string;
  amount: string;
  currency: string;
}

export interface AlfredPayFiatPaymentInstructions {
  paymentType: string;
  clabe: string;
  reference: string;
  expirationDate: string;
  paymentDescription: string;
  bankName: string;
  accountHolderName: string;
}

export interface AlfredPayOnRampTransaction {
  transactionId: string;
  customerId: string;
  quoteId: string;
  status:
    | "CREATED"
    | "PENDING"
    | "PROCESSING"
    | "COMPLETED"
    | "FAILED"
    | "EXPIRED"
    | "CANCELLED";
  fromAmount: string;
  fromCurrency: string;
  toAmount: string;
  toCurrency: string;
  depositAddress: string;
  chain: string;
  paymentMethodType: string;
  txHash: string | null;
  memo: string;
  createdAt: string;
  updatedAt: string;
}

export interface AlfredPayOnRampResponse {
  transaction: AlfredPayOnRampTransaction;
  fiatPaymentInstructions: AlfredPayFiatPaymentInstructions;
}

export interface AlfredPayOnRampFlatResponse extends AlfredPayOnRampTransaction {
  fiatPaymentInstructions: AlfredPayFiatPaymentInstructions;
}

export interface AlfredPayBankAccount {
  id: string;
  bank_name: string;
  account_number: string;
  clabe: string;
  beneficiary: string;
}

export interface AlfredPayOffRampResponse {
  transactionId: string;
  customerId: string;
  createdAt: string;
  updatedAt: string;
  fromCurrency: string;
  toCurrency: string;
  fromAmount: string;
  toAmount: string;
  chain: string;
  status:
    | "CREATED"
    | "PENDING"
    | "PROCESSING"
    | "COMPLETED"
    | "FAILED"
    | "EXPIRED"
    | "CANCELLED";
  fiatAccountId: string;
  depositAddress: string;
  expiration: string;
  memo: string;
  externalId?: string;
  metadata?: unknown;
  txHash?: string;
  quote?: AlfredPayQuoteResponse;
}

export interface AlfredPayKycIframeResponse {
  verification_url: string;
  submissionId: string;
}

export interface AlfredPayKycRequirement {
  name: string;
  required: boolean;
  type: string;
  description?: string;
}

export interface AlfredPayKycRequirementsResponse {
  country: string;
  requirements: {
    personal: AlfredPayKycRequirement[];
    documents: AlfredPayKycRequirement[];
  };
}

export interface AlfredPayKycSubmissionRequest {
  kycSubmission: {
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    country: string;
    city: string;
    state: string;
    address: string;
    zipCode: string;
    nationalities: string[];
    email: string;
    dni: string;
  };
}

export interface AlfredPayKycSubmissionResponse {
  submissionId: string;
  status: string;
  createdAt: string;
}

export type AlfredPayKycStatus =
  | "CREATED"
  | "IN_REVIEW"
  | "UPDATE_REQUIRED"
  | "COMPLETED"
  | "FAILED";

export interface AlfredPayKycSubmissionStatusResponse {
  submissionId?: string;
  status: AlfredPayKycStatus;
  createdAt?: string;
  updatedAt?: string;
}

export type AlfredPayKycFileType =
  | "National ID Front"
  | "National ID Back"
  | "Driver Licence Front"
  | "Driver Licence Back"
  | "Selfie";

export interface AlfredPayKycFileResponse {
  fileId: string;
  fileType: AlfredPayKycFileType;
  status: string;
}

export interface AlfredPayErrorResponse {
  error: {
    code: string;
    message: string;
  };
}

export type AlfredPayFiatAccountType =
  | "SPEI"
  | "PIX"
  | "COELSA"
  | "ACH"
  | "ACH_DOM"
  | "BANK_CN"
  | "BANK_USA"
  | "ACH_CHL"
  | "ACH_BOL"
  | "B89";

export interface AlfredPayFiatAccountFields {
  accountNumber: string;
  accountType: string;
  accountName: string;
  accountBankCode: string;
  accountAlias: string;
  networkIdentifier: string;
  metadata?: {
    accountHolderName: string;
  };
}

export interface AlfredPayCreateFiatAccountRequest {
  customerId: string;
  type: AlfredPayFiatAccountType;
  fiatAccountFields: AlfredPayFiatAccountFields;
  isExternal?: boolean;
}

export interface AlfredPayFiatAccountResponse {
  fiatAccountId: string;
  customerId: string;
  type: string;
  status: string;
  createdAt: string;
}

export interface AlfredPayFiatAccountListItem {
  fiatAccountId: string;
  type: string;
  accountNumber: string;
  accountType: string;
  accountName: string;
  accountAlias: string;
  bankName: string;
  createdAt: string;
  isExternal: boolean;
  metadata?: {
    accountHolderName?: string;
  };
}

export interface AlfredPayWebhookPayload {
  event: string;
  data: {
    id: string;
    status: string;
    [key: string]: unknown;
  };
  timestamp: string;
  signature: string;
}

export type AlfredPayWebhookEventType = "KYC" | "ONRAMP" | "OFFRAMP" | "KYB";

export interface AlfredPaySandboxWebhookRequest {
  referenceId: string;
  eventType: AlfredPayWebhookEventType;
  status: string;
  metadata: Record<string, unknown> | null;
}
