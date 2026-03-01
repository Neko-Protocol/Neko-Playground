"use client";

import React, { useState, useMemo, useCallback } from "react";
import { Modal, Box, Typography, IconButton, TextField } from "@mui/material";
import { useLendingPools } from "@/features/lending/hooks/useLendingPools";
import { useLendingExecution } from "@/features/lending/hooks/useLendingExecution";
import { useWallet } from "@/hooks/useWallet";
import { getBTokenBalance } from "@/lib/helpers/stellar/lending";
import { getAvailableTokens } from "@/lib/helpers/stellar/soroswap";
import { PoolSelector } from "@/features/lending/components/ui/PoolSelector";
import { LendingBalance } from "@/features/lending/components/ui/LendingBalance";
import type { PoolData } from "@/features/lending/types/lending";
import { calculateBTokensFromTokens } from "@/features/lending/utils/lendingUtils";

const Lend: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isDepositModal, setIsDepositModal] = useState(true);
  const [amount, setAmount] = useState("");
  const [bTokenBalance, setBTokenBalance] = useState<string | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [bTokensToBurn, setBTokensToBurn] = useState<string | null>(null);

  const { address } = useWallet();
  const {
    data: lendingPools = [],
    isLoading: isLoadingPools,
    error: poolsError,
    refetch: refetchPools,
  } = useLendingPools();
  const {
    executeDeposit,
    executeWithdraw,
    isLoading,
    error: executionError,
    clearError,
  } = useLendingExecution();

  const pools: PoolData[] = useMemo(() => {
    return lendingPools.map((pool, index) => {
      const apy =
        pool.interestRate > 0 ? `${pool.interestRate.toFixed(2)}%` : "0.00%";
      const balanceNum = parseFloat(pool.poolBalance);
      const liquidity =
        balanceNum >= 1000
          ? `$${(balanceNum / 1000).toFixed(2)}k`
          : `$${balanceNum.toFixed(2)}`;
      return {
        id: `pool-${index}`,
        name: `${pool.assetCode} Pool`,
        token1: pool.assetCode,
        token2: "",
        fee: "0%",
        roi: `${pool.interestRate.toFixed(2)}%`,
        feeApy: apy,
        liquidity,
        isActive: pool.isActive,
        assetCode: pool.assetCode,
        asset: pool.asset,
        bTokenRate: pool.bTokenRate,
      };
    });
  }, [lendingPools]);

  const [selectedPool, setSelectedPool] = useState<PoolData | null>(null);

  React.useEffect(() => {
    if (pools.length > 0 && !selectedPool) {
      setSelectedPool(pools[0]);
    }
    if (selectedPool && pools.length > 0) {
      const updatedPool = pools.find(
        (p) => p.assetCode === selectedPool.assetCode
      );
      if (updatedPool) {
        setSelectedPool(updatedPool);
      }
    }
  }, [pools, selectedPool]);

  const loadBTokenBalance = useCallback(async () => {
    if (!selectedPool || !address) {
      setBTokenBalance(null);
      return;
    }
    setIsLoadingBalance(true);
    try {
      const balance = await getBTokenBalance(selectedPool.assetCode, address);
      setBTokenBalance(balance);
    } catch {
      setBTokenBalance("0");
    } finally {
      setIsLoadingBalance(false);
    }
  }, [selectedPool, address]);

  React.useEffect(() => {
    if (selectedPool && address) {
      void loadBTokenBalance();
    } else {
      setBTokenBalance(null);
    }
  }, [selectedPool?.assetCode, address, loadBTokenBalance]);

  React.useEffect(() => {
    if (
      !isDepositModal &&
      amount &&
      selectedPool?.bTokenRate &&
      parseFloat(amount) > 0
    ) {
      setBTokensToBurn(
        calculateBTokensFromTokens(amount, selectedPool.bTokenRate)
      );
    } else {
      setBTokensToBurn(null);
    }
  }, [amount, isDepositModal, selectedPool?.bTokenRate]);

  const handleLendClick = useCallback(() => {
    clearError();
    setIsDepositModal(true);
    setAmount("");
    setBTokenBalance(null);
    setIsModalOpen(true);
    if (selectedPool && address) {
      void loadBTokenBalance();
    }
  }, [clearError, selectedPool, address, loadBTokenBalance]);

  const handleWithdrawClick = useCallback(() => {
    clearError();
    setIsDepositModal(false);
    setAmount("");
    setBTokenBalance(null);
    setBTokensToBurn(null);
    setIsModalOpen(true);
    if (selectedPool && address) {
      void loadBTokenBalance();
    }
  }, [clearError, selectedPool, address, loadBTokenBalance]);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setAmount("");
    setBTokenBalance(null);
  }, []);

  const handlePoolSelect = useCallback((pool: PoolData) => {
    setSelectedPool(pool);
    setIsDropdownOpen(false);
  }, []);

  const handleRefreshSuccess = useCallback(() => {
    void loadBTokenBalance();
    void refetchPools();
  }, [loadBTokenBalance, refetchPools]);

  const handleConfirm = useCallback(async () => {
    if (!selectedPool || !address) return;
    if (!amount || parseFloat(amount) <= 0) return;

    const availableTokens = getAvailableTokens();
    const token = availableTokens[selectedPool.assetCode];
    const decimals = token?.decimals ?? 7;

    if (isDepositModal) {
      const result = await executeDeposit(
        { pool: selectedPool, amount, decimals },
        handleRefreshSuccess
      );
      if (result.success) handleCloseModal();
    } else {
      if (
        !selectedPool.bTokenRate ||
        !bTokensToBurn ||
        parseFloat(bTokensToBurn) <= 0
      ) {
        return;
      }
      if (
        bTokenBalance !== null &&
        parseFloat(bTokensToBurn) > parseFloat(bTokenBalance)
      ) {
        return;
      }
      const result = await executeWithdraw(
        {
          pool: selectedPool,
          amount,
          bTokensToBurn,
          decimals,
        },
        handleRefreshSuccess
      );
      if (result.success) handleCloseModal();
    }
  }, [
    selectedPool,
    address,
    amount,
    isDepositModal,
    bTokensToBurn,
    bTokenBalance,
    executeDeposit,
    executeWithdraw,
    handleRefreshSuccess,
    handleCloseModal,
  ]);

  const error = executionError;

  return (
    <div className="w-full min-h-screen">
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-5xl font-bold text-[#081F5C] tracking-tight mb-3">
            Lend to Pools
          </h1>
          <p className="text-[#7096D1] text-lg leading-relaxed">
            Supply liquidity to pools and earn interest on your assets
          </p>
        </div>

        <div className="bg-white rounded-3xl shadow-xl border border-[#334EAC]/30 overflow-visible">
          <div className="bg-[#f3f4f6] p-6 border-b border-[#334EAC]/20 rounded-t-3xl">
            <PoolSelector
              pools={pools}
              selectedPool={selectedPool}
              onSelect={handlePoolSelect}
              isOpen={isDropdownOpen}
              onToggle={() => setIsDropdownOpen(!isDropdownOpen)}
              isLoading={isLoadingPools}
            />
          </div>

          {selectedPool ? (
            <div className="p-8">
              <div className="grid grid-cols-3 gap-4 mb-8">
                <div className="bg-[#f3f4f6] rounded-xl p-4 border border-[#334EAC]/20">
                  <p className="text-[#7096D1] text-sm mb-2">Supply APY</p>
                  <p className="text-[#081F5C] text-2xl font-bold">
                    {selectedPool.roi}
                  </p>
                </div>
                <div className="bg-[#f3f4f6] rounded-xl p-4 border border-[#334EAC]/20">
                  <p className="text-[#7096D1] text-sm mb-2">Total Liquidity</p>
                  <p className="text-[#081F5C] text-2xl font-bold">
                    {selectedPool.liquidity}
                  </p>
                </div>
                <div className="bg-[#f3f4f6] rounded-xl p-4 border border-[#334EAC]/20">
                  <p className="text-[#7096D1] text-sm mb-2">bToken Rate</p>
                  <p className="text-[#081F5C] text-2xl font-bold">
                    {selectedPool.bTokenRate
                      ? parseFloat(selectedPool.bTokenRate).toFixed(4)
                      : "1.0000"}
                  </p>
                </div>
              </div>

              {address && (
                <LendingBalance
                  assetCode={selectedPool.token1}
                  balance={bTokenBalance}
                  isLoading={isLoadingBalance}
                  onRefresh={loadBTokenBalance}
                  bTokenRate={selectedPool.bTokenRate}
                />
              )}

              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={handleLendClick}
                  className="flex-1 bg-[#081F5C] hover:bg-[#12328a] text-white px-6 py-4 rounded-2xl text-lg font-bold transition-all duration-200 shadow-lg"
                >
                  Deposit
                </button>
                <button
                  type="button"
                  onClick={handleWithdrawClick}
                  className="flex-1 bg-[#334EAC] hover:bg-[#4a6bc4] text-white px-6 py-4 rounded-2xl text-lg font-bold transition-all duration-200 shadow-lg"
                >
                  Withdraw
                </button>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-[#7096D1]">
              {isLoadingPools ? (
                "Loading pools..."
              ) : poolsError ? (
                <div>
                  <p>Error loading pools</p>
                  <p className="text-sm mt-2">{String(poolsError)}</p>
                </div>
              ) : (
                <div>
                  <p>No pools available</p>
                  <p className="text-sm mt-2">
                    {lendingPools.length === 0
                      ? "No pools found in contract"
                      : `${lendingPools.length} pool(s) found but filtered out`}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <Modal
        open={isModalOpen}
        onClose={handleCloseModal}
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Box
          sx={{
            backgroundColor: "#ffffff",
            borderRadius: "24px",
            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
            maxWidth: "500px",
            width: "90%",
            p: 4,
            outline: "none",
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              mb: 3,
            }}
          >
            <Typography variant="h5" sx={{ color: "#081F5C", fontWeight: 700 }}>
              {isDepositModal ? "Deposit" : "Withdraw"} {selectedPool?.token1}
              {selectedPool?.token2 ? ` / ${selectedPool.token2}` : ""}
            </Typography>
            <IconButton
              onClick={handleCloseModal}
              sx={{
                color: "#7096D1",
                "&:hover": {
                  color: "#081F5C",
                  backgroundColor: "rgba(51, 78, 172, 0.1)",
                },
              }}
            >
              <Typography sx={{ fontSize: "1.5rem", fontWeight: 700 }}>
                ×
              </Typography>
            </IconButton>
          </Box>

          <Box sx={{ mb: 3 }}>
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                mb: 2,
                p: 2,
                backgroundColor: "#f3f4f6",
                borderRadius: "12px",
              }}
            >
              <Typography sx={{ color: "#7096D1", fontSize: "0.875rem" }}>
                Pool ID
              </Typography>
              <Typography sx={{ color: "#081F5C", fontWeight: 600 }}>
                {selectedPool?.id}
              </Typography>
            </Box>
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                mb: 2,
                p: 2,
                backgroundColor: "#f3f4f6",
                borderRadius: "12px",
              }}
            >
              <Typography sx={{ color: "#7096D1", fontSize: "0.875rem" }}>
                Supply APY
              </Typography>
              <Typography sx={{ color: "#081F5C", fontWeight: 600 }}>
                {selectedPool?.roi}
              </Typography>
            </Box>
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                mb: 2,
                p: 2,
                backgroundColor: "#f3f4f6",
                borderRadius: "12px",
              }}
            >
              <Typography sx={{ color: "#7096D1", fontSize: "0.875rem" }}>
                Total Liquidity
              </Typography>
              <Typography sx={{ color: "#081F5C", fontWeight: 600 }}>
                {selectedPool?.liquidity}
              </Typography>
            </Box>
          </Box>

          <Box sx={{ mb: 3 }}>
            <Box
              sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}
            >
              <Typography
                sx={{
                  color: "#081F5C",
                  fontWeight: 600,
                  fontSize: "0.875rem",
                }}
              >
                {isDepositModal ? "Amount to Deposit" : "Amount to Withdraw"}
              </Typography>
              {!isDepositModal && bTokenBalance !== null && (
                <Typography sx={{ color: "#7096D1", fontSize: "0.875rem" }}>
                  bToken Balance: {bTokenBalance}
                </Typography>
              )}
            </Box>
            <TextField
              fullWidth
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={isLoading}
              sx={{
                "& .MuiOutlinedInput-root": {
                  borderRadius: "12px",
                  backgroundColor: "#f3f4f6",
                  "& fieldset": {
                    borderColor: "rgba(51, 78, 172, 0.2)",
                  },
                  "&:hover fieldset": {
                    borderColor: "#334EAC",
                  },
                  "&.Mui-focused fieldset": {
                    borderColor: "#081F5C",
                  },
                },
              }}
            />
            {!isDepositModal && amount && bTokensToBurn && (
              <Box sx={{ mt: 1 }}>
                <Typography
                  sx={{
                    color: "#7096D1",
                    fontSize: "0.75rem",
                    fontStyle: "italic",
                  }}
                >
                  You will burn ~{parseFloat(bTokensToBurn).toFixed(4)} bTokens
                  to withdraw {amount} {selectedPool?.token1}
                </Typography>
              </Box>
            )}
          </Box>

          {error && (
            <Box
              sx={{
                mb: 3,
                p: 3,
                backgroundColor: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: "12px",
              }}
            >
              <Typography sx={{ color: "#dc2626", fontSize: "0.875rem" }}>
                {error}
              </Typography>
            </Box>
          )}

          <Box sx={{ display: "flex", gap: 2 }}>
            <button
              type="button"
              onClick={handleCloseModal}
              className="flex-1 bg-gray-200 hover:bg-gray-300 text-[#081F5C] px-4 py-3 rounded-xl text-sm font-bold transition-colors duration-200"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={
                isLoading ||
                !amount ||
                parseFloat(amount) <= 0 ||
                (!isDepositModal &&
                  (!bTokensToBurn ||
                    parseFloat(bTokensToBurn) <= 0 ||
                    (bTokenBalance !== null &&
                      parseFloat(bTokensToBurn) > parseFloat(bTokenBalance))))
              }
              className="flex-1 bg-[#081F5C] hover:bg-[#12328a] disabled:bg-gray-400 disabled:cursor-not-allowed text-white px-4 py-3 rounded-xl text-sm font-bold transition-colors duration-200"
            >
              {isLoading
                ? "Processing..."
                : isDepositModal
                  ? "Confirm Deposit"
                  : "Confirm Withdraw"}
            </button>
          </Box>
        </Box>
      </Modal>
    </div>
  );
};

export default Lend;
