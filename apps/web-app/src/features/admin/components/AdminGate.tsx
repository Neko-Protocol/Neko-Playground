"use client";

/**
 * Client gate for /dashboard/admin (defense-in-depth).
 *
 * Protects against hydration races and stale/spoofed cookies by deferring
 * admin markup and data fetches until the connected wallet matches the server-
 * supplied admin address. Does NOT replace on-chain auth for mutations.
 */
import { useEffect } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useWallet } from "@/hooks/useWallet";
import { useWalletHydrated } from "@/hooks/useWalletHydrated";
import { PageSkeleton } from "@/components/ui/PageSkeleton";

const AdminPanel = dynamic(() => import("./AdminPanel"), {
  ssr: false,
  loading: () => <PageSkeleton maxWidth="7xl" />,
});

interface AdminGateProps {
  adminAddress: string;
}

export default function AdminGate({ adminAddress }: AdminGateProps) {
  const { address } = useWallet();
  const router = useRouter();
  const hydrated = useWalletHydrated();

  const isAuthorized = hydrated && address === adminAddress;

  useEffect(() => {
    if (!hydrated) return;
    if (address !== adminAddress) {
      router.replace("/dashboard");
    }
  }, [address, adminAddress, hydrated, router]);

  if (!hydrated || !isAuthorized) {
    return <PageSkeleton maxWidth="7xl" />;
  }

  return <AdminPanel />;
}
