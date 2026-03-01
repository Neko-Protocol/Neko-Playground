"use client";

import React from "react";
import {
  Line,
  LineChart,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { PriceChartDatum } from "../../types/stocks";
import { CHART_ACCENT_COLOR } from "../../constants/oracle";

export interface PriceChartProps {
  data: PriceChartDatum[];
  /** Height of the chart in pixels. */
  height?: number;
  className?: string;
}

export function PriceChart({ data, height = 400, className }: PriceChartProps) {
  if (data.length === 0) {
    return (
      <div
        className={`flex items-center justify-center rounded-2xl border border-white/5 bg-[#1C1C1C] p-12 text-white/40 ${className ?? ""}`}
        style={{ minHeight: height }}
      >
        <p className="text-base">No historical data available yet</p>
      </div>
    );
  }

  return (
    <div className={`bg-[#1C1C1C] rounded-2xl border border-white/5 p-6 ${className ?? ""}`}>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis
            dataKey="timestamp"
            stroke="rgba(255,255,255,0.15)"
            tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }}
            angle={-45}
            textAnchor="end"
            height={80}
          />
          <YAxis
            stroke="rgba(255,255,255,0.15)"
            tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 12 }}
            domain={["auto", "auto"]}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1C1C1C",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "10px",
              color: "#ffffff",
            }}
            labelStyle={{ color: "rgba(255,255,255,0.5)", fontSize: 11 }}
            formatter={(value: number) => [`$${value.toFixed(2)}`, "Price"]}
          />
          <Line
            type="monotone"
            dataKey="price"
            stroke={CHART_ACCENT_COLOR}
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 5, fill: CHART_ACCENT_COLOR, stroke: "#1C1C1C", strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
