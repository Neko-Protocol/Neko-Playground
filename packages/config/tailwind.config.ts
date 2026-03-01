import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class", '[data-theme="dark"]'],
  // Note: Tailwind v4 primarily relies on @source in CSS.
  // Keeping content here helps editor tooling and legacy fallbacks.
  content: [
    "./apps/**/src/**/*.{ts,tsx}",
    "./packages/ui/src/**/*.{ts,tsx}",
    "./packages/shared/src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        neko: {
          navy: "#081f5c",
          blue: "#7096d1",
          accent: "#294cab",
          border: "#334eac",
          teal: "#39bfb7",
          "teal-light": "#68f9f2",
          muted: "#bad6eb",
          "navy-hover": "#12328a",
          "accent-hover": "#4A73C4",
          "border-hover": "#3D5AC0",
          cream: "#fff9f0",
          gray: "#f3f4f6",
        },
      },
    },
  },
  plugins: [],
};

export default config;
