import type { Metadata } from "next";
import Swap from "@/features/swap/components/pages/Swap";

export const metadata: Metadata = {
  title: "Swap | Neko Protocol",
  description: "Swap tokens seamlessly using Neko Protocol.",
};

export default function SwapPage() {
  return <Swap />;
}
