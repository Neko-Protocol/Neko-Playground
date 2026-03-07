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

ChartJS.register(ArcElement, Tooltip, Legend);

export interface Holding {
  name: string;
  value: number;
}

const CHART_COLORS = [
  "#68f9f2ff",
  "#31c1c6ff",
  "#1dd1b3ff",
  "#1daca9ff",
  "#2bb8d7ff",
  "#39bfb7ff",
  "#7096D1ff",
  "#334EACff",
];

interface HoldingsPieChartProps {
  holdings: Holding[];
  totalValue?: number;
  className?: string;
}

export function HoldingsPieChart({
  holdings,
  totalValue,
  className = "",
}: HoldingsPieChartProps) {
  const chartData = {
    labels: holdings.map((h) => h.name),
    datasets: [
      {
        data: holdings.map((h) => h.value),
        backgroundColor: holdings.map(
          (_, i) => CHART_COLORS[i % CHART_COLORS.length]
        ),
        borderWidth: 3,
        borderColor: "#1C1C1C",
        hoverOffset: 8,
        hoverBorderWidth: 4,
        hoverBorderColor: "#FFF9F0",
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "right" as const,
        labels: {
          color: "rgba(255,255,255,0.5)",
          usePointStyle: true,
          pointStyle: "circle",
          padding: 20,
          font: { size: 12, family: "Inter" },
        },
      },
      tooltip: {
        backgroundColor: "rgba(42, 42, 42, 0.95)",
        titleColor: "#ffffff",
        bodyColor: "rgba(255,255,255,0.6)",
        borderColor: "rgba(255,255,255,0.1)",
        borderWidth: 1,
        padding: 16,
        cornerRadius: 8,
        callbacks: {
          label: (context: { parsed: number; label: string }) => {
            const value = context.parsed;
            const label = context.label;
            return `${label}: ${value.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 7,
            })}`;
          },
        },
      },
    },
    cutout: "70%",
  };

  const displayTotal =
    totalValue !== undefined
      ? totalValue.toLocaleString("en-US", {
          notation: "compact",
          maximumFractionDigits: 1,
        })
      : holdings
          .reduce((sum, h) => sum + h.value, 0)
          .toLocaleString("en-US", {
            notation: "compact",
            maximumFractionDigits: 1,
          });

  const centerTextPlugin: Plugin<"doughnut"> = useMemo(
    () => ({
      id: "centerText",
      afterDraw(chart) {
        const { ctx } = chart;
        const { top, bottom, left, right } = chart.chartArea;
        const centerX = (left + right) / 2;
        const centerY = (top + bottom) / 2;

        ctx.save();
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
        ctx.font = "500 10px Inter, sans-serif";
        ctx.letterSpacing = "0.05em";
        ctx.fillText("TOTAL ASSETS", centerX, centerY - 12);

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 22px Inter, sans-serif";
        ctx.letterSpacing = "0em";
        ctx.fillText(String(displayTotal), centerX, centerY + 10);

        ctx.restore();
      },
    }),
    [displayTotal]
  );

  return (
    <div className={`relative min-h-[210px] ${className}`}>
      <Doughnut
        data={chartData}
        options={options}
        plugins={[centerTextPlugin]}
      />
    </div>
  );
}
