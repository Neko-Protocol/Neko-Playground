"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export interface ProductCardProps {
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
  stats?: {
    label: string;
    value: string;
    highlight?: boolean;
  }[];
  badge?: string;
  gradient?: string;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  title,
  description,
  href,
  icon,
  stats,
  badge,
  gradient = "from-[#229EDF]/10 to-transparent",
}) => {
  return (
    <Link
      href={href}
      className="group relative flex flex-col rounded-2xl bg-[#1A1A1A] border border-white/5 overflow-hidden transition-all duration-300 hover:border-[#229EDF]/30 hover:shadow-xl hover:shadow-[#229EDF]/5"
    >
      <div
        className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`}
      />

      <div className="relative z-10 p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="p-3 rounded-xl bg-[#229EDF]/10 text-[#229EDF]">
            {icon}
          </div>
          {badge && (
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[#4ADE80]/10 text-[#4ADE80] border border-[#4ADE80]/20">
              {badge}
            </span>
          )}
        </div>

        <h3 className="text-white font-bold text-lg mb-2">{title}</h3>
        <p className="text-white/50 text-sm leading-relaxed mb-4">
          {description}
        </p>

        {stats && stats.length > 0 && (
          <div className="flex gap-4 pt-4 border-t border-white/5">
            {stats.map((stat, idx) => (
              <div key={idx} className="flex-1">
                <p className="text-white/40 text-xs mb-1">{stat.label}</p>
                <p
                  className={`font-bold ${stat.highlight ? "text-[#4ADE80]" : "text-white"}`}
                >
                  {stat.value}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="relative z-10 mt-auto px-6 py-4 bg-white/[0.02] border-t border-white/5 flex items-center justify-between">
        <span className="text-white/60 text-sm font-medium group-hover:text-white transition-colors">
          Explore {title}
        </span>
        <ArrowRight className="h-4 w-4 text-white/40 group-hover:text-[#229EDF] group-hover:translate-x-1 transition-all" />
      </div>
    </Link>
  );
};
