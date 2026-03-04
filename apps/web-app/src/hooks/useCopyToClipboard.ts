import { useState, useCallback } from "react";
import { sileo } from "sileo";

const DEFAULT_RESET_MS = 1500;

/**
 * Copy text to clipboard and track which key was last copied (for UI feedback).
 * Optionally shows a success toast.
 */
export function useCopyToClipboard(options?: {
  resetMs?: number;
  showNotification?: boolean;
}) {
  const { resetMs = DEFAULT_RESET_MS, showNotification = false } =
    options ?? {};
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copy = useCallback(
    (key: string, value: string) => {
      void navigator.clipboard.writeText(value).then(() => {
        setCopiedKey(key);
        if (showNotification) {
          sileo.success({ title: "Copied to clipboard" });
        }
        if (resetMs > 0) {
          setTimeout(() => setCopiedKey(null), resetMs);
        }
      });
    },
    [resetMs, showNotification]
  );

  return { copy, copiedKey } as const;
}
