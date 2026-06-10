"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function LendingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] p-4">
      <div className="bg-[#1a1a1a] border border-[#334eac] rounded p-6 max-w-md w-full">
        <div className="flex flex-col items-center text-center">
          <span className="text-3xl mb-3">⚠️</span>
          <h2 className="text-white text-lg font-semibold">Something went wrong</h2>
          <p className="text-[#bad6eb] mt-2 text-sm">Lending unavailable</p>
          <details className="w-full text-left mt-4 text-[#bad6eb] text-xs">
            <summary className="cursor-pointer mb-2">Technical details</summary>
            <div className="p-3 bg-black/20 rounded overflow-x-auto border border-[#334eac]/30">
              {error.message}
              {error.stack && <pre className="mt-2 opacity-80">{error.stack}</pre>}
            </div>
          </details>
          <div className="flex flex-row gap-3 mt-5 w-full justify-center">
            <button
              onClick={reset}
              className="px-4 py-2 bg-[#294cab] hover:bg-[#7096d1] text-white rounded text-sm transition-colors"
            >
              Try again
            </button>
            <Link
              href="/"
              className="px-4 py-2 bg-transparent border border-[#334eac] hover:bg-[#334eac]/20 text-white rounded text-sm transition-colors"
            >
              Go home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
