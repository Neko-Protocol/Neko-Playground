"use client";

import { useCountdown } from "@/hooks/useCountdown";

interface QueueCountdownProps {
  expiresAt: Date;
}

export function QueueCountdown({ expiresAt }: QueueCountdownProps) {
  const { days, hours, minutes, seconds, expired } = useCountdown(expiresAt);

  if (expired) {
    return (
      <span className="font-semibold text-green-400">Ready to withdraw</span>
    );
  }

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0 || days > 0) parts.push(`${hours}h`);
  parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);

  return (
    <span className="font-semibold text-amber-400">
      {parts.join(" ")} remaining
    </span>
  );
}
