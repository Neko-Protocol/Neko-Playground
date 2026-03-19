import type { Metadata } from "next";
import { BannerPage } from "@/components/ui/BannerPage";
import { PageContainer } from "@/components/ui/PageContainer";
import LiquidationsSection from "@/features/dashboard/components/ui/LiquidationsSection";

export const metadata: Metadata = {
  title: "Liquidations | Neko Protocol",
  description:
    "Create and participate in bad debt auctions. Cover uncovered debt and receive backstop tokens at a discount.",
};

export default function LiquidationsPage() {
  return (
    <div className="w-full min-w-0 max-w-full min-h-screen overflow-x-hidden">
      <PageContainer maxWidth="7xl" className="space-y-8 sm:space-y-10">
        <BannerPage
          title="Liquidations"
          subtitle="Create and fill bad debt auctions. When borrowers have debt but no collateral, participate to cover debt and earn backstop tokens at a discount."
          badge="Bad Debt Auctions"
          imageSrc="/banners/oracle.svg"
          imageAlt="Liquidations illustration"
        />
        <LiquidationsSection />
      </PageContainer>
    </div>
  );
}
