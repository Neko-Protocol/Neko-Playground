import type { Metadata } from "next";
import Analytics from "@/features/analytics/components/pages/Analytics";

export const metadata: Metadata = {
  title: "Analytics | Neko Protocol",
  description:
    "Portfolio earnings, NAV history, risk metrics and advanced DeFi analytics for your Neko positions.",
};

export default function AnalyticsPage() {
  return <Analytics />;
}
