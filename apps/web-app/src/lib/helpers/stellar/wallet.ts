import storage from "../storage";
import {
  ISupportedWallet,
  StellarWalletsKit,
  WalletNetwork,
  sep43Modules,
} from "@creit.tech/stellar-wallets-kit";
import { Horizon } from "@stellar/stellar-sdk";
import {
  networkPassphrase,
  stellarNetwork,
  horizonUrl,
} from "../../constants/network";

let kit: StellarWalletsKit | null = null;

const getKit = (): StellarWalletsKit => {
  if (typeof window === "undefined") {
    throw new Error("StellarWalletsKit can only be used in the browser");
  }

  if (!kit) {
    kit = new StellarWalletsKit({
      network: networkPassphrase as WalletNetwork,
      modules: sep43Modules(),
    });
  }

  return kit;
};

export const connectWallet = async () => {
  const kitInstance = getKit();
  await kitInstance.openModal({
    modalTitle: "Connect to your wallet",
    onWalletSelected: (option: ISupportedWallet) => {
      const selectedId = option.id;
      kitInstance.setWallet(selectedId);

      // Now open selected wallet's login flow by calling `getAddress` --
      // Yes, it's strange that a getter has a side effect of opening a modal
      void kitInstance.getAddress().then((address) => {
        if (address.address) {
          storage.setItem("walletId", selectedId);
          storage.setItem("walletAddress", address.address);
        } else {
          storage.setItem("walletId", "");
          storage.setItem("walletAddress", "");
        }
      });
      if (selectedId == "freighter" || selectedId == "hot-wallet") {
        void kitInstance.getNetwork().then((network) => {
          if (network.network && network.networkPassphrase) {
            storage.setItem("walletNetwork", network.network);
            storage.setItem("networkPassphrase", network.networkPassphrase);
          } else {
            storage.setItem("walletNetwork", "");
            storage.setItem("networkPassphrase", "");
          }
        });
      }
    },
  });
};

export const disconnectWallet = async () => {
  const kitInstance = getKit();
  await kitInstance.disconnect();
  storage.removeItem("walletId");
  storage.removeItem("walletAddress");
  storage.removeItem("walletNetwork");
  storage.removeItem("networkPassphrase");
};

// Create Horizon server instance lazily (only when needed and in browser)
// This prevents issues during SSR and ensures we use the correct URL
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

// Export a getter function instead of the instance directly
// This ensures it's only accessed in the browser
export const getWallet = () => getKit();
