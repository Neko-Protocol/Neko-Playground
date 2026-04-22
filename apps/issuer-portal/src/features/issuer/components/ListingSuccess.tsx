"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { STELLAR_EXPERT_TESTNET } from "@/lib/constants";

interface ListingSuccessProps {
  contractId: string;
  listTx: string;
}

export function ListingSuccess({ contractId, listTx }: ListingSuccessProps) {
  return (
    <Card className="p-8 space-y-5">
      <h3 className="text-lg font-semibold">Asset listed</h3>
      <p className="text-sm text-white/60">
        Your liquidity is escrowed in the Neko distributor. Verified buyers can
        now purchase.
      </p>

      <div className="space-y-2 rounded-lg border border-white/10 bg-white/5 p-4 text-xs">
        <div className="flex justify-between gap-4">
          <span className="text-white/50">Token</span>
          <a
            href={`${STELLAR_EXPERT_TESTNET}/contract/${contractId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-neko-teal truncate"
          >
            {contractId}
          </a>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-white/50">List tx</span>
          <a
            href={`${STELLAR_EXPERT_TESTNET}/tx/${listTx}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-neko-teal truncate"
          >
            {listTx}
          </a>
        </div>
      </div>

      <div className="flex gap-3">
        <Link href="/marketplace">
          <Button>View in marketplace</Button>
        </Link>
        <Link href="/issuer/list">
          <Button variant="secondary">List another</Button>
        </Link>
      </div>
    </Card>
  );
}
