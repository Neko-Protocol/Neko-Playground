import type { NetworkType } from "@/lib/constants/network";

export interface NetworkBadgeStyle {
  label: string;
  dot: string;
  text: string;
  border: string;
}

export const NETWORK_BADGE: Record<NetworkType | string, NetworkBadgeStyle> = {
  testnet: {
    label: "Testnet",
    dot: "bg-yellow-400",
    text: "text-yellow-400",
    border: "border-yellow-400/30",
  },
  mainnet: {
    label: "Mainnet",
    dot: "bg-green-400",
    text: "text-green-400",
    border: "border-green-400/30",
  },
  futurenet: {
    label: "Futurenet",
    dot: "bg-orange-400",
    text: "text-orange-400",
    border: "border-orange-400/30",
  },
  custom: {
    label: "Local",
    dot: "bg-purple-400",
    text: "text-purple-400",
    border: "border-purple-400/30",
  },
};
