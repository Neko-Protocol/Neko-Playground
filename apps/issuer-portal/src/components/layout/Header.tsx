import Link from "next/link";
import { ConnectWalletButton } from "@/components/ConnectWalletButton";

export function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-white/5 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link href="/" className="font-klein text-xl tracking-tight text-white">
          Neko <span className="text-neko-teal">Issuers</span>
        </Link>
        <nav className="flex items-center gap-6 text-sm">
          <Link
            href="/marketplace"
            className="text-white/70 hover:text-white transition-colors"
          >
            Marketplace
          </Link>
          <Link
            href="/issuer/list"
            className="text-white/70 hover:text-white transition-colors"
          >
            List asset
          </Link>
          <ConnectWalletButton />
        </nav>
      </div>
    </header>
  );
}
