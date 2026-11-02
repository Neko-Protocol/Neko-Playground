"use client";

import Link from "next/link";
import { TrendingUp, Vault, ChevronRight } from "lucide-react";
import { PageContainer } from "@/components/ui/PageContainer";
import { useLend } from "../../hooks/useLend";
import { LendTable } from "../ui/LendTable";
import { LendModal } from "../ui/LendModal";
import { GetTestTokensBanner } from "@/features/wallet/components/GetTestTokensBanner";

const Lend: React.FC = () => {
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
    <PageContainer maxWidth="6xl" className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Earn</h1>
        <p className="text-white/50 text-sm mt-1">
          Deposit assets to earn yield from lending and vaults
        </p>
      </div>

      <GetTestTokensBanner />

      {/* Quick Links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex items-center justify-between p-4 rounded-xl bg-[#1A1A1A] border border-white/5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#229EDF]/10">
              <TrendingUp className="h-5 w-5 text-[#229EDF]" />
            </div>
            <div>
              <p className="text-white font-medium">Lending Pools</p>
              <p className="text-white/40 text-sm">Earn interest on deposits</p>
            </div>
          </div>
          <span className="text-white/30 text-sm">{pools.length} pools</span>
        </div>

        <Link
          href="/vaults"
          className="flex items-center justify-between p-4 rounded-xl bg-[#1A1A1A] border border-white/5 hover:border-white/10 transition-colors group"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#4ADE80]/10">
              <Vault className="h-5 w-5 text-[#4ADE80]" />
            </div>
            <div>
              <p className="text-white font-medium">Vaults</p>
              <p className="text-white/40 text-sm">
                Automated yield strategies
              </p>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-white/30 group-hover:text-white/50 transition-colors" />
        </Link>
      </div>

      {/* Lending Pools Table */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">Lending Pools</h2>
        <LendTable
          pools={pools}
          isLoading={isLoadingPools}
          error={poolsError}
          onDeposit={(pool) => openModal(pool, true)}
          onWithdraw={(pool) => openModal(pool, false)}
        />
      </div>

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
    </PageContainer>
  );
};

export default Lend;
