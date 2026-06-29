"use client";

import React from "react";
import { CheckCircle, Clock, XCircle, Zap, Ban, Inbox } from "lucide-react";
import type { LimitOrder, LimitOrderStatus } from "../../types/limitOrder";

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  LimitOrderStatus,
  { label: string; color: string; Icon: React.FC<{ className?: string }> }
> = {
  open: {
    label: "Open",
    color: "text-blue-400 bg-blue-400/10 border-blue-400/20",
    Icon: ({ className }) => <Clock className={className} />,
  },
  ready: {
    label: "Ready to fill",
    color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
    Icon: ({ className }) => <Zap className={className} />,
  },
  filled: {
    label: "Filled",
    color: "text-white/40 bg-white/5 border-white/10",
    Icon: ({ className }) => <CheckCircle className={className} />,
  },
  cancelled: {
    label: "Cancelled",
    color: "text-white/30 bg-white/5 border-white/10",
    Icon: ({ className }) => <Ban className={className} />,
  },
  expired: {
    label: "Expired",
    color: "text-white/30 bg-white/5 border-white/10",
    Icon: ({ className }) => <XCircle className={className} />,
  },
};

interface StatusBadgeProps {
  status: LimitOrderStatus;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${cfg.color}`}
    >
      <cfg.Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
};

// ─── Order row ────────────────────────────────────────────────────────────────

interface OrderRowProps {
  order: LimitOrder;
  onCancel: (id: string) => void;
  onFillNow: (order: LimitOrder) => void;
}

const OrderRow: React.FC<OrderRowProps> = ({ order, onCancel, onFillNow }) => {
  const isClosed =
    order.status === "filled" ||
    order.status === "cancelled" ||
    order.status === "expired";

  const expiryLabel = order.expiresAt ? formatTimeLeft(order.expiresAt) : "GTC";

  return (
    <div
      className={`rounded-xl border p-4 flex flex-col gap-3 transition-colors ${
        order.status === "ready"
          ? "border-emerald-400/40 bg-emerald-400/5"
          : "border-white/10 bg-[#252525]"
      }`}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="flex flex-col gap-0.5">
          <span className="text-white font-semibold text-sm">
            {order.side === "buy" ? "Buy" : "Sell"}{" "}
            {parseFloat(order.amountIn).toLocaleString(undefined, {
              maximumFractionDigits: 6,
            })}{" "}
            {order.tokenInSymbol}
          </span>
          <span className="text-white/50 text-xs">
            Limit:{" "}
            <span className="text-white/80 font-medium">
              {parseFloat(order.limitPrice).toLocaleString(undefined, {
                maximumFractionDigits: 8,
              })}{" "}
              {order.tokenOutSymbol}/{order.tokenInSymbol}
            </span>
          </span>
        </div>

        <StatusBadge status={order.status} />
      </div>

      {/* Meta row */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-white/40 text-xs">Expires: {expiryLabel}</span>
        <span className="text-white/40 text-xs">
          Slippage: {(order.slippageBps / 100).toFixed(1)}%
        </span>
      </div>

      {/* Actions */}
      {!isClosed && (
        <div className="flex gap-2 flex-wrap">
          {order.status === "ready" && (
            <button
              type="button"
              onClick={() => onFillNow(order)}
              className="flex-1 min-w-[120px] py-2 bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-sm rounded-xl transition-colors shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-1.5"
            >
              <Zap className="h-4 w-4" />
              Fill now
            </button>
          )}
          <button
            type="button"
            onClick={() => onCancel(order.id)}
            className="py-2 px-4 text-white/40 hover:text-red-400 text-sm font-medium rounded-xl border border-white/10 hover:border-red-400/30 transition-colors"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
};

// ─── Main Panel ───────────────────────────────────────────────────────────────

interface OpenLimitOrdersPanelProps {
  orders: LimitOrder[];
  isLoading?: boolean;
  onCancel: (id: string) => void;
  onFillNow: (order: LimitOrder) => void;
}

export const OpenLimitOrdersPanel: React.FC<OpenLimitOrdersPanelProps> = ({
  orders,
  isLoading,
  onCancel,
  onFillNow,
}) => {
  const activeOrders = orders.filter(
    (o) => o.status === "open" || o.status === "ready"
  );
  const closedOrders = orders.filter(
    (o) =>
      o.status === "filled" ||
      o.status === "cancelled" ||
      o.status === "expired"
  );

  return (
    <div className="flex flex-col gap-4 mt-6">
      <h3 className="text-white font-semibold text-base">Open Orders</h3>

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="rounded-xl border border-white/10 bg-[#252525] p-4 h-24 animate-pulse"
            />
          ))}
        </div>
      ) : activeOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-10 rounded-xl border border-dashed border-white/10 bg-white/[0.02]">
          <Inbox className="h-8 w-8 text-white/20" />
          <p className="text-white/40 text-sm text-center">
            No open limit orders yet.
            <br />
            Create one above to get started.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {activeOrders.map((order) => (
            <OrderRow
              key={order.id}
              order={order}
              onCancel={onCancel}
              onFillNow={onFillNow}
            />
          ))}
        </div>
      )}

      {/* Closed orders history (collapsed) */}
      {closedOrders.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-white/40 hover:text-white/60 text-xs font-medium select-none list-none flex items-center gap-1.5 transition-colors">
            <span className="group-open:rotate-90 transition-transform inline-block">
              ▶
            </span>
            Order history ({closedOrders.length})
          </summary>
          <div className="flex flex-col gap-2 mt-3">
            {closedOrders.map((order) => (
              <OrderRow
                key={order.id}
                order={order}
                onCancel={onCancel}
                onFillNow={onFillNow}
              />
            ))}
          </div>
        </details>
      )}
    </div>
  );
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTimeLeft(expiresAt: number): string {
  const diff = expiresAt - Date.now();
  if (diff <= 0) return "Expired";
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
