"use client";

import { BannerPage } from "@/components/ui/BannerPage";
import { useLend } from "../../hooks/useLend";
import { LendTable } from "../ui/LendTable";
import { LendModal } from "../ui/LendModal";

const Lend: React.FC = () => {
  const {
    pools,
    isLoadingPools,
    poolsError,
    selectedPool,
    isModalOpen,
    isDeposit,
    isLoading,
    error,
    bTokenBalance,
    isLoadingBalance,
    hasWallet,
    openModal,
    closeModal,
    handleConfirm,
    refreshBalance,
  } = useLend();

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-6 sm:px-6 sm:py-8">
      <BannerPage
        title="Lend to Pools"
        subtitle="Supply liquidity to pools and earn interest on your assets"
        badge="Use your actives"
        imageSrc="/banners/lend.svg"
        imageAlt="Lend illustration"
        className="mb-8"
      />

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
          error={error}
          bTokenBalance={bTokenBalance}
          isLoadingBalance={isLoadingBalance}
          hasWallet={hasWallet}
          onClose={closeModal}
          onConfirm={handleConfirm}
          onRefreshBalance={() => void refreshBalance()}
        />
      )}
    </div>
  );
};

export default Lend;
