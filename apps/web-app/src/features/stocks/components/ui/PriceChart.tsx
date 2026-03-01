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
        className={`flex items-center justify-center rounded-3xl border border-gray-200 bg-white p-12 text-gray-500 ${className ?? ""}`}
        style={{ minHeight: height }}
      >
        <p className="text-lg">No historical data available yet</p>
      </div>
    );
  }

  return (
    <div
      className={`bg-white rounded-3xl border border-gray-200 p-6 shadow-lg ${className ?? ""}`}
    >
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="timestamp"
            stroke="#6b7280"
            tick={{ fill: "#6b7280", fontSize: 11 }}
            angle={-45}
            textAnchor="end"
            height={80}
          />
          <YAxis
            stroke="#6b7280"
            tick={{ fill: "#6b7280", fontSize: 12 }}
            domain={["auto", "auto"]}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#ffffff",
              border: "1px solid #e5e7eb",
              borderRadius: "8px",
              color: "#000000",
            }}
            formatter={(value: number) => [`$${value.toFixed(2)}`, "Price"]}
          />
          <Line
            type="monotone"
            dataKey="price"
            stroke={CHART_ACCENT_COLOR}
            strokeWidth={3}
            dot={false}
            activeDot={{ r: 6, fill: CHART_ACCENT_COLOR }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
