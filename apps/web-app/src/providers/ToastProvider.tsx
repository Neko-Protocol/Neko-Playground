"use client";

import { ReactNode } from "react";
import { Toaster } from "sileo";
import { TOAST_CONFIG } from "@/lib/constants/toast.config";
import "sileo/styles.css";
import "./toast-overrides.css";

export function ToastProvider({ children }: { children: ReactNode }) {
  const { provider, viewport } = TOAST_CONFIG;
  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `:root {
            --toast-viewport-top: ${viewport.top};
            --toast-viewport-left: ${viewport.left};
            --toast-viewport-transform: ${viewport.transform};
            --toast-viewport-z-index: ${viewport.zIndex};
            --toast-viewport-width: ${viewport.width};
            --toast-description-color: ${viewport.descriptionColor};
          }`,
        }}
      />
      {children}
      <Toaster
        position={provider.position}
        theme={provider.theme}
        options={{
          fill: provider.fill,
          styles: {
            title: provider.titleStyle,
            description: provider.descriptionStyle,
          },
        }}
      />
    </>
  );
}
