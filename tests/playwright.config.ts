import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // EMERGENCY: Disable parallel to prevent tab proliferation
  forbidOnly: !!process.env.CI,
  retries: 0, // EMERGENCY: Disable retries to prevent multiple runs
  workers: 1, // EMERGENCY: Single worker only
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:15173',
    headless: true,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  workers: 1,

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
  ],

  webServer: [
    {
      command: 'cd backend && python run_e2e_tests.py',
      port: 18000,
      timeout: 120 * 1000,
      reuseExistingServer: false, // Always use fresh isolated DB
    },
    {
      command: 'cd frontend && npm run dev -- --port 15173',
      port: 15173,
      timeout: 120 * 1000,
      reuseExistingServer: true,
    }
  ],
});
