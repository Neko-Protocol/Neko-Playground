export const TOAST_CONFIG = {
  /** Toaster component (position, theme, styles) */
  provider: {
    position: "top-center" as const,
    theme: "dark" as const,
    fill: "#1C1C1C",
    titleStyle: "text-white",
    descriptionStyle: "text-white/75",
  },

  viewport: {
    top: "1.5rem",
    left: "55%",
    transform: "translate(-50%, 0)",
    zIndex: 99999,
    width: "480px",
    descriptionColor: "rgb(255, 255, 255)",
  },

  defaultOpts: {
    position: "top-center" as const,
  },
} as const;
