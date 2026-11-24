import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

/** E2E runs against a production build with an isolated PGlite database (.pglite-e2e). */
export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure" },
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: `rm -rf .pglite-e2e && pnpm build && PGLITE_DIR=.pglite-e2e LEARNER_1_PASSPHRASE=e2e-heslo LEARNER_2_PASSPHRASE=e2e-heslo-2 LEARNER_2_EXAM_DATE=2026-12-10 ADMIN_PASSPHRASE=e2e-admin SESSION_SECRET=e2e-secret-0123456789abcdef npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
});
