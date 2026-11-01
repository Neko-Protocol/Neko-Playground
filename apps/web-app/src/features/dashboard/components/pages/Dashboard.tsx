"use client";

import React from "react";
import { PageContainer } from "@/components/ui/PageContainer";
import MainStats from "@/features/dashboard/components/ui/MainStats";
import QuickActions from "@/features/dashboard/components/ui/QuickActions";
import DiscoverAssets from "@/features/dashboard/components/ui/DiscoverAssets";
import AssetBreakdown from "@/features/dashboard/components/ui/AssetBreakdown";
import YourPositions from "@/features/dashboard/components/ui/YourPositions";
import { GetTestTokensBanner } from "@/features/wallet/components/GetTestTokensBanner";
import { DashboardHero } from "@/features/dashboard/components/ui/DashboardHero";

const Dashboard: React.FC = () => {
  return (
    <div className="w-full min-w-0 max-w-full min-h-screen overflow-x-hidden">
      <PageContainer maxWidth="7xl" className="space-y-8 sm:space-y-10">
        <DashboardHero />
        <GetTestTokensBanner className="mb-4" />
        <MainStats />
        <QuickActions />
        <DiscoverAssets />
        <AssetBreakdown />
        <YourPositions />
      </PageContainer>
    </div>
  );
};

export default Dashboard;
