import { defineConfig, devices } from "@playwright/test";
import path from "path";

/**
 * Playwright E2E configuration.
 *
 * Tests run against the Vite dev server with all /api/* requests intercepted
 * via page.route() — no real backend required.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["list"], ["html", { open: "never" }]],

  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  /* Start the Vite dev server before running E2E tests. */
  webServer: {
    command: "npm run dev",
    cwd: path.join(__dirname, "frontend"),
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
