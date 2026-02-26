"use client";

import {
  StellarWalletsKit,
  FREIGHTER_ID,
  FreighterModule,
  AlbedoModule,
  xBullModule,
  LobstrModule,
  WalletNetwork,
} from "@creit.tech/stellar-wallets-kit";
import { LedgerModule } from "@creit.tech/stellar-wallets-kit/modules/ledger.module";
import {
  WalletConnectAllowedMethods,
  WalletConnectModule,
} from "@creit.tech/stellar-wallets-kit/modules/walletconnect.module";
import { Horizon } from "@stellar/stellar-sdk";
import {
  networkPassphrase,
  stellarNetwork,
  horizonUrl,
} from "../constants/network";

let stellarWalletKitInstance: StellarWalletsKit | null = null;

const getKit = (): StellarWalletsKit => {
  if (typeof window === "undefined") {
    throw new Error("StellarWalletsKit can only be used in the browser");
  }

  if (!stellarWalletKitInstance) {
    stellarWalletKitInstance = new StellarWalletsKit({
      network: networkPassphrase as WalletNetwork,
      selectedWalletId: FREIGHTER_ID,
      modules: [
        new FreighterModule(),
        new AlbedoModule(),
        new xBullModule(),
        new LedgerModule(),
        new LobstrModule(),
        new WalletConnectModule({
          url: "https://nekoprotocol.xyz",
          projectId:
            process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ||
            "fa57d523d12455e4fc2c8c83c94ec7b1",
          method: WalletConnectAllowedMethods.SIGN,
          name: "Neko Protocol",
          description: "Neko — The Marketplace for Real-World Assets On-Chain",
          icons: ["/Neko.svg"],
          network: networkPassphrase as WalletNetwork,
        }),
      ],
    });
  }

  return stellarWalletKitInstance;
};

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
      const balanceEntry = {
        ...b,
        balance: formattedBalance,
      };
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

export const getWallet = () => getKit();
