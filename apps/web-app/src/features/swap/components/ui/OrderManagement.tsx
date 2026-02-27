"use client";

import React, { useState, useEffect } from "react";
import { useAccount, useChainId, useWalletClient } from "wagmi";
import { ORDER_HISTORY_LIMIT } from "@/features/swap/constants/swapConfig";
import { EVM_TOKEN_ADDRESS_TO_SYMBOL } from "@/lib/constants/tokenIcons";
import {
  getCowSwapOpenOrders,
  getCowSwapOrderHistory,
  cancelCowSwapOrder,
  type CowSwapOrderWithPrice,
} from "@/lib/helpers/evm/cowswap";
import type { CowSwapOrder } from "@/lib/types";

/**
 * Order Management Component
 * Shows open orders, order history, and allows order cancellation
 */
export const OrderManagement: React.FC = () => {
  const { address } = useAccount();
  const chainId = useChainId();
  const { data: walletClient } = useWalletClient();
  const [activeTab, setActiveTab] = useState<"open" | "history">("open");
  const [openOrders, setOpenOrders] = useState<CowSwapOrderWithPrice[]>([]);
  const [orderHistory, setOrderHistory] = useState<CowSwapOrder[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load open orders
  const loadOpenOrders = async () => {
    if (!address) return;

    setIsLoading(true);
    setError(null);

    try {
      const orders = await getCowSwapOpenOrders(address, chainId);
      setOpenOrders(orders || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load orders");
    } finally {
      setIsLoading(false);
    }
  };

  // Load order history
  const loadOrderHistory = async () => {
    if (!address) return;

    setIsLoading(true);
    setError(null);

    try {
      const history = await getCowSwapOrderHistory(
        { owner: address, limit: ORDER_HISTORY_LIMIT },
        chainId
      );
      setOrderHistory(history.orders || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load history");
    } finally {
      setIsLoading(false);
    }
  };

  // Load data when component mounts or tab changes
  useEffect(() => {
    if (activeTab === "open") {
      loadOpenOrders();
    } else {
      loadOrderHistory();
    }
  }, [address, chainId, activeTab]);

  // Cancel order handler
  const handleCancelOrder = async (
    orderId: string,
    onChain: boolean = false
  ) => {
    if (!address || !walletClient) return;

    try {
      const result = await cancelCowSwapOrder(
        { orderId, onChain },
        chainId,
        walletClient
      );

      if (result.success) {
        // Reload orders
        if (activeTab === "open") {
          loadOpenOrders();
        } else {
          loadOrderHistory();
        }
      } else {
        setError(result.message || "Failed to cancel order");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel order");
    }
  };

  const resolveTokenSymbol = (address: string): string =>
    EVM_TOKEN_ADDRESS_TO_SYMBOL[address.toLowerCase()] ||
    address.slice(0, 6) + "…";

  // Get traffic light color based on progress status
  const getTrafficLightColor = (status: string) => {
    switch (status) {
      case "far":
        return "bg-red-500";
      case "close":
        return "bg-yellow-500";
      case "executable":
        return "bg-green-500";
      case "executing":
        return "bg-blue-500";
      default:
        return "bg-gray-500";
    }
  };

  if (!address) {
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6">
        <p className="text-gray-400 text-center">
          Connect your wallet to view orders
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6">
      {/* Tab Navigation */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab("open")}
          className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
            activeTab === "open"
              ? "text-white bg-[#334EAC]"
              : "text-gray-400 hover:text-gray-300"
          }`}
        >
          Open Orders ({openOrders.length})
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
            activeTab === "history"
              ? "text-white bg-[#334EAC]"
              : "text-gray-400 hover:text-gray-300"
          }`}
        >
          Order History
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#334EAC] mx-auto"></div>
          <p className="text-gray-400 mt-2">Loading orders...</p>
        </div>
      )}

      {/* Open Orders */}
      {activeTab === "open" && !isLoading && (
        <div className="space-y-3">
          {(openOrders || []).length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-400">No open orders</p>
            </div>
          ) : (
            openOrders.map((order) => (
              <div
                key={order.orderId}
                className="bg-gray-900/50 border border-gray-700 rounded-lg p-4"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-3 h-3 rounded-full ${getTrafficLightColor(
                        order.progressStatus
                      )}`}
                      title={`Status: ${order.progressStatus}`}
                    />
                    <span className="text-sm font-semibold text-white">
                      {order.kind.toUpperCase()}{" "}
                      {resolveTokenSymbol(order.sellToken)} →{" "}
                      {resolveTokenSymbol(order.buyToken)}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleCancelOrder(order.orderId, false)}
                      className="px-3 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-400">Limit Price</p>
                    <p className="text-white font-semibold">
                      {order.limitPrice}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400">Amount</p>
                    <p className="text-white font-semibold">
                      {order.sellAmount}
                    </p>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-gray-700">
                  <a
                    href={order.explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#334EAC] hover:text-[#081F5C] text-sm"
                  >
                    View on Explorer →
                  </a>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Order History */}
      {activeTab === "history" && !isLoading && (
        <div className="space-y-3">
          {(orderHistory || []).length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-400">No order history</p>
            </div>
          ) : (
            orderHistory.map((order) => (
              <div
                key={order.orderId}
                className="bg-gray-900/50 border border-gray-700 rounded-lg p-4"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold text-white">
                    {order.kind.toUpperCase()}{" "}
                    {resolveTokenSymbol(order.sellToken)} →{" "}
                    {resolveTokenSymbol(order.buyToken)}
                  </span>
                  <span
                    className={`px-2 py-1 text-xs rounded ${
                      order.status === "filled"
                        ? "bg-green-600 text-white"
                        : order.status === "cancelled"
                          ? "bg-red-600 text-white"
                          : "bg-yellow-600 text-white"
                    }`}
                  >
                    {order.status}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-gray-400">Amount</p>
                    <p className="text-white font-semibold">
                      {order.sellAmount}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400">Filled</p>
                    <p className="text-white font-semibold">
                      {order.executedSellAmount}/{order.sellAmount}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400">Date</p>
                    <p className="text-white font-semibold">
                      {new Date(order.creationDate).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
