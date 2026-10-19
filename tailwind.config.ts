import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Modern clean white quick-commerce palette with vibrant spice accents
        cardamom: "#FFFFFF", // Pure clean white background
        cardamomdark: "#F8FAFC", // Crisp subtle light gray section background
        paper: "#FFFFFF", // Pure white card surfaces
        terracotta: "#B3261E", // Vibrant spice chili red
        paprika: "#8C1C17", // Chili red hover
        turmericgold: "#D97706", // Rich warm amber gold
        turmericdark: "#B45309", // Amber hover / focus ring
        cumin: "#0F172A", // Deep slate ink/headings
        soft: "#475569", // Crisp muted slate description text
        line: "#E2E8F0", // Modern crisp borders
        clove: "#020617", // Darkest slate text
        ok: "#15803D", // Fresh herb green
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 3px 0 rgba(0, 0, 0, 0.07), 0 1px 2px -1px rgba(0, 0, 0, 0.05)",
        lift: "0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04)",
      },
    },
  },
  plugins: [],
};

export default config;
