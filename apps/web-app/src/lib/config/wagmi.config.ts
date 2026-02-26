import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import {
  mainnet,
  sepolia,
  polygon,
  optimism,
  arbitrum,
  base,
  bsc,
} from "viem/chains";

/**
 * Wagmi configuration for EVM wallets
 */
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "";

if (!projectId && typeof window !== "undefined") {
  console.warn(
    "WalletConnect projectId is not configured. Please add NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID to your .env.local file. Get your projectId at https://cloud.walletconnect.com/"
  );
}

// Validate projectId
if (!projectId && typeof window !== "undefined") {
  console.warn(
    "WalletConnect projectId is not configured. EVM wallet connections may not work properly.\n" +
      "Please add NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID to your .env.local file.\n" +
      "Get your projectId at: https://cloud.walletconnect.com/"
  );
}

export const wagmiConfig = getDefaultConfig({
  appName: "Neko Protocol",
  projectId: projectId || "00000000000000000000000000000000", // Temporary fallback - user should set their own
  chains: [mainnet, bsc, polygon, optimism, arbitrum, base, sepolia],
  ssr: true, // Enable SSR support for Next.js
});
