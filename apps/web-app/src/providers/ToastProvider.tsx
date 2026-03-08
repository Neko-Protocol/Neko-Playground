"use client";

import { ReactNode } from "react";
import { Toaster } from "sileo";
import "sileo/styles.css";
import "./toast-overrides.css";

const TOAST_FILL = "#1C1C1C";
const TOAST_TITLE_STYLE = "text-white";
const TOAST_DESC_STYLE = "text-white/75";

const TOASTER_CONFIG = {
  position: "top-center" as const,
  theme: "dark" as const,
  options: {
    fill: TOAST_FILL,
    styles: {
      title: TOAST_TITLE_STYLE,
      description: TOAST_DESC_STYLE,
    },
  },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <Toaster {...TOASTER_CONFIG} />
    </>
  );
}
