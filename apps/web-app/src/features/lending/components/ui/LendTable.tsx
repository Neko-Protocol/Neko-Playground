import React from "react";
import { ArrowLeftRight, TrendingUp, Droplets, Coins, Zap } from "lucide-react";
import { ColHeader } from "./ColHeader";
import { ProtocolCell } from "./ProtocolCell";
import type { PoolData } from "../../types/lending";

interface LendTableProps {
  pools: PoolData[];
  isLoading: boolean;
  error: unknown;
  onDeposit: (pool: PoolData) => void;
  onWithdraw: (pool: PoolData) => void;
  hideActions?: boolean;
}

export function LendTable({
  pools,
  isLoading,
  error,
  onDeposit,
  onWithdraw,
  hideActions = false,
}: LendTableProps) {
  const isEmpty = !isLoading && !error && pools.length === 0;

  return (
    <div className="w-full rounded-2xl overflow-hidden border border-white/5 bg-[#1C1C1C]">
      {}
      <div className="hidden md:block">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5">
              <ColHeader icon={ArrowLeftRight} label="Protocol" />
              <ColHeader
                icon={TrendingUp}
                tooltip="Annual yield rate you earn by supplying assets"
                label="Supply APY"
                centered
              />
              <ColHeader
                icon={Droplets}
                tooltip="Total liquidity in pool"
                label="Total liquidity"
                centered
              />
              <ColHeader
                icon={Coins}
                tooltip="Rate at which you receive bTokens for each asset deposited"
                label="bToken Rate"
                centered
              />
              {!hideActions && (
                <ColHeader icon={Zap} label="Actions" centered />
              )}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <EmptyRow colSpan={5} message="Loading pools…" />
            ) : error ? (
              <EmptyRow
                colSpan={5}
                message={`Error loading pools: ${String(error)}`}
                variant="error"
              />
            ) : pools.length === 0 ? (
              <EmptyRow colSpan={5} message="No active pools available" />
            ) : (
              pools.map((pool) => (
                <tr
                  key={pool.id}
                  className="border-b border-white/5 hover:bg-white/2 transition-colors"
                >
                  <td className="px-4 py-4 align-middle">
                    <ProtocolCell pool={pool} />
                  </td>
                  <td className="px-4 py-4 align-middle text-center text-white text-sm">
                    {pool.roi}
                  </td>
                  <td className="px-4 py-4 align-middle text-center text-white text-sm">
                    {pool.liquidity}
                  </td>
                  <td className="px-4 py-4 align-middle text-center text-white text-sm">
                    {pool.bTokenRate
                      ? parseFloat(pool.bTokenRate).toFixed(4)
                      : "1.0000"}
                  </td>
                  {!hideActions && (
                    <td className="px-4 py-4 align-middle text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => onDeposit(pool)}
                          className="rounded-lg bg-[#2A2A2A] hover:bg-[#333] px-4 py-1.5 text-white/70 hover:text-white text-xs font-semibold transition-colors"
                        >
                          Deposit
                        </button>
                        <button
                          onClick={() => onWithdraw(pool)}
                          className="rounded-lg bg-[#229EDF] hover:bg-[#1a8bc7] px-4 py-1.5 text-white text-xs font-semibold transition-colors"
                        >
                          Withdraw
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {}
      <div className="md:hidden">
        {isLoading ? (
          <MobileEmptyState message="Loading pools…" />
        ) : error ? (
          <MobileEmptyState
            message={`Error loading pools: ${String(error)}`}
            variant="error"
          />
        ) : isEmpty ? (
          <MobileEmptyState message="No active pools available" />
        ) : (
          <ul className="divide-y divide-white/5">
            {pools.map((pool) => (
              <li key={pool.id} className="px-4 py-4">
                {}
                <div className="mb-3">
                  <ProtocolCell pool={pool} />
                </div>

                {}
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <StatCell
                    label="Supply APY"
                    value={pool.roi}
                    icon={TrendingUp}
                  />
                  <StatCell
                    label="Liquidity"
                    value={pool.liquidity}
                    icon={Droplets}
                  />
                  <StatCell
                    label="bToken Rate"
                    value={
                      pool.bTokenRate
                        ? parseFloat(pool.bTokenRate).toFixed(4)
                        : "1.0000"
                    }
                    icon={Coins}
                  />
                </div>

                {!hideActions && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => onDeposit(pool)}
                      className="flex-1 rounded-lg bg-[#2A2A2A] hover:bg-[#333] px-4 py-2 text-white/70 hover:text-white text-sm font-semibold transition-colors"
                    >
                      Deposit
                    </button>
                    <button
                      onClick={() => onWithdraw(pool)}
                      className="flex-1 rounded-lg bg-[#229EDF] hover:bg-[#1a8bc7] px-4 py-2 text-white text-sm font-semibold transition-colors"
                    >
                      Withdraw
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function EmptyRow({
  colSpan,
  message,
  variant = "muted",
}: {
  colSpan: number;
  message: string;
  variant?: "muted" | "error";
}) {
  return (
    <tr>
      <td
        colSpan={colSpan}
        className={`px-4 py-12 text-center text-sm ${variant === "error" ? "text-red-400" : "text-white/40"}`}
      >
        {message}
      </td>
    </tr>
  );
}

function MobileEmptyState({
  message,
  variant = "muted",
}: {
  message: string;
  variant?: "muted" | "error";
}) {
  return (
    <p
      className={`px-4 py-12 text-center text-sm ${variant === "error" ? "text-red-400" : "text-white/40"}`}
    >
      {message}
    </p>
  );
}

function StatCell({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
}) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl bg-[#242424] px-2 py-2.5">
      <div className="flex items-center gap-1 text-white/40">
        <Icon className="h-3 w-3" />
        <span className="text-[10px] font-semibold uppercase tracking-wide">
          {label}
        </span>
      </div>
      <span className="text-white text-sm font-medium">{value}</span>
    </div>
  );
}
