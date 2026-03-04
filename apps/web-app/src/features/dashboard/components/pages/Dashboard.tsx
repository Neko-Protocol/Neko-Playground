"use client";

import React from "react";
import { BannerPage } from "@/components/ui/BannerPage";
import MainStats from "@/features/dashboard/components/ui/MainStats";
import QuickActions from "@/features/dashboard/components/ui/QuickActions";
import DiscoverAssets from "@/features/dashboard/components/ui/DiscoverAssets";
import AssetBreakdown from "@/features/dashboard/components/ui/AssetBreakdown";
import YourPositions from "@/features/dashboard/components/ui/YourPositions";

const Dashboard: React.FC = () => {
  return (
    <div className="w-full min-h-screen">
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-10">
        <BannerPage
          title="Dashboard"
          subtitle="Overview of your portfolio, pools, and protocol activity"
          badge="Welcome back"
          imageSrc="/banners/oracle.svg"
          imageAlt="Dashboard illustration"
        />
        <MainStats />
        <QuickActions />
        <DiscoverAssets />
        <AssetBreakdown />
        <YourPositions />
      </div>
    </div>
  );
};

export default Dashboard;
