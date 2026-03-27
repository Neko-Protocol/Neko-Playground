import type { Metadata } from "next";
import OnOffRamps from "@/features/on-off-ramps/components/pages/OnOffRamps";

export const metadata: Metadata = {
  title: "On/Off Ramps | Neko Protocol",
  description:
    "Convert between MXN and crypto assets via SPEI using Etherfuse FX or Alfred Pay.",
};

export default function RampsPage() {
  return <OnOffRamps />;
}
