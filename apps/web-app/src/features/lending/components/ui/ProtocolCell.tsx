import Image from "next/image";
import { getTokenIcon } from "@/lib/helpers/tokenUtils";
import type { PoolData } from "../../types/lending";

export function ProtocolCell({ pool }: { pool: PoolData }) {
  const icon = getTokenIcon({ type: "contract", code: pool.token1 });

  return (
    <div className="flex items-center gap-3">
      <div className="h-9 w-9 rounded-full bg-[#1a2a4a] border border-white/10 flex items-center justify-center shrink-0 overflow-hidden">
        {icon ? (
          <Image
            src={icon}
            alt={pool.token1}
            width={28}
            height={28}
            unoptimized
          />
        ) : (
          <span className="text-white text-xs font-bold">
            {pool.token1.slice(0, 3).toUpperCase()}
          </span>
        )}
      </div>
      <span className="text-white font-medium text-sm">{pool.name}</span>
      {pool.isAggregated ? (
        <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-400">
          Aggregated
        </span>
      ) : (
        <span className="rounded bg-[#2A2A2A] px-1.5 py-0.5 text-[10px] font-semibold text-white/50">
          V2
        </span>
      )}
    </div>
  );
}
