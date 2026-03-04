import { TokenAvatar } from "./TokenAvatar";

interface PoolCellProps {
  token1: string;
  token2: string;
  fee: string;
}

export function PoolCell({ token1, token2, fee }: PoolCellProps) {
  return (
    <div className="flex justify-center">
      <div className="flex items-center gap-3 w-[200px] ml-6">
        <div className="relative w-9 h-6 shrink-0">
          <div className="absolute left-0 top-0">
            <TokenAvatar code={token1} />
          </div>
          <div className="absolute left-3.5 top-0">
            <TokenAvatar code={token2} />
          </div>
        </div>
        <span className="text-white font-medium text-sm">
          {token1}/{token2}
        </span>
        <span className="rounded-full bg-[#2F2F2F] px-2 py-0.5 text-xs font-semibold text-white/50 shrink-0">
          {fee}
        </span>
      </div>
    </div>
  );
}
