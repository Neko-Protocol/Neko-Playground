import type { Transaction } from "@stellar/stellar-sdk";
import { Address, scValToNative, xdr } from "@stellar/stellar-sdk";

/** JSON-safe view of each tx operation (classic + Soroban). */
export type OperationSummary =
  | {
      index: number;
      body: "invokeHostFunction";
      hostFunctionType: string;
      contractId?: string;
      functionName?: string;
      argCount?: number;
      argsPreview?: unknown[];
      sorobanAuthEntries?: number;
    }
  | {
      index: number;
      body: string;
      note?: string;
    };

function previewScVal(v: xdr.ScVal): unknown {
  try {
    return scValToNative(v);
  } catch {
    return v.switch().name;
  }
}

function summarizeInvokeHostFunction(
  hf: xdr.HostFunction,
  sorobanAuthEntries: number
): Extract<OperationSummary, { body: "invokeHostFunction" }> {
  const hostFunctionType = hf.switch().name;
  const base: Extract<OperationSummary, { body: "invokeHostFunction" }> = {
    index: 0,
    body: "invokeHostFunction",
    hostFunctionType,
    sorobanAuthEntries,
  };

  if (hostFunctionType === "hostFunctionTypeInvokeContract") {
    const ic = hf.invokeContract();
    const contractId = Address.fromScAddress(ic.contractAddress()).toString();
    const fnSym = ic.functionName();
    const functionName =
      typeof (fnSym as { toString?: () => string }).toString === "function"
        ? (fnSym as { toString: () => string }).toString()
        : String(fnSym);
    const args = ic.args() ?? [];
    return {
      ...base,
      contractId,
      functionName,
      argCount: args.length,
      argsPreview: args.map((a) => previewScVal(a)),
    };
  }

  return base;
}

/**
 * Decode a parsed {@link Transaction} and list each operation in plain language
 * (for Soroban: contract `C…`, function name, arg preview).
 */
export function describeTransactionOperations(
  tx: Transaction
): OperationSummary[] {
  return tx.operations.map((op, index) => {
    const rec = op as unknown as Record<string, unknown>;
    if (rec.type === "invokeHostFunction" && rec.func instanceof Object) {
      const hf = rec.func as xdr.HostFunction;
      const auth = rec.auth as xdr.SorobanAuthorizationEntry[] | undefined;
      const authLen = Array.isArray(auth) ? auth.length : 0;
      const row = summarizeInvokeHostFunction(hf, authLen);
      return { ...row, index };
    }
    return {
      index,
      body: String(rec.type ?? "unknown"),
      note: "classic or unrecognized Soroban envelope shape",
    };
  });
}
