import { Horizon } from "@stellar/stellar-sdk";
import { stellarNetwork, horizonUrl } from "@/lib/constants/network";

const getHorizon = (): Horizon.Server | null => {
  if (typeof window === "undefined") {
    return null;
  }
  if (!horizonUrl) {
    return null;
  }
  try {
    return new Horizon.Server(horizonUrl, {
      allowHttp: stellarNetwork === "LOCAL",
    });
  } catch {
    return null;
  }
};

const formatter = new Intl.NumberFormat();

export type MappedBalances = Record<string, Horizon.HorizonApi.BalanceLine>;

export const fetchBalances = async (address: string) => {
  if (typeof window === "undefined") {
    return {};
  }
  const horizonInstance = getHorizon();
  if (!horizonInstance) {
    return {};
  }
  try {
    const { balances } = await horizonInstance
      .accounts()
      .accountId(address)
      .call();
    const mapped = balances.reduce((acc, b) => {
      const formattedBalance = formatter.format(Number(b.balance));
      const balanceEntry = { ...b, balance: formattedBalance };
      const key =
        b.asset_type === "native"
          ? "xlm"
          : b.asset_type === "liquidity_pool_shares"
            ? b.liquidity_pool_id
            : `${b.asset_code}:${b.asset_issuer}`;
      acc[key] = balanceEntry;
      return acc;
    }, {} as MappedBalances);
    return mapped;
  } catch {
    return {};
  }
};
