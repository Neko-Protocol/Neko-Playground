"use client";

export interface BackstopPool {
  label: string;
  contractId: string;
  assets: string;
}

interface BackstopPoolSelectorProps {
  pools: BackstopPool[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}

export function BackstopPoolSelector({
  pools,
  selectedIndex,
  onSelect,
}: BackstopPoolSelectorProps) {
  return (
    <div>
      <p className="text-white/40 text-xs font-semibold uppercase tracking-wide mb-3">
        Select Pool
      </p>
      <div className="grid grid-cols-2 gap-2">
        {pools.map((pool, i) => {
          const isSelected = selectedIndex === i;
          return (
            <button
              key={pool.contractId}
              onClick={() => onSelect(i)}
              className={`rounded-xl border py-3 px-4 text-left transition-colors ${
                isSelected
                  ? "border-[#229EDF]/60 bg-[#229EDF]/10"
                  : "border-white/10 bg-[#242424] hover:border-white/20 hover:bg-white/5"
              }`}
            >
              <p
                className={`text-sm font-semibold ${
                  isSelected ? "text-[#229EDF]" : "text-white/70"
                }`}
              >
                {pool.label}
              </p>
              <p className="text-white/30 text-xs mt-0.5">{pool.assets}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
