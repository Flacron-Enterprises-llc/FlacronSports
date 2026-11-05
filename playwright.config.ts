import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
  testDir: "./e2e",
  timeout: 45_000,
  retries: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "https://flacronsport.com",
    trace: "off",
  },
  projects: [
    { name: "chrome", use: { ...devices["Desktop Chrome"] } },
    { name: "safari", use: { ...devices["Desktop Safari"] } },
    { name: "android-chrome", use: { ...devices["Pixel 7"] } },
    { name: "ios-safari", use: { ...devices["iPhone 14"] } },
  ],
})
