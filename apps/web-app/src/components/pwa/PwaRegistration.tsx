"use client";

import { useEffect } from "react";

export function PwaRegistration() {
  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches;
    document.body.dataset.standalone = standalone ? "true" : "false";

    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      process.env.NODE_ENV !== "production"
    ) {
      return;
    }

    void navigator.serviceWorker.register("/sw.js");
  }, []);

  return null;
}
