import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Warm, pigment-forward spice palette (chili + curry leaf)
        cardamom: "#FBEFDC", // cream background, brighter/warmer than before
        cardamomdark: "#F2DFBE",
        paper: "#FFFBF8",
        terracotta: "#B3261E", // chili, more saturated/vivid (kept token name for backward-compat styling)
        paprika: "#8C1C17", // chili hover/darker variant
        turmericgold: "#B8860B", // deep mustard/amber gold, shifted from Rakus's brighter turmeric gold (kept token name for backward-compat styling)
        turmericdark: "#846008", // hover/focus ring
        cumin: "#3A2A22", // ink/text
        soft: "#7A6A58", // muted warm grey
        line: "#DECBAE", // fine borders
        clove: "#231512", // darkest text
        ok: "#2F7A4F",
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(36,23,17,0.06), 0 8px 24px -12px rgba(36,23,17,0.20)",
        lift: "0 2px 6px rgba(36,23,17,0.10), 0 18px 40px -18px rgba(36,23,17,0.30)",
      },
    },
  },
  plugins: [],
};

export default config;
