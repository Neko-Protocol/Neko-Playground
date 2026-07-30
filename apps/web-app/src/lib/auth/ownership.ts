import type { AnchorProvider } from "@/lib/anchors/types";
import { isAuthEnforced } from "./config";
import { ForbiddenError } from "./errors";
import { redisGet, redisSet } from "./redis";

export interface SessionContext {
  publicKey: string;
}

export interface TransactionBinding {
  customerId: string;
  publicKey: string;
}

function ownershipKey(provider: AnchorProvider, customerId: string): string {
  return `ownership:${provider}:${customerId}`;
}

function transactionKey(
  provider: AnchorProvider,
  transactionId: string
): string {
  return `txn:${provider}:${transactionId}`;
}

export async function bindCustomer(
  provider: AnchorProvider,
  customerId: string,
  publicKey: string
): Promise<void> {
  await redisSet(ownershipKey(provider, customerId), publicKey);
}

export async function getCustomerOwner(
  provider: AnchorProvider,
  customerId: string
): Promise<string | null> {
  return redisGet(ownershipKey(provider, customerId));
}

export async function assertOwnsCustomer(
  session: SessionContext,
  provider: AnchorProvider,
  customerId: string
): Promise<void> {
  if (!isAuthEnforced()) return;

  const owner = await getCustomerOwner(provider, customerId);
  if (!owner || owner !== session.publicKey) {
    throw new ForbiddenError("Customer does not belong to the authenticated wallet");
  }
}

export async function bindTransaction(
  provider: AnchorProvider,
  transactionId: string,
  binding: TransactionBinding
): Promise<void> {
  await redisSet(
    transactionKey(provider, transactionId),
    JSON.stringify(binding)
  );
}

export async function getTransactionBinding(
  provider: AnchorProvider,
  transactionId: string
): Promise<TransactionBinding | null> {
  const raw = await redisGet(transactionKey(provider, transactionId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as TransactionBinding;
  } catch {
    return null;
  }
}

export async function assertOwnsTransaction(
  session: SessionContext,
  provider: AnchorProvider,
  transactionId: string
): Promise<TransactionBinding> {
  if (!isAuthEnforced()) {
    return { customerId: "", publicKey: session.publicKey };
  }

  const binding = await getTransactionBinding(provider, transactionId);
  if (!binding || binding.publicKey !== session.publicKey) {
    throw new ForbiddenError(
      "Transaction does not belong to the authenticated wallet"
    );
  }
  return binding;
}

export function assertSessionPublicKey(
  session: SessionContext,
  publicKey: string
): void {
  if (!isAuthEnforced()) return;

  if (session.publicKey !== publicKey) {
    throw new ForbiddenError("Stellar address does not match session wallet");
  }
}
