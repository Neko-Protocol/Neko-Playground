import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";

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
};

// Run `ANALYZE=true npm run build` to emit an interactive bundle report.
const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

export default withBundleAnalyzer(nextConfig);
