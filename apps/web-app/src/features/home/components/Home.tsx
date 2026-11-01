"use client";

import React from "react";
import Link from "next/link";
import {
  Vault,
  BarChart3,
  ArrowLeftRight,
  TrendingUp,
  Landmark,
  Banknote,
} from "lucide-react";
import { Hero } from "./Hero";
import { ProductCard } from "./ProductCard";
import { PageContainer } from "@/components/ui/PageContainer";

const PRODUCTS = [
  {
    title: "Vaults",
    description:
      "Automated yield strategies backed by real-world collateral. Deposit stablecoins and earn optimized returns.",
    href: "/vaults",
    icon: <Vault className="h-6 w-6" />,
    badge: "Popular",
    stats: [
      { label: "TVL", value: "$579K" },
      { label: "Avg APY", value: "8.5%", highlight: true },
    ],
  },
  {
    title: "Discover",
    description:
      "Explore tokenized treasuries, bonds, and RWA tokens with real-time pricing from on-chain oracles.",
    href: "/discover",
    icon: <BarChart3 className="h-6 w-6" />,
    stats: [
      { label: "Assets", value: "6+" },
      { label: "Markets", value: "Global" },
    ],
  },
  {
    title: "Lending",
    description:
      "Supply assets to earn interest or borrow against your collateral with competitive rates.",
    href: "/lending",
    icon: <TrendingUp className="h-6 w-6" />,
    stats: [
      { label: "Supply APY", value: "Up to 12%", highlight: true },
      { label: "Pools", value: "7" },
    ],
  },
  {
    title: "Pools",
    description:
      "Provide liquidity to lending pools and AMMs. Earn fees and interest on your deposits.",
    href: "/pools",
    icon: <Landmark className="h-6 w-6" />,
    stats: [
      { label: "Active Pools", value: "10+" },
      { label: "Total Liquidity", value: "$1.2M" },
    ],
  },
  {
    title: "Swap",
    description:
      "Exchange tokens instantly with best rates via SoroSwap integration. Set limit orders for better prices.",
    href: "/swap",
    icon: <ArrowLeftRight className="h-6 w-6" />,
    stats: [
      { label: "Pairs", value: "15+" },
      { label: "Fees", value: "0.3%" },
    ],
  },
  {
    title: "On/Off Ramps",
    description:
      "Convert fiat to crypto and back. Seamless integration with trusted anchor providers.",
    href: "/ramps",
    icon: <Banknote className="h-6 w-6" />,
    badge: "New",
    stats: [
      { label: "Providers", value: "2" },
      { label: "Currencies", value: "USD, MXN" },
    ],
  },
];

const STATS = [
  { label: "Total Value Locked", value: "$1.8M" },
  { label: "Active Users", value: "2.4K" },
  { label: "Transactions", value: "45K+" },
  { label: "Avg APY", value: "9.2%" },
];

export const Home: React.FC = () => {
  return (
    <PageContainer maxWidth="7xl" className="space-y-12 sm:space-y-16">
      <Hero />

      <section>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">
              Investment Products
            </h2>
            <p className="text-white/50 text-sm sm:text-base">
              Access institutional-grade products with as little as $5
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {PRODUCTS.map((product) => (
            <ProductCard key={product.href} {...product} />
          ))}
        </div>
      </section>

      <section className="rounded-2xl bg-gradient-to-br from-[#1A1A1A] to-[#141414] border border-white/5 p-8 sm:p-10">
        <div className="text-center mb-10">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">
            Protocol Statistics
          </h2>
          <p className="text-white/50">
            Real-time metrics from the Neko Protocol
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {STATS.map((stat, idx) => (
            <div key={idx} className="text-center">
              <p className="text-3xl sm:text-4xl font-bold text-white mb-2">
                {stat.value}
              </p>
              <p className="text-white/40 text-sm">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl bg-[#229EDF]/5 border border-[#229EDF]/20 p-8 sm:p-10">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          <div>
            <h3 className="text-xl sm:text-2xl font-bold text-white mb-2">
              Ready to start investing?
            </h3>
            <p className="text-white/60">
              Connect your Stellar wallet and begin earning yield today.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="shrink-0 px-8 py-4 rounded-xl bg-[#229EDF] hover:bg-[#1a8bc7] text-white font-semibold transition-all duration-200 hover:shadow-lg hover:shadow-[#229EDF]/25"
          >
            Launch App
          </Link>
        </div>
      </section>
    </PageContainer>
  );
};

export default Home;
