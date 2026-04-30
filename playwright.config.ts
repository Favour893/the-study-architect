import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";
import path from "path";

const useEmulator = process.env.TSA_E2E_USE_EMULATOR === "true";

if (useEmulator) {
  dotenv.config({ path: path.resolve(process.cwd(), "tests/e2e/env.emulator") });
}
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const port = Number(process.env.PLAYWRIGHT_PORT ?? "3101");

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`,
    trace: "on-first-retry",
  },
  webServer:
    process.env.PLAYWRIGHT_BASE_URL !== undefined
      ? undefined
      : useEmulator
        ? [
            {
              command: `npx firebase emulators:start --only auth,firestore --project ${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "demo-tsa"}`,
              url: "http://127.0.0.1:4000",
              reuseExistingServer: !process.env.CI,
              timeout: 180_000,
              stdout: "pipe",
              stderr: "pipe",
            },
            {
              command: `cross-env FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST=127.0.0.1 NEXT_PUBLIC_FIRESTORE_EMULATOR_PORT=8080 npm run dev -- --hostname 127.0.0.1 --port ${port}`,
              url: `http://127.0.0.1:${port}`,
              reuseExistingServer: !process.env.CI,
              timeout: 180_000,
            },
          ]
        : {
            command: `npm run dev -- --hostname 127.0.0.1 --port ${port}`,
            url: `http://127.0.0.1:${port}`,
            reuseExistingServer: !process.env.CI,
            timeout: 120_000,
          },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
