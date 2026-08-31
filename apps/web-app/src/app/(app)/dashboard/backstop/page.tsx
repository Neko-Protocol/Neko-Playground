import type { Metadata } from "next";
import Backstop from "@/features/lending/components/pages/Backstop";

export const metadata: Metadata = {
  title: "Backstop | Neko Protocol",
  description:
    "Create and participate in interest auctions. Accumulated protocol interest is distributed to backstop depositors.",
};

export default function BackstopPage() {
  return <Backstop />;
}
