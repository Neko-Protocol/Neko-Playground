/**
 * Admin UI access control (defense-in-depth) and API session gate.
 *
 * Layer 1 — middleware + cookie: blocks /dashboard/admin HTML/RSC before client
 * JS for non-admin wallets. Cookie is a UX/routing hint, not wallet proof.
 *
 * Layer 2 — server page.tsx: redirects when LENDING_ADMIN_ADDRESS is unset.
 *
 * Layer 3 — client AdminGate: handles hydration races and stale cookies.
 *
 * Layer 4 — on-chain contract auth: the real boundary for privileged mutations.
 *
 * API routes under /api/anchor and /api/automation require neko_session cookie
 * (coarse gate). Per-route ownership checks remain mandatory.
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { isAuthEnforced } from "@/lib/auth/config";
import { WALLET_ADDRESS_COOKIE } from "@/lib/wallet-cookie";

const ADMIN_PATH = "/dashboard/admin";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    isAuthEnforced() &&
    (pathname.startsWith("/api/anchor") ||
      pathname.startsWith("/api/automation"))
  ) {
    if (!request.cookies.get(SESSION_COOKIE_NAME)?.value) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.next();
  }

  if (!pathname.startsWith(ADMIN_PATH)) {
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
  matcher: [
    "/dashboard/admin",
    "/dashboard/admin/:path*",
    "/api/anchor/:path*",
    "/api/automation/:path*",
  ],
};
