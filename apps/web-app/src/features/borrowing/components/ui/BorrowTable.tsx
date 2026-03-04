import {
  Hash,
  Layers,
  TrendingDown,
  Shield,
  Droplets,
  Zap,
} from "lucide-react";
import { ColHeader } from "./ColHeader";
import { IdBadge } from "./IdBadge";
import { PoolCell } from "./PoolCell";
import { Pagination } from "./Pagination";
import type { BorrowTableAsset } from "../../types/borrowing";

interface BorrowTableProps {
  assets: BorrowTableAsset[];
  paginatedAssets: BorrowTableAsset[];
  isLoading: boolean;
  poolsError: unknown;
  page: number;
  totalRows: number;
  totalPages: number;
  rowsPerPage: number;
  onBorrow: (asset: BorrowTableAsset) => void;
  onPageChange: (page: number) => void;
  onRowsPerPageChange: (value: number) => void;
}

export function BorrowTable({
  assets,
  paginatedAssets,
  isLoading,
  poolsError,
  page,
  totalRows,
  totalPages,
  rowsPerPage,
  onBorrow,
  onPageChange,
  onRowsPerPageChange,
}: BorrowTableProps) {
  return (
    <div className="w-full overflow-hidden rounded-2xl border border-white/5 bg-[#1C1C1C]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px]">
        <thead>
          <tr className="border-b border-white/5">
            <ColHeader icon={Hash} label="ID" centered />
            <ColHeader icon={Layers} label="Pool" centered />
            <ColHeader
              icon={TrendingDown}
              label="Borrow APR"
              tooltip="Annual interest rate you pay when borrowing"
              centered
            />
            <ColHeader
              icon={Shield}
              label="Collateral"
              tooltip="Maximum percentage of collateral value you can borrow"
              centered
            />
            <ColHeader
              icon={Droplets}
              label="Liquidity"
              tooltip="Total liquidity in pool"
              centered
            />
            <ColHeader icon={Zap} label="Actions" centered />
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <EmptyRow colSpan={6} message="Loading borrow pools…" />
          ) : poolsError ? (
            <EmptyRow
              colSpan={6}
              message={`Error loading borrow pools: ${String(poolsError)}`}
              variant="error"
            />
          ) : assets.length === 0 ? (
            <EmptyRow colSpan={6} message="No active borrow pools available" />
          ) : (
            paginatedAssets.map((asset) => (
              <tr
                key={asset.id}
                className="border-b border-white/5 hover:bg-white/2 transition-colors"
              >
                <td className="px-4 py-4 align-middle text-center">
                  <IdBadge id={asset.id} isActive={asset.isActive} />
                </td>
                <td className="px-4 py-4 align-middle w-[280px]">
                  <PoolCell
                    token1={asset.pool.token1}
                    token2={asset.pool.token2}
                    fee={asset.pool.fee}
                  />
                </td>
                <td className="px-4 py-4 align-middle text-center text-white text-sm">
                  {asset.borrowApr}
                </td>
                <td className="px-4 py-4 align-middle text-center text-white text-sm">
                  {asset.collateralFactorDisplay}
                </td>
                <td className="px-4 py-4 align-middle text-center text-white text-sm">
                  {asset.liquidity}
                </td>
                <td className="px-4 py-4 align-middle text-center">
                  <button
                    onClick={() => onBorrow(asset)}
                    className="rounded-lg bg-[#229EDF] hover:bg-[#1a8bc7] px-4 py-1.5 text-white text-xs font-semibold transition-colors"
                  >
                    Borrow
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
        </table>
      </div>

      {totalRows > 0 && (
        <Pagination
          page={page}
          totalRows={totalRows}
          totalPages={totalPages}
          rowsPerPage={rowsPerPage}
          onPageChange={onPageChange}
          onRowsPerPageChange={onRowsPerPageChange}
        />
      )}
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

export default BorrowTable;
