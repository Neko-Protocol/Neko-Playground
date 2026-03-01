"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Modal, Box, Typography, IconButton, TextField } from "@mui/material";
import { useLendingPools } from "../../hooks/useLendingPools";
import { useLendingExecution } from "../../hooks/useLendingExecution";
import { useWallet } from "@/hooks/useWallet";
import { lendingService } from "@/lib/services";
import {
  calculateBTokensFromTokens,
  poolsToPoolData,
} from "../../utils/lendingUtils";
import type { PoolData } from "../../types/lending";

const Lend: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isDepositModal, setIsDepositModal] = useState(true);
  const [amount, setAmount] = useState("");
  const [bTokenBalance, setBTokenBalance] = useState<string | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [bTokensToBurn, setBTokensToBurn] = useState<string | null>(null);
  const [selectedPool, setSelectedPool] = useState<PoolData | null>(null);

  const { address } = useWallet();
  const { handleDeposit, handleWithdraw, isLoading, error, clearError } =
    useLendingExecution();

  const {
    data: lendingPools = [],
    isLoading: isLoadingPools,
    error: poolsError,
    refetch: refetchPools,
  } = useLendingPools();

  const pools: PoolData[] = useMemo(
    () => poolsToPoolData(lendingPools),
    [lendingPools]
  );

  useEffect(() => {
    if (pools.length > 0 && !selectedPool) {
      setSelectedPool(pools[0]);
    } else if (selectedPool && pools.length > 0) {
      const updatedPool = pools.find(
        (p) => p.assetCode === selectedPool.assetCode
      );
      if (updatedPool) setSelectedPool(updatedPool);
    }
  }, [pools, selectedPool]);

  // Calculate bTokens needed when amount changes (withdraw only)
  useEffect(() => {
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

  const loadBTokenBalance = useCallback(async () => {
    if (!selectedPool || !address) {
      setBTokenBalance(null);
      return;
    }
    setIsLoadingBalance(true);
    try {
      const balance = await lendingService.getBTokenBalance(
        selectedPool.assetCode,
        address
      );
      setBTokenBalance(balance);
    } catch {
      setBTokenBalance("0");
    } finally {
      setIsLoadingBalance(false);
    }
  }, [selectedPool, address]);

  useEffect(() => {
    if (selectedPool && address) {
      void loadBTokenBalance();
    } else {
      setBTokenBalance(null);
    }
  }, [selectedPool, address, loadBTokenBalance]);

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setAmount("");
    setBTokenBalance(null);
    clearError();
  };

  const handleLendClick = () => {
    clearError();
    setIsDepositModal(true);
    setAmount("");
    setBTokenBalance(null);
    setIsModalOpen(true);
    if (selectedPool && address) void loadBTokenBalance();
  };

  const handleWithdrawClick = () => {
    clearError();
    setIsDepositModal(false);
    setAmount("");
    setBTokenBalance(null);
    setBTokensToBurn(null);
    setIsModalOpen(true);
    if (selectedPool && address) void loadBTokenBalance();
  };

  const handlePoolSelect = (pool: PoolData) => {
    setSelectedPool(pool);
    setIsDropdownOpen(false);
  };

  const handleConfirm = async () => {
    if (!selectedPool || !amount || parseFloat(amount) <= 0) return;

    let result;

    if (isDepositModal) {
      result = await handleDeposit({ pool: selectedPool, amount });
    } else {
      if (!bTokensToBurn || parseFloat(bTokensToBurn) <= 0) return;
      if (
        bTokenBalance &&
        parseFloat(bTokensToBurn) > parseFloat(bTokenBalance)
      ) {
        return;
      }
      result = await handleWithdraw({ pool: selectedPool, bTokensToBurn });
    }

    if (result?.success) {
      await Promise.all([loadBTokenBalance(), refetchPools()]);
      handleCloseModal();
    }
  };

  return (
    <div className="w-full min-h-screen">
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Header Section */}
        <div className="mb-8">
          <h1 className="text-5xl font-bold text-[#081F5C] tracking-tight mb-3">
            Lend to Pools
          </h1>
          <p className="text-[#7096D1] text-lg leading-relaxed">
            Supply liquidity to pools and earn interest on your assets
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-3xl shadow-xl border border-[#334EAC]/30 overflow-visible">
          {/* Header with Dropdown */}
          <div className="bg-[#f3f4f6] p-6 border-b border-[#334EAC]/20 rounded-t-3xl">
            <div className="relative z-10">
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="w-full flex items-center justify-between bg-white hover:bg-gray-50 border border-[#334EAC]/30 rounded-2xl px-6 py-4 transition-all duration-200 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="relative w-10 h-6">
                    <div className="absolute left-0 w-6 h-6 rounded-full bg-[#39bfb7] border-2 border-white flex items-center justify-center text-white text-xs font-bold shadow-md">
                      {selectedPool?.token1?.[0] || "?"}
                    </div>
                    {selectedPool?.token2 && (
                      <div className="absolute left-4 w-6 h-6 rounded-full bg-[#68f9f2] border-2 border-white flex items-center justify-center text-[#081F5C] text-xs font-bold shadow-md">
                        {selectedPool.token2[0]}
                      </div>
                    )}
                  </div>
                  <div className="text-left">
                    <h2 className="text-[#081F5C] text-xl font-bold">
                      {selectedPool?.name || "Select Pool"}
                    </h2>
                    <span className="inline-block bg-purple-600 text-white text-xs font-semibold px-2 py-0.5 rounded-md mt-1">
                      V2
                    </span>
                  </div>
                </div>
                <svg
                  className={`w-5 h-5 text-[#081F5C] transition-transform duration-200 ${
                    isDropdownOpen ? "rotate-180" : ""
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>

              {/* Dropdown Menu */}
              {isDropdownOpen && (
                <div className="absolute top-full mt-2 w-full bg-white border border-[#334EAC]/30 rounded-2xl shadow-xl z-50 overflow-hidden">
                  {isLoadingPools ? (
                    <div className="px-6 py-4 text-center text-[#7096D1]">
                      Loading pools...
                    </div>
                  ) : pools.length === 0 ? (
                    <div className="px-6 py-4 text-center text-[#7096D1]">
                      No active pools available
                    </div>
                  ) : (
                    pools.map((pool) => (
                      <button
                        key={pool.id}
                        onClick={() => handlePoolSelect(pool)}
                        className="w-full flex items-center gap-3 px-6 py-4 hover:bg-[#f3f4f6] transition-colors duration-200 border-b border-[#334EAC]/10 last:border-b-0"
                      >
                        <div className="relative w-10 h-6">
                          <div className="absolute left-0 w-6 h-6 rounded-full bg-[#39bfb7] border-2 border-white flex items-center justify-center text-white text-xs font-bold shadow-md">
                            {pool.token1[0]}
                          </div>
                          {pool.token2 && (
                            <div className="absolute left-4 w-6 h-6 rounded-full bg-[#68f9f2] border-2 border-white flex items-center justify-center text-[#081F5C] text-xs font-bold shadow-md">
                              {pool.token2[0]}
                            </div>
                          )}
                        </div>
                        <div className="text-left">
                          <p className="text-[#081F5C] font-semibold">
                            {pool.name}
                          </p>
                          <span className="inline-block bg-purple-600 text-white text-xs font-semibold px-2 py-0.5 rounded-md">
                            V2
                          </span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Pool Information */}
          {selectedPool ? (
            <div className="p-8">
              {/* Stats Grid */}
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

              {/* Your bTokens Balance */}
              {address && (
                <div className="bg-linear-to-br from-[#39bfb7] to-[#68f9f2] rounded-xl p-6 border border-[#334EAC]/30 mb-8 shadow-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-white/80 text-sm">
                          Your bTokens Balance
                        </p>
                        {isLoadingBalance && (
                          <div className="animate-spin rounded-full h-3 w-3 border-2 border-white/30 border-t-white"></div>
                        )}
                      </div>
                      <p className="text-white text-3xl font-bold">
                        {isLoadingBalance ? (
                          <span className="text-white/60">Loading...</span>
                        ) : bTokenBalance !== null ? (
                          <>
                            {parseFloat(bTokenBalance).toLocaleString(
                              undefined,
                              {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 7,
                              }
                            )}
                            <span className="text-xl ml-2">
                              b{selectedPool.token1}
                            </span>
                          </>
                        ) : (
                          <span className="text-white/60">--</span>
                        )}
                      </p>
                      {bTokenBalance !== null &&
                        selectedPool.bTokenRate &&
                        parseFloat(bTokenBalance) > 0 && (
                          <p className="text-white/70 text-sm mt-2">
                            ≈{" "}
                            {(
                              parseFloat(bTokenBalance) *
                              parseFloat(selectedPool.bTokenRate)
                            ).toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 7,
                            })}{" "}
                            {selectedPool.token1}
                            <span className="text-white/60 text-xs ml-2">
                              (Rate:{" "}
                              {parseFloat(selectedPool.bTokenRate).toFixed(9)})
                            </span>
                          </p>
                        )}
                    </div>
                    <button
                      onClick={() => void loadBTokenBalance()}
                      disabled={isLoadingBalance}
                      className="bg-white/20 hover:bg-white/30 rounded-full p-3 transition-colors duration-200 disabled:opacity-50"
                      title="Refresh balance"
                    >
                      <svg
                        className={`w-8 h-8 text-white ${isLoadingBalance ? "animate-spin" : ""}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-4">
                <button
                  onClick={handleLendClick}
                  className="flex-1 bg-[#081F5C] hover:bg-[#12328a] text-white px-6 py-4 rounded-2xl text-lg font-bold transition-all duration-200 shadow-lg"
                >
                  Deposit
                </button>
                <button
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

      {/* Lend Modal */}
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
          {/* Modal Header */}
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

          {/* Pool Information */}
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

          {/* Amount Input */}
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

          {/* Error Display */}
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

          {/* Action Buttons */}
          <Box sx={{ display: "flex", gap: 2 }}>
            <button
              onClick={handleCloseModal}
              className="flex-1 bg-gray-200 hover:bg-gray-300 text-[#081F5C] px-4 py-3 rounded-xl text-sm font-bold transition-colors duration-200"
            >
              Cancel
            </button>
            <button
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
