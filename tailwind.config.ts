import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Warm, pigment-forward spice palette
        cardamom: "#F2E7D5", // cream background
        cardamomdark: "#E8D9BE",
        paper: "#FFFCF6",
        terracotta: "#C1502E",
        paprika: "#8F3119",
        turmericgold: "#E8A33D",
        turmericdark: "#C27F1F",
        cumin: "#3C2A1E", // ink/text
        soft: "#7A6A58", // muted warm grey
        line: "#DECBAE", // fine borders
        clove: "#241711", // darkest text
        ok: "#3E7A4E",
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
