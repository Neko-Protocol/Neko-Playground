"use client";

import React from "react";
import { BannerPage } from "@/components/ui/BannerPage";
import BorrowTable from "../ui/BorrowTable";

const Borrow: React.FC = () => {
  return (
    <div className="w-full max-w-6xl mx-auto px-6 py-8">
      <BannerPage
        title="Borrow assets"
        subtitle="Select an option and start borrowing assets from liquidity pools"
        badge="Need a hand?"
        imageSrc="/banners/borrow.svg"
        imageAlt="Borrow illustration"
        className="mb-8"
      />
      <BorrowTable />
    </div>
  );
};

export default Borrow;
