import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";

export default function LandingPage() {
  return (
    <div className="flex flex-col gap-16 pt-8">
      <section className="flex flex-col items-start gap-6">
        <span className="text-xs uppercase tracking-[0.2em] text-neko-teal">
          Neko Issuer Portal — Stellar Testnet
        </span>
        <h1 className="font-klein text-5xl leading-[1.05] tracking-tight text-white md:text-6xl">
          Distribute regulated
          <br />
          real-world assets.
        </h1>
        <p className="max-w-xl text-lg text-white/70">
          Bring your tokenized asset to Neko. Escrow liquidity in Trustless
          Work, register the listing on-chain and let verified buyers purchase
          for XLM, atomically.
        </p>
        <div className="flex gap-3">
          <Link href="/issuer/list">
            <Button size="lg">List an asset</Button>
          </Link>
          <Link href="/marketplace">
            <Button variant="secondary" size="lg">
              Browse marketplace
            </Button>
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardBody>
            <div className="mb-2 font-klein text-lg text-neko-teal">01</div>
            <h3 className="mb-1 text-base font-semibold text-white">
              Verify as an issuer
            </h3>
            <p className="text-sm text-white/60">
              Complete accredited KYC with DIDIT before you can list liquidity
              on Neko.
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="mb-2 font-klein text-lg text-neko-teal">02</div>
            <h3 className="mb-1 text-base font-semibold text-white">
              Link your token
            </h3>
            <p className="text-sm text-white/60">
              Paste the contract ID of the SEP-41 token you already deployed. We
              auto-detect name, symbol and decimals.
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="mb-2 font-klein text-lg text-neko-teal">03</div>
            <h3 className="mb-1 text-base font-semibold text-white">
              Deposit and distribute
            </h3>
            <p className="text-sm text-white/60">
              Deposit supply into a per-listing Trustless Work escrow. Verified
              buyers purchase atomically for XLM at a fixed or live oracle
              price, with fees split automatically.
            </p>
          </CardBody>
        </Card>
      </section>
    </div>
  );
}
