"use client";

import Link from "next/link";
import { ArrowLeftRight, Zap, Vault, ExternalLink } from "lucide-react";
import type { ActivityEvent } from "../../types/activityEvent";
import { useActivityStore } from "@/stores/activityStore";
import { formatDistanceToNow } from "date-fns";

const SOURCE_ICONS = {
  swap: ArrowLeftRight,
  automation: Zap,
  vault: Vault,
};

const SOURCE_COLORS = {
  swap: "text-blue-400 border-blue-400",
  automation: "text-amber-400 border-amber-400",
  vault: "text-green-400 border-green-400",
};

export function ActivityFeedItem({ event }: { event: ActivityEvent }) {
  const markRead = useActivityStore((state) => state.markRead);
  const Icon = SOURCE_ICONS[event.source] || ExternalLink;
  const colorClass =
    SOURCE_COLORS[event.source] || "text-gray-400 border-gray-400";

  const timeAgo = formatDistanceToNow(event.timestamp, { addSuffix: true });

  return (
    <Link
      href={event.link}
      onClick={() => {
        if (!event.read) markRead(event.id);
      }}
      className="group flex items-start gap-4 p-4 rounded-xl bg-[#1a1a1a] border border-white/5 hover:border-white/20 transition-colors relative"
    >
      {!event.read && (
        <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-blue-500" />
      )}

      <div
        className={`p-2 rounded-lg bg-[#2a2a2a] border ${colorClass.split(" ")[1]}`}
      >
        <Icon className={`w-5 h-5 ${colorClass.split(" ")[0]}`} />
      </div>

      <div className="flex-1 min-w-0 pr-4">
        <p className="text-sm text-white/60 mb-1">{timeAgo}</p>
        <p className="text-base text-white font-medium">{event.summary}</p>
        <div className="mt-2 text-sm text-white/40 capitalize">
          {event.source} • {event.type.replace(/-/g, " ")}
        </div>
      </div>
    </Link>
  );
}
