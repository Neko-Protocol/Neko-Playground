"use client";

import { BannerPage } from "@/components/ui/BannerPage";
import { useBorrow } from "../../hooks/useBorrow";
import { BorrowTable } from "../ui/BorrowTable";
import { BorrowModal } from "../ui/BorrowModal";

const Borrow: React.FC = () => {
  const {
    assets,
    paginatedAssets,
    isLoading,
    poolsError,
    selectedAsset,
    isProcessing,
    executionError,
    success,
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
    clearSuccess,
    clearError,
  } = useBorrow();

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
          error={executionError}
          success={success}
          isWalletConnected={isWalletConnected}
          onClose={closeModal}
          onSubmit={handleSubmit}
          onClearError={clearError}
          onClearSuccess={clearSuccess}
        />
      )}
    </div>
  );
};

export default Borrow;
