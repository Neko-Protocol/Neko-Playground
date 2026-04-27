import type { ActivityType } from "../types/activity";

export interface ActivityEntry {
  id: string;
  type: ActivityType;
  assetCode: string;
  amount: string;
  timestamp: string;
  transactionHash: string;
  status: "success" | "failed";
  link: string;
}

export type ActivityType =
  | "deposit"
  | "withdraw"
  | "borrow"
  | "repay"
  | "swap"
  | "pool_join"
  | "pool_exit"
  | "claim_rewards"
  | "transfer"
  | "unknown";
