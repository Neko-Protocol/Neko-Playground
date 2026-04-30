"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, RefreshCw, WifiOff, X } from "lucide-react";
import { useNetworkStatus } from "./NetworkStatusProvider";

export function OfflineStatusBanner() {
  const { isOffline, isReconnecting, isRestored, status } = useNetworkStatus();
  const [dismissed, setDismissed] = useState(false);

  const content = useMemo(() => {
    if (isOffline) {
      return {
        title: "Sin acceso...",
        description: "",
        icon: <WifiOff className="h-4 w-4" />,
        tone: "bg-[#D92D20] text-white border-[#D92D20]",
      };
    }

    if (isReconnecting) {
      return {
        title: "Reconectando...",
        description: "",
        icon: <RefreshCw className="h-4 w-4" />,
        tone: "bg-[#229EDF] text-white border-[#229EDF]",
      };
    }

    if (isRestored) {
      return {
        title: "Conexion restaurada",
        description: "",
        icon: <CheckCircle2 className="h-4 w-4" />,
        tone: "bg-[#12B76A] text-white border-[#12B76A]",
      };
    }

    return null;
  }, [isOffline, isReconnecting, isRestored]);

  useEffect(() => {
    setDismissed(false);
  }, [status]);

  if (!content || dismissed) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[120] flex justify-center px-4">
      <div
        className={`pointer-events-auto flex w-full max-w-[420px] items-center gap-3 rounded-[22px] border px-4 py-3.5 shadow-2xl transition-all duration-300 ease-out animate-in fade-in slide-in-from-bottom-2 ${content.tone}`}
      >
        <div className="min-w-0 flex flex-1 items-center gap-2.5">
          <div className="shrink-0 opacity-95">{content.icon}</div>
          <p className="text-[14px] font-semibold leading-4">{content.title}</p>
        </div>
        <button
          type="button"
          aria-label="Cerrar aviso"
          onClick={() => setDismissed(true)}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-black/10 text-white/85 transition-colors hover:bg-black/20"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
