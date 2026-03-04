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
}

export function LendTable({
  pools,
  isLoading,
  error,
  onDeposit,
  onWithdraw,
}: LendTableProps) {
  return (
    <div className="w-full rounded-2xl overflow-hidden border border-white/5 bg-[#1C1C1C]">
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
            <ColHeader icon={Zap} label="Actions" centered />
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
              </tr>
            ))
          )}
        </tbody>
      </table>
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
