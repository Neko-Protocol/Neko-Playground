"use client";

import React from "react";
import MainStats from "@/features/dashboard/components/ui/MainStats";
import QuickActions from "@/features/dashboard/components/ui/QuickActions";
import DiscoverAssets from "@/features/dashboard/components/ui/DiscoverAssets";
import AssetBreakdown from "@/features/dashboard/components/ui/AssetBreakdown";
import YourPositions from "@/features/dashboard/components/ui/YourPositions";

const Dashboard: React.FC = () => {
  // #region agent log
  React.useEffect(() => { fetch('http://127.0.0.1:7816/ingest/761c1f40-9665-4497-bf7f-d1d30be62828',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'3a2033'},body:JSON.stringify({sessionId:'3a2033',location:'Dashboard.tsx:render',message:'Dashboard rendered',data:{},timestamp:Date.now()})}).catch(()=>{}); }, []);
  // #endregion
  return (
    <div className="w-full max-w-7xl mx-auto px-6 py-8 space-y-8">
      <MainStats />
      <QuickActions />
      <DiscoverAssets />
      <AssetBreakdown />
      <YourPositions />
    </div>
  );
};

export default Dashboard;
