import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Resolves the "@/..." import alias the same way tsconfig.json does
// ("@/*" -> "./src/*"), so tests import app modules exactly as the app does.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    // Pure-logic suites — no DOM needed.
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
