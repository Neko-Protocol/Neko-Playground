"use client";

import { useEffect, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

const emptySubscribe = () => () => {};

interface ModalPortalProps {
  children: React.ReactNode;
  lockScroll?: boolean;
}

export function ModalPortal({ children, lockScroll = true }: ModalPortalProps) {
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  useEffect(() => {
    if (!mounted || !lockScroll) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mounted, lockScroll]);

  if (!mounted || typeof document === "undefined") return null;

  return createPortal(children, document.body);
}
