"use client";

import React from "react";
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import type { NavPoint } from "../../types/analytics";

interface NavChartProps {
  data: NavPoint[];
  isLoading?: boolean;
}

const EMPTY: NavPoint[] = [];

export function NavChart({ data = EMPTY, isLoading }: NavChartProps) {
  if (isLoading) {
    return (
      <div className="rounded-2xl border border-white/5 bg-[#1C1C1C] p-6 h-80 flex items-center justify-center">
        <p className="text-white/40 text-sm animate-pulse">
          Loading NAV history…
        </p>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="rounded-2xl border border-white/5 bg-[#1C1C1C] p-6 h-80 flex flex-col items-center justify-center gap-1">
        <p className="text-white/40 text-sm">No NAV history yet</p>
        <p className="text-white/25 text-xs">
          A snapshot of your real net worth is recorded once per day — come back
          tomorrow to start seeing a trend.
        </p>
      </div>
    );
  }

  const maxDrawdown = Math.min(...data.map((d) => d.drawdown));

  return (
    <div className="rounded-2xl border border-white/5 bg-[#1C1C1C] p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-white font-semibold text-sm">NAV History</h3>
          <span className="text-[10px] font-medium uppercase tracking-wide text-[#76C464]/70 bg-[#76C464]/10 px-1.5 py-0.5 rounded">
            Live
          </span>
        </div>
        {maxDrawdown < -0.01 && (
          <span className="text-xs text-red-400 bg-red-400/10 px-2 py-1 rounded-lg">
            Max DD: {maxDrawdown.toFixed(2)}%
          </span>
        )}
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={data}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(255,255,255,0.05)"
          />
          <XAxis
            dataKey="date"
            stroke="rgba(255,255,255,0.15)"
            tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }}
            tickFormatter={(v: string) => v.slice(5)}
          />
          <YAxis
            yAxisId="nav"
            stroke="rgba(255,255,255,0.15)"
            tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }}
            tickFormatter={(v: number) =>
              "$" +
              v.toLocaleString("en-US", {
                notation: "compact",
                maximumFractionDigits: 1,
              })
            }
          />
          <YAxis
            yAxisId="dd"
            orientation="right"
            stroke="rgba(255,255,255,0.1)"
            tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 10 }}
            tickFormatter={(v: number) => `${v.toFixed(1)}%`}
            domain={[Math.min(maxDrawdown * 1.2, -1), 0]}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1C1C1C",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "10px",
              color: "#ffffff",
            }}
            labelStyle={{ color: "rgba(255,255,255,0.5)", fontSize: 11 }}
            formatter={(value: number, name: string) => {
              if (name === "nav")
                return [
                  "$" +
                    value.toLocaleString("en-US", { maximumFractionDigits: 2 }),
                  "NAV",
                ];
              return [`${value.toFixed(2)}%`, "Drawdown"];
            }}
          />
          <Legend
            wrapperStyle={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}
          />
          <ReferenceLine yAxisId="dd" y={0} stroke="rgba(255,255,255,0.1)" />
          <Line
            yAxisId="nav"
            type="monotone"
            dataKey="nav"
            stroke="#68f9f2"
            strokeWidth={2}
            dot={false}
            activeDot={{
              r: 4,
              fill: "#68f9f2",
              stroke: "#1C1C1C",
              strokeWidth: 2,
            }}
            name="nav"
          />
          <Area
            yAxisId="dd"
            type="monotone"
            dataKey="drawdown"
            stroke="#ef4444"
            fill="rgba(239,68,68,0.15)"
            strokeWidth={1}
            dot={false}
            name="drawdown"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
