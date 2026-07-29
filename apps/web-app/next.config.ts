import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";

/**
 * Security headers.
 *
 * This is a wallet-signing DeFi app, so we lock down clickjacking, MIME
 * sniffing, referrer leakage and unused browser APIs, and ship a
 * Content-Security-Policy scoped to the origins the app actually talks to.
 *
 * The CSP `connect-src` is derived from the configured Stellar RPC/Horizon
 * URLs plus the fixed set of third-party hosts the app uses (SoroSwap,
 * Aqua AMM, Etherfuse, WalletConnect). If you point the app at a new
 * network, RPC, indexer or API host, add it here or the browser will block
 * the request.
 */

// Origins the app connects to via fetch / XHR / WebSocket.
const connectSrc = [
  "'self'",
  // Stellar RPC / Horizon — configurable, with testnet + mainnet fallbacks
  process.env.NEXT_PUBLIC_STELLAR_RPC_URL,
  process.env.NEXT_PUBLIC_STELLAR_HORIZON_URL,
  "https://rpc.stellar.org",
  "https://horizon.stellar.org",
  "https://soroban-testnet.stellar.org",
  "https://horizon-testnet.stellar.org",
  "https://friendbot.stellar.org",
  "https://friendbot-futurenet.stellar.org",
  // SoroSwap
  "https://api.soroswap.finance",
  // Aqua AMM
  "https://amm-api.aqua.network",
  "https://amm-api-testnet.aqua.network",
  // Etherfuse FX anchor
  "https://app.etherfuse.com",
  "https://devnet.etherfuse.com",
  "https://api.sand.etherfuse.com",
  // WalletConnect (relay + API + verify)
  "https://*.walletconnect.com",
  "https://*.walletconnect.org",
  "wss://*.walletconnect.com",
  "wss://*.walletconnect.org",
]
  .filter(Boolean)
  .join(" ");

// Origins allowed to frame in (wallet modals / verify iframes).
const frameSrc = [
  "'self'",
  "https://verify.walletconnect.com",
  "https://verify.walletconnect.org",
  "https://*.walletconnect.com",
  "https://*.walletconnect.org",
].join(" ");

const contentSecurityPolicy = [
  "default-src 'self'",
  // Next.js injects inline bootstrap scripts; the Stellar SDK uses WebAssembly.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval'",
  // Tailwind / styled runtime styles are inlined.
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src ${connectSrc}`,
  `frame-src ${frameSrc}`,
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  experimental: {
    // Improve tree-shaking / per-route splitting for large barrel-export
    // packages so unused icons/components don't land in the shared bundle.
    optimizePackageImports: [
      "@mui/material",
      "@mui/icons-material",
      "lucide-react",
      "chart.js",
      "react-chartjs-2",
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

// Run `ANALYZE=true npm run build` to emit an interactive bundle report.
const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

export default withBundleAnalyzer(nextConfig);
