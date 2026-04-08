import { Horizon } from "@stellar/stellar-sdk";
import { stellarNetwork, horizonUrl } from "@/lib/constants/network";
import { getAvailableTokens } from "@/lib/helpers/stellar/soroswap/tokens";
import { getTokenBalanceFromContract } from "@/lib/helpers/stellar/sorobanBalance";
import { parseBalance } from "@/lib/helpers/formatUtils";

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

type HorizonBalance = Horizon.HorizonApi.BalanceLine & { balance: string };

export interface SorobanBalanceEntry {
  asset_type: "credit_alphanum4";
  asset_code: string;
  asset_issuer: string;
  balance: string;
}

export type MappedBalances = Record<
  string,
  HorizonBalance | SorobanBalanceEntry
>;

export type FetchBalancesResult = {
  balances: MappedBalances;
  subentryCount: number;
};

export const fetchBalances = async (
  address: string
): Promise<FetchBalancesResult> => {
  if (typeof window === "undefined") {
    return { balances: {}, subentryCount: 0 };
  }
  const horizonInstance = getHorizon();
  if (!horizonInstance) {
    return { balances: {}, subentryCount: 0 };
  }
  const mapped: MappedBalances = {};
  let subentryCount = 0;

  try {
    const { balances, subentry_count } = await horizonInstance
      .accounts()
      .accountId(address)
      .call();
    subentryCount = subentry_count ?? 0;
    for (const b of balances) {
      const formattedBalance = formatter.format(Number(b.balance));
      const balanceEntry = { ...b, balance: formattedBalance };
      const key =
        b.asset_type === "native"
          ? "xlm"
          : b.asset_type === "liquidity_pool_shares"
            ? b.liquidity_pool_id
            : `${b.asset_code}:${b.asset_issuer}`;
      mapped[key] = balanceEntry;
    }
  } catch (err) {
    console.warn("Horizon balance fetch failed, continuing with Soroban:", err);
  }

  try {
    const availableTokens = getAvailableTokens();
    const sorobanResults = await Promise.allSettled(
      Object.entries(availableTokens).map(
        async ([code, info]): Promise<{ code: string; balance: string }> => {
          if (!info.contract || code === "XLM") return { code, balance: "0" };
          const balance = await getTokenBalanceFromContract(
            info.contract,
            address,
            info.decimals ?? 7
          );
          return { code, balance };
        }
      )
    );

    for (const result of sorobanResults) {
      if (
        result.status === "fulfilled" &&
        parseBalance(result.value.balance) > 0
      ) {
        const { code, balance } = result.value;
        const key = `soroban:${code}`;
        const sorobanEntry: SorobanBalanceEntry = {
          asset_type: "credit_alphanum4",
          asset_code: code,
          asset_issuer: "soroban",
          balance: formatter.format(parseBalance(balance)),
        };
        mapped[key] = sorobanEntry;
      }
    }
  } catch (err) {
    console.warn("Soroban balance fetch failed:", err);
  }

  return { balances: mapped, subentryCount };
};
