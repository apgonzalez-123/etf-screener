import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  use: { baseURL: `http://localhost:4173${process.env.BASE ?? "/"}`, viewport: { width: 1440, height: 900 } },
  webServer: { command: "npx vite preview --port 4173 --strictPort", url: `http://localhost:4173${process.env.BASE ?? "/"}`, reuseExistingServer: true, timeout: 60_000 },
});
