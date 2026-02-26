"use client";

import React from "react";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
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
        borderColor: "#294cab",
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
          color: "#BAD6EB",
          usePointStyle: true,
          pointStyle: "circle",
          padding: 20,
          font: { size: 12, family: "Inter" },
        },
      },
      tooltip: {
        backgroundColor: "rgba(8, 31, 92, 0.95)",
        titleColor: "#FFF9F0",
        bodyColor: "#BAD6EB",
        borderColor: "#7096D1",
        borderWidth: 2,
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

  return (
    <div className={`relative min-h-[200px] ${className}`}>
      <Doughnut data={chartData} options={options} />
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pr-[100px]">
        <span className="text-[#BAD6EB] text-xs font-medium uppercase tracking-wide">
          Total Assets
        </span>
        <span className="text-[#FFF9F0] text-2xl font-bold mt-1">
          {displayTotal}
        </span>
      </div>
    </div>
  );
}
