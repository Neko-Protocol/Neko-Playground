"use client";

import { useState } from "react";
import { BannerPage } from "@/components/ui/BannerPage";
import { PageContainer } from "@/components/ui/PageContainer";
import { useLend } from "../../hooks/useLend";
import { LendTable } from "../ui/LendTable";
import { LendModal } from "../ui/LendModal";
import MyLendingPositions from "../ui/MyLendingPositions";

type PageTab = "pools" | "positions";

const Lend: React.FC = () => {
  const [activeTab, setActiveTab] = useState<PageTab>("pools");
  const {
    pools,
    isLoadingPools,
    poolsError,
    selectedPool,
    isModalOpen,
    isDeposit,
    isLoading,
    bTokenBalance,
    isLoadingBalance,
    hasWallet,
    openModal,
    closeModal,
    handleConfirm,
    refreshBalance,
  } = useLend();

  return (
    <PageContainer maxWidth="6xl">
      <BannerPage
        title="Lend to Pools"
        subtitle="Supply liquidity to pools and earn interest on your assets"
        badge="Use your actives"
        imageSrc="/banners/lend.svg"
        imageAlt="Lend illustration"
        className="mb-8"
      />

      <div className="flex items-center gap-1 rounded-xl bg-[#1C1C1C] p-1 w-fit mb-6">
        <button
          onClick={() => setActiveTab("pools")}
          className={`rounded-lg px-5 py-2 text-sm font-semibold transition-colors ${
            activeTab === "pools"
              ? "bg-[#229EDF] text-white"
              : "text-white/40 hover:text-white/70"
          }`}
        >
          Pools
        </button>
        <button
          onClick={() => setActiveTab("positions")}
          className={`rounded-lg px-5 py-2 text-sm font-semibold transition-colors ${
            activeTab === "positions"
              ? "bg-[#229EDF] text-white"
              : "text-white/40 hover:text-white/70"
          }`}
        >
          My Positions
        </button>
      </div>

      {activeTab === "pools" && (
        <>
          <LendTable
            pools={pools}
            isLoading={isLoadingPools}
            error={poolsError}
            onDeposit={(pool) => openModal(pool, true)}
            onWithdraw={(pool) => openModal(pool, false)}
          />

          {isModalOpen && selectedPool && (
            <LendModal
              pool={selectedPool}
              isDeposit={isDeposit}
              isLoading={isLoading}
              bTokenBalance={bTokenBalance}
              isLoadingBalance={isLoadingBalance}
              hasWallet={hasWallet}
              onClose={closeModal}
              onConfirm={handleConfirm}
              onRefreshBalance={() => void refreshBalance()}
            />
          )}
        </>
      )}

      {activeTab === "positions" && <MyLendingPositions />}
    </PageContainer>
  );
};

export default Lend;
