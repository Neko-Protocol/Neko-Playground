import type { AnchorProvider } from "@/lib/anchors/types";
import type {
  Quote,
  OnRampTransaction,
  OffRampTransaction,
  SavedFiatAccount,
} from "@/lib/anchors/types";

export type { AnchorProvider };

export type RampDirection = "on" | "off";

export type RampStep =
  | "select"
  | "kyc"
  | "quote"
  | "payment"
  | "bank-account"
  | "sign"
  | "pending"
  | "complete"
  | "error";

export interface RampState {
  provider: AnchorProvider;
  direction: RampDirection;
  step: RampStep;
  amount: string;
  customerId: string | null;
  quoteId: string | null;
  transactionId: string | null;
  quote: Quote | null;
  onRampTransaction: OnRampTransaction | null;
  offRampTransaction: OffRampTransaction | null;
  selectedFiatAccount: SavedFiatAccount | null;
  error: string | null;
}

export type RampAction =
  | { type: "SET_PROVIDER"; provider: AnchorProvider }
  | { type: "SET_DIRECTION"; direction: RampDirection }
  | { type: "SET_AMOUNT"; amount: string }
  | { type: "SET_STEP"; step: RampStep }
  | { type: "SET_CUSTOMER_ID"; customerId: string }
  | { type: "SET_QUOTE"; quote: Quote }
  | { type: "SET_ON_RAMP_TX"; transaction: OnRampTransaction }
  | { type: "SET_OFF_RAMP_TX"; transaction: OffRampTransaction }
  | { type: "SET_FIAT_ACCOUNT"; account: SavedFiatAccount }
  | { type: "SET_ERROR"; error: string }
  | { type: "RESET" };

export const TERMINAL_STATUSES = new Set([
  "completed",
  "failed",
  "expired",
  "cancelled",
  "refunded",
]);

export type PollOutcome = "pending" | "terminal" | "unreachable" | "timed-out";
