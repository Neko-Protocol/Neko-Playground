import { z } from "zod";

export const StellarAddressSchema = z
  .string()
  .regex(/^G[A-Z2-7]{55}$/, "Invalid Stellar public key");

export const ProviderSchema = z.enum(["etherfuse", "alfredpay"]);

export const CurrencyCodeSchema = z.string().min(1).max(12);

export const AmountSchema = z
  .string()
  .regex(/^\d+(\.\d+)?$/, "Amount must be a decimal string");

export const CountrySchema = z.string().length(2).default("MX");

export const EmailSchema = z.string().email();

export const ClabeSchema = z
  .string()
  .regex(/^\d{18}$/, "CLABE must be 18 digits");

export const CustomerIdSchema = z.string().min(1);

export const QuoteIdSchema = z.string().min(1);

export const TransactionIdSchema = z.string().min(1);

export const NonEmptyStringSchema = z.string().min(1);

export const FaucetBodySchema = z.object({
  address: StellarAddressSchema,
});

export const CreateCustomerBodySchema = z.object({
  email: EmailSchema.optional(),
  country: CountrySchema.optional(),
  publicKey: StellarAddressSchema.optional(),
});

export const GetCustomerQuerySchema = z
  .object({
    email: EmailSchema.optional(),
    customerId: CustomerIdSchema.optional(),
    country: CountrySchema.optional(),
  })
  .refine((data) => data.email || data.customerId, {
    message: "email or customerId query parameter is required",
  });

export const QuoteBodySchema = z
  .object({
    fromCurrency: CurrencyCodeSchema,
    toCurrency: CurrencyCodeSchema,
    fromAmount: AmountSchema.optional(),
    toAmount: AmountSchema.optional(),
    customerId: CustomerIdSchema.optional(),
    stellarAddress: StellarAddressSchema.optional(),
    resourceId: NonEmptyStringSchema.optional(),
  })
  .refine((data) => data.fromAmount || data.toAmount, {
    message: "Either fromAmount or toAmount is required",
  });

export const OnRampBodySchema = z.object({
  customerId: CustomerIdSchema,
  quoteId: QuoteIdSchema,
  stellarAddress: StellarAddressSchema,
  fromCurrency: CurrencyCodeSchema,
  toCurrency: CurrencyCodeSchema,
  amount: AmountSchema,
  memo: z.string().optional(),
  bankAccountId: NonEmptyStringSchema.optional(),
});

export const TransactionIdQuerySchema = z.object({
  transactionId: TransactionIdSchema,
});

export const BankAccountSchema = z.object({
  bankName: z.string().optional(),
  clabe: ClabeSchema,
  beneficiary: z.string().min(1),
});

export const OffRampBodySchema = z
  .object({
    customerId: CustomerIdSchema,
    quoteId: QuoteIdSchema,
    stellarAddress: StellarAddressSchema,
    fromCurrency: CurrencyCodeSchema,
    toCurrency: CurrencyCodeSchema,
    amount: AmountSchema,
    fiatAccountId: NonEmptyStringSchema.optional(),
    bankAccount: BankAccountSchema.optional(),
    memo: z.string().optional(),
  })
  .refine((data) => data.fiatAccountId || data.bankAccount, {
    message: "Either fiatAccountId or bankAccount is required",
  });

export const OffRampSignBodySchema = z.object({
  signedXdr: NonEmptyStringSchema,
  transactionId: TransactionIdSchema.optional(),
});

export const FiatAccountBodySchema = z.object({
  customerId: CustomerIdSchema,
  publicKey: StellarAddressSchema.optional(),
  bankName: z.string().optional(),
  clabe: ClabeSchema,
  beneficiary: z.string().min(1),
});

export const CustomerIdQuerySchema = z.object({
  customerId: CustomerIdSchema,
});

export const AssetsQuerySchema = z.object({
  wallet: StellarAddressSchema,
});

export const SandboxSimulateFiatSchema = z.object({
  action: z.literal("simulateFiatReceived"),
  orderId: NonEmptyStringSchema,
});

export const SandboxCompleteKycSchema = z.object({
  action: z.literal("completeKyc"),
  submissionId: NonEmptyStringSchema,
});

export const SandboxBodySchema = z.discriminatedUnion("action", [
  SandboxSimulateFiatSchema,
  SandboxCompleteKycSchema,
]);

export const KycGetQuerySchema = z
  .object({
    customerId: CustomerIdSchema.optional(),
    type: z
      .enum(["status", "requirements", "iframe", "url", "submission"])
      .default("status"),
    country: CountrySchema.optional(),
    publicKey: StellarAddressSchema.optional(),
    bankAccountId: NonEmptyStringSchema.optional(),
  })
  .superRefine((data, ctx) => {
    const needsCustomerId = ["status", "iframe", "url", "submission"].includes(
      data.type
    );
    if (needsCustomerId && !data.customerId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "customerId query parameter is required",
        path: ["customerId"],
      });
    }
  });

export const KycSubmissionDataSchema = z.object({
  fields: z.record(z.string()),
  documents: z.record(z.string()).default({}),
  metadata: z.record(z.string()).optional(),
});

export const KycSubmitJsonBodySchema = z.object({
  customerId: CustomerIdSchema,
  data: KycSubmissionDataSchema,
});

export const KycSubmitFormFieldsSchema = z.object({
  customerId: CustomerIdSchema,
  fields: z.record(z.string()),
  metadata: z.record(z.string()).optional(),
});

export const AlfredPayKycFileTypeSchema = z.enum([
  "National ID Front",
  "National ID Back",
  "Driver Licence Front",
  "Driver Licence Back",
  "Selfie",
]);

export const KycFileUploadSchema = z.object({
  customerId: CustomerIdSchema,
  submissionId: NonEmptyStringSchema,
  fileType: AlfredPayKycFileTypeSchema,
});

export const KycPostTypeSchema = z.enum(["submit-kyc", "file"]);
