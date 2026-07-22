"use client";

import React, { useMemo } from "react";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  type Plugin,
} from "chart.js";
import { Doughnut } from "react-chartjs-2";
import { CHART_COLORS } from "../../const/analytics";
import type { AllocationEntry } from "../../types/analytics";

ChartJS.register(ArcElement, Tooltip, Legend);

interface AllocationDonutProps {
  data: AllocationEntry[];
  hhi?: number;
  diversificationScore?: number;
  isLoading?: boolean;
}

export function AllocationDonut({
  data,
  hhi,
  diversificationScore,
  isLoading,
}: AllocationDonutProps) {
  const chartData = useMemo(
    () => ({
      labels: data.map((d) => d.label),
      datasets: [
        {
          data: data.map((d) => d.pct),
          backgroundColor: data.map(
            (_, i) => CHART_COLORS[i % CHART_COLORS.length]
          ),
          borderWidth: 3,
          borderColor: "#1C1C1C",
          hoverOffset: 6,
          hoverBorderWidth: 3,
          hoverBorderColor: "#fff",
        },
      ],
    }),
    [data]
  );

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "right" as const,
          labels: {
            color: "rgba(255,255,255,0.5)",
            usePointStyle: true,
            pointStyle: "circle" as const,
            padding: 16,
            font: { size: 12, family: "Inter" },
          },
        },
        tooltip: {
          backgroundColor: "rgba(28,28,28,0.95)",
          titleColor: "#ffffff",
          bodyColor: "rgba(255,255,255,0.6)",
          borderColor: "rgba(255,255,255,0.1)",
          borderWidth: 1,
          padding: 12,
          cornerRadius: 8,
          callbacks: {
            label: (ctx: { parsed: number; label: string }) =>
              `${ctx.label}: ${ctx.parsed.toFixed(1)}%`,
          },
        },
      },
      cutout: "68%",
    }),
    []
  );

  const centerPlugin: Plugin<"doughnut"> = useMemo(
    () => ({
      id: "centerText",
      afterDraw(chart) {
        const { ctx } = chart;
        const { top, bottom, left, right } = chart.chartArea;
        const cx = (left + right) / 2;
        const cy = (top + bottom) / 2;
        ctx.save();
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "rgba(255,255,255,0.35)";
        ctx.font = "500 10px Inter, sans-serif";
        ctx.fillText("DIVERSITY", cx, cy - 11);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 20px Inter, sans-serif";
        ctx.fillText(
          diversificationScore != null ? `${diversificationScore}` : "—",
          cx,
          cy + 9
        );
        ctx.restore();
      },
    }),
    [diversificationScore]
  );

  if (isLoading || data.length === 0) {
    return (
      <div className="rounded-2xl border border-white/5 bg-[#1C1C1C] p-6">
        <h3 className="text-white font-semibold text-sm mb-4">
          Asset Allocation
        </h3>
        <div className="h-52 flex items-center justify-center">
          <p className="text-white/30 text-sm">
            {isLoading ? "Loading…" : "No positions yet"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/5 bg-[#1C1C1C] p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-white font-semibold text-sm">Asset Allocation</h3>
          <span className="text-[10px] font-medium uppercase tracking-wide text-[#76C464]/70 bg-[#76C464]/10 px-1.5 py-0.5 rounded">
            Live
          </span>
        </div>
        {hhi != null && (
          <span className="text-xs text-white/40">HHI: {hhi.toFixed(0)}</span>
        )}
      </div>
      <div className="relative h-52">
        <Doughnut data={chartData} options={options} plugins={[centerPlugin]} />
      </div>
    </div>
  );
}
