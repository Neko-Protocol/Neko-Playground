"use client";

import { useQuery } from "@tanstack/react-query";
import { Horizon } from "@stellar/stellar-sdk";
import { HORIZON_URL } from "@/lib/constants";

export type MappedBalances = Record<string, string>;

async function fetchBalances(address: string): Promise<MappedBalances> {
  const server = new Horizon.Server(HORIZON_URL);
  const acc = await server.loadAccount(address);
  const out: MappedBalances = {};
  for (const b of acc.balances) {
    if (b.asset_type === "native") {
      out["XLM"] = b.balance;
    } else if ("asset_code" in b) {
      out[`${b.asset_code}:${b.asset_issuer}`] = b.balance;
    }
  }
  return out;
}

export function useBalances(
  address: string | undefined,
  opts?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: ["balances", address],
    queryFn: () => fetchBalances(address!),
    enabled: Boolean(address) && (opts?.enabled ?? true),
    refetchInterval: 10_000,
  });
}
