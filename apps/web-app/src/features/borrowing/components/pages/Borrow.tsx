"use client";

import { PageContainer } from "@/components/ui/PageContainer";
import { useBorrow } from "../../hooks/useBorrow";
import { BorrowTable } from "../ui/BorrowTable";
import { BorrowModal } from "../ui/BorrowModal";
import { GetTestTokensBanner } from "@/features/wallet/components/GetTestTokensBanner";

const Borrow: React.FC = () => {
  const {
    assets,
    paginatedAssets,
    isLoading,
    poolsError,
    selectedAsset,
    isProcessing,
    isWalletConnected,
    page,
    totalRows,
    totalPages,
    rowsPerPage,
    setPage,
    changeRowsPerPage,
    openModal,
    closeModal,
    handleSubmit,
  } = useBorrow();

  return (
    <PageContainer maxWidth="6xl" className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Borrow</h1>
        <p className="text-white/50 text-sm mt-1">
          Borrow assets using your collateral
        </p>
      </div>

      <GetTestTokensBanner />

      <BorrowTable
        assets={assets}
        paginatedAssets={paginatedAssets}
        isLoading={isLoading}
        poolsError={poolsError}
        page={page}
        totalRows={totalRows}
        totalPages={totalPages}
        rowsPerPage={rowsPerPage}
        onBorrow={openModal}
        onPageChange={setPage}
        onRowsPerPageChange={changeRowsPerPage}
      />

      {selectedAsset && (
        <BorrowModal
          asset={selectedAsset}
          isProcessing={isProcessing}
          isWalletConnected={isWalletConnected}
          onClose={closeModal}
          onSubmit={handleSubmit}
        />
      )}
    </PageContainer>
  );
};

export default Borrow;
