import type { Metadata } from "next";
import Lend from "@/features/lending/components/pages/Lend";

export const metadata: Metadata = {
  title: "Lending | Neko Protocol",
  description: "Supply assets to Neko lending pools and earn interest.",
};

export default function LendingPage() {
  return <Lend />;
}
