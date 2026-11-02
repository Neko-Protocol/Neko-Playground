"use client";

import React from "react";
import { PageContainer } from "@/components/ui/PageContainer";
import MainStats from "@/features/dashboard/components/ui/MainStats";
import AssetBreakdown from "@/features/dashboard/components/ui/AssetBreakdown";
import YourPositions from "@/features/dashboard/components/ui/YourPositions";
import { GetTestTokensBanner } from "@/features/wallet/components/GetTestTokensBanner";
import { DashboardHero } from "@/features/dashboard/components/ui/DashboardHero";

const Dashboard: React.FC = () => {
  return (
    <PageContainer maxWidth="6xl" className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Portfolio</h1>
        <p className="text-white/50 text-sm mt-1">
          Overview of your positions and activity
        </p>
      </div>

      <DashboardHero />
      <GetTestTokensBanner />
      <MainStats />
      <AssetBreakdown />
      <YourPositions />
    </PageContainer>
  );
};

export default Dashboard;
