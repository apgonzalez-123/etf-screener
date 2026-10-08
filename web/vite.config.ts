import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// BASE is set by the Pages workflow to "/<repo>/"; "/" for local dev.
export default defineConfig({
  base: process.env.BASE ?? "/",
  plugins: [react()],
  test: { environment: "node", include: ["src/**/*.test.ts"] },
} as any);
