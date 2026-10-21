import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/dev",
  workers: 1,
  use: { baseURL: "http://127.0.0.1:5186/", browserName: "chromium" },
  webServer: {
    command: "pnpm dev --port 5186 --strictPort",
    url: "http://127.0.0.1:5186/",
    reuseExistingServer: false,
  },
});
