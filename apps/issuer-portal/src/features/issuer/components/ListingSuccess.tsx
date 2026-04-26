"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { STELLAR_EXPERT_TESTNET } from "@/lib/constants";

interface ListingSuccessProps {
  contractId: string;
  listTx: string;
  escrowId: string;
  escrowAddress: string;
  mockEscrow: boolean;
}

export function ListingSuccess({
  contractId,
  listTx,
  escrowId,
  escrowAddress,
  mockEscrow,
}: ListingSuccessProps) {
  return (
    <Card className="p-8 space-y-5">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold">Asset listed</h3>
        <p className="text-sm text-white/60">
          Your tokens are custodied in a {mockEscrow ? "mock " : ""}Trustless
          Work escrow and the listing is registered on-chain. Verified buyers
          can now purchase.
        </p>
      </div>

      <div className="space-y-2 rounded-lg border border-white/10 bg-white/5 p-4 text-xs">
        <Row
          label="Token contract"
          value={contractId}
          href={`${STELLAR_EXPERT_TESTNET}/contract/${contractId}`}
        />
        <Row
          label="List tx"
          value={listTx}
          href={`${STELLAR_EXPERT_TESTNET}/tx/${listTx}`}
        />
        <Row label="Escrow id" value={escrowId} />
        <Row
          label="Escrow address"
          value={escrowAddress}
          href={`${STELLAR_EXPERT_TESTNET}/account/${escrowAddress}`}
        />
        {mockEscrow ? (
          <p className="pt-1 text-amber-400">
            Mock mode: Neko admin acts as the escrow custodian. Set{" "}
            <code className="text-white/80">TRUSTLESS_WORK_API_KEY</code> to
            switch to a real TW escrow.
          </p>
        ) : null}
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

function Row({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href?: string;
}) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-white/50 shrink-0">{label}</span>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-neko-teal truncate"
        >
          {value}
        </a>
      ) : (
        <span className="font-medium text-right truncate">{value}</span>
      )}
    </div>
  );
}
