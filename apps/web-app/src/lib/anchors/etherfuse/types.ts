/**
 * Etherfuse-specific API types
 */

export interface EtherfuseConfig {
  apiKey: string;
  baseUrl: string;
  defaultBlockchain?: string;
}

export interface EtherfuseOnboardingRequest {
  customerId: string;
  bankAccountId: string;
  publicKey: string;
  blockchain: string;
}

export interface EtherfuseQuoteAssets {
  type: "onramp" | "offramp" | "swap";
  sourceAsset: string;
  targetAsset: string;
}

export interface EtherfuseQuoteRequest {
  quoteId: string;
  customerId: string;
  blockchain: string;
  quoteAssets: EtherfuseQuoteAssets;
  sourceAmount: string;
}

export interface EtherfuseOrderRequest {
  orderId: string;
  bankAccountId: string;
  cryptoWalletId: string;
  quoteId: string;
  memo?: string;
}

export interface EtherfuseBankAccountRequest {
  presignedUrl: string;
  account: {
    clabe: string;
    beneficiary: string;
    bankName?: string;
  };
}

export interface EtherfuseKycIdentityRequest {
  pubkey: string;
  identity: {
    id: string;
    name: {
      givenName: string;
      familyName: string;
    };
    dateOfBirth: string;
    address: {
      street: string;
      city: string;
      region: string;
      postalCode: string;
      country: string;
    };
    idNumbers: Array<{
      value: string;
      type: string;
    }>;
  };
}

export interface EtherfuseKycDocumentRequest {
  pubkey: string;
  documentType: "document" | "selfie";
  images: Array<{
    label: "id_front" | "id_back" | "selfie";
    image: string;
  }>;
}

export interface EtherfuseOnboardingResponse {
  presigned_url: string;
}

export interface EtherfuseQuoteResponse {
  quoteId: string;
  customerId: string;
  blockchain: string;
  quoteAssets: EtherfuseQuoteAssets;
  sourceAmount: string;
  destinationAmount: string;
  exchangeRate: string;
  feeBps: string | null;
  feeAmount: string | null;
  destinationAmountAfterFee: string | null;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
}

export type EtherfuseOrderStatus =
  | "created"
  | "funded"
  | "completed"
  | "failed"
  | "refunded"
  | "canceled";

export interface EtherfuseDepositDetails {
  depositClabe: string;
  bankName: string;
  beneficiary: string;
  reference: string;
  amount: string;
  currency: string;
}

export interface EtherfuseCreateOnRampResponse {
  onramp: {
    orderId: string;
    depositClabe: string;
    depositAmount: string;
  };
}

export interface EtherfuseCreateOffRampResponse {
  offramp: {
    orderId: string;
  };
}

export interface EtherfuseOrderResponse {
  orderId: string;
  customerId: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  completedAt?: string;
  amountInFiat?: string;
  amountInTokens?: string;
  confirmedTxSignature?: string;
  walletId: string;
  bankAccountId: string;
  burnTransaction?: string;
  memo?: string;
  depositClabe?: string;
  orderType: "onramp" | "offramp";
  status: EtherfuseOrderStatus;
  statusPage: string;
  feeBps?: number;
  feeAmountInFiat?: string;
}

export interface EtherfuseCustomerResponse {
  customerId: string;
  displayName: string | null;
  createdAt: string;
  updatedAt: string;
}

export type EtherfuseKycStatus =
  | "not_started"
  | "proposed"
  | "approved"
  | "approved_chain_deploying"
  | "rejected";

export interface EtherfuseKycStatusResponse {
  customerId: string;
  walletPublicKey: string;
  status: EtherfuseKycStatus;
  onChainMarked?: boolean;
  currentRejectionReason?: string | null;
  selfies?: unknown[];
  documents?: unknown[];
  currentKycInfo?: unknown;
  approvedAt?: string | null;
}

export interface EtherfuseBankAccountResponse {
  bankAccountId: string;
  customerId: string;
  createdAt: string;
  updatedAt: string;
  abbrClabe?: string;
  etherfuseDepositClabe?: string;
  compliant?: boolean;
  status: string;
}

export type EtherfuseAgreementType =
  | "electronic_signature"
  | "terms_and_conditions"
  | "customer_agreement";

export interface EtherfuseAgreementResponse {
  success: boolean;
  acceptedAt: string;
  agreementType: EtherfuseAgreementType;
}

export interface EtherfuseBankAccountListItem {
  bankAccountId: string;
  customerId: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  abbrClabe: string;
  etherfuseDepositClabe: string;
  label?: string | null;
  compliant: boolean;
  status: string;
}

export interface EtherfuseBankAccountListResponse {
  items: EtherfuseBankAccountListItem[];
  totalItems: number;
  pageSize: number;
  pageNumber: number;
  totalPages: number;
}

export interface EtherfuseAsset {
  symbol: string;
  identifier: string;
  name: string;
  currency: string | null;
  balance: string | null;
  image: string | null;
}

export interface EtherfuseAssetsResponse {
  assets: EtherfuseAsset[];
}

export type EtherfuseWebhookEventType =
  | "bank_account_updated"
  | "customer_updated"
  | "order_updated"
  | "quote_updated"
  | "swap_updated"
  | "kyc_updated";

export interface EtherfuseWebhookPayload {
  event: EtherfuseWebhookEventType;
  data: {
    id: string;
    status: string;
    [key: string]: unknown;
  };
  timestamp: string;
}

export interface EtherfuseErrorResponse {
  error: {
    code: string;
    message: string;
  };
}
