"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISSED_KEY = "neko-install-banner-dismissed";

function isStandalone() {
  if (typeof window === "undefined") return false;

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone ===
      true
  );
}

export function InstallPromptBanner() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(true);
  const [isIos, setIsIos] = useState(false);
  const [isStandaloneMode, setIsStandaloneMode] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    setDismissed(window.localStorage.getItem(DISMISSED_KEY) === "true");
    setIsStandaloneMode(isStandalone());

    const ua = window.navigator.userAgent.toLowerCase();
    setIsIos(/iphone|ipad|ipod/.test(ua));
    setIsReady(true);

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const onInstalled = () => {
      setDeferredPrompt(null);
      setIsStandaloneMode(true);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const visible = useMemo(() => {
    if (!isReady) return false;
    if (isStandaloneMode || dismissed) return false;

    return Boolean(deferredPrompt) || isIos;
  }, [deferredPrompt, dismissed, isIos, isReady, isStandaloneMode]);

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, "true");
    setDismissed(true);
  };

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;

    if (choice.outcome === "accepted") {
      setDeferredPrompt(null);
      setDismissed(true);
      localStorage.setItem(DISMISSED_KEY, "true");
    }
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-x-4 bottom-4 z-[130] lg:hidden">
      <div className="mx-auto flex max-w-[340px] items-center gap-3 rounded-[22px] border border-[#229EDF] bg-[#229EDF] p-3 text-white shadow-2xl">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold leading-4">Instala Neko</p>
          <p className="mt-1 text-[11px] leading-4 text-white/80">
            {isIos
              ? "Usa Compartir > Agregar a pantalla de inicio para tener Neko como app."
              : "Agrega Neko a tu pantalla de inicio para abrirlo como una app nativa."}
          </p>
        </div>
        {deferredPrompt ? (
          <button
            type="button"
            onClick={() => void handleInstall()}
            className="rounded-full bg-[#121212] px-3 py-2 text-[11px] font-semibold text-white"
          >
            Instalar
          </button>
        ) : null}
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Cerrar aviso"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-black/10 text-white/90 transition-colors hover:bg-black/20"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
