"use client";

import { PageContainer } from "@/components/ui/PageContainer";
import { BannerPage } from "@/components/ui/BannerPage";
import PoolStateToggle from "./PoolStateToggle";
import TreasuryFeesTable from "./TreasuryFeesTable";
import CollateralFactorForm from "./CollateralFactorForm";
import InterestRateParamsForm from "./InterestRateParamsForm";

export default function AdminPanel() {
  return (
    <div className="w-full min-w-0 max-w-full min-h-screen overflow-x-hidden">
      <PageContainer maxWidth="7xl" className="space-y-8 sm:space-y-10">
        <BannerPage
          title="Admin"
          subtitle="Pool state, treasury fees, collateral factors, interest rates"
          badge="Admin"
        />
        <div className="space-y-10">
          <PoolStateToggle />
          <TreasuryFeesTable />
          <CollateralFactorForm />
          <InterestRateParamsForm />
        </div>
      </PageContainer>
    </div>
  );
}
