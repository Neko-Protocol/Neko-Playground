"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getQueuedReserveParams,
  type QueuedReserveParamState,
} from "@/lib/helpers/stellar/queuedReserveParams";

export type QueuedReserveParamView = QueuedReserveParamState & {
  status: "locked" | "ready";
  remainingSeconds: number;
};

/**
 * Tracks pending reserve-parameter changes for one lending pool and decorates
 * them with a live locked/ready countdown for the admin UI.
 */
export function useQueuedReserveParams(
  contractId: string,
  assets: readonly string[]
) {
  const query = useQuery({
    queryKey: ["queued-reserve-params", contractId, assets],
    queryFn: () => getQueuedReserveParams(contractId, assets),
    enabled: Boolean(contractId),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  const data = useMemo<QueuedReserveParamView[]>(() => {
    const nowSeconds = Math.floor(now / 1_000);

    return (query.data ?? []).map((entry) => {
      const remainingSeconds = Math.max(0, entry.unlockTime - nowSeconds);
      return {
        ...entry,
        status: remainingSeconds === 0 ? "ready" : "locked",
        remainingSeconds,
      };
    });
  }, [now, query.data]);

  return {
    ...query,
    data,
  };
}
