/**
 * Admin UI access control (defense-in-depth).
 *
 * Layer 1 — middleware + cookie: blocks /dashboard/admin HTML/RSC before client
 * JS for non-admin wallets. Cookie is a UX/routing hint, not wallet proof.
 *
 * Layer 2 — server page.tsx: redirects when LENDING_ADMIN_ADDRESS is unset.
 *
 * Layer 3 — client AdminGate: handles hydration races and stale cookies; defers
 * admin component mount until the connected wallet matches.
 *
 * Layer 4 — on-chain contract auth: the real boundary for privileged mutations.
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { WALLET_ADDRESS_COOKIE } from "@/lib/wallet-cookie";

const ADMIN_PATH = "/dashboard/admin";

export function middleware(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith(ADMIN_PATH)) {
    return NextResponse.next();
  }

  const adminAddress = process.env.LENDING_ADMIN_ADDRESS;
  if (!adminAddress) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  const walletAddress = request.cookies.get(WALLET_ADDRESS_COOKIE)?.value;
  if (!walletAddress || walletAddress !== adminAddress) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/admin", "/dashboard/admin/:path*"],
};
