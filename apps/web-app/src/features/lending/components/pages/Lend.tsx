"use client";

import { BannerPage } from "@/components/ui/BannerPage";
import { PageContainer } from "@/components/ui/PageContainer";
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
    <PageContainer maxWidth="6xl">
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
    </PageContainer>
  );
};

export default Lend;
