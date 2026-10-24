import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "tests",
  testMatch: [
    "search.spec.ts",
    "query.spec.ts",
    "delivery.spec.ts",
    "recovery.spec.ts",
    "restore.spec.ts",
  ],
  fullyParallel: true,
  workers: 3,
  timeout: 30000,
  use: {
    baseURL: "http://127.0.0.1:4185/asearch-demo/",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "pnpm preview --base /asearch-demo/ --port 4185 --strictPort",
    url: "http://127.0.0.1:4185/asearch-demo/",
    reuseExistingServer: false,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
    {
      name: "android-profile",
      use: { ...devices["Pixel 7"], defaultBrowserType: "chromium" },
    },
    {
      name: "iphone-profile",
      use: { ...devices["iPhone 13"], defaultBrowserType: "webkit" },
    },
  ],
});
