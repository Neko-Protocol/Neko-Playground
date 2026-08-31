"use client";

import React from "react";
import { BannerPage } from "@/components/ui/BannerPage";
import { PageContainer } from "@/components/ui/PageContainer";
import { InterestAuctionSection } from "../InterestAuctionSection";

const Backstop: React.FC = () => {
  return (
    <div className="w-full min-w-0 max-w-full min-h-screen overflow-x-hidden">
      <PageContainer maxWidth="7xl" className="space-y-8 sm:space-y-10">
        <BannerPage
          title="Backstop"
          subtitle="Create and participate in interest auctions. Accumulated protocol interest is distributed to backstop depositors via auctions."
          badge="Interest Auctions"
          imageSrc="/banners/oracle.svg"
          imageAlt="Backstop illustration"
        />
        <InterestAuctionSection />
      </PageContainer>
    </div>
  );
};

export default Backstop;
