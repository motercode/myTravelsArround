import { defineConfig } from "@playwright/test";

// Mismo puerto que `npm run dev`; si el servidor ya está abierto, se reutiliza.
// `localhost` y no `127.0.0.1`: Next.js 16 bloquea en dev los recursos pedidos desde otro origen
// (allowedDevOrigins) y la página no llega a hidratarse.
const BASE_URL = "http://localhost:3030";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  use: { baseURL: BASE_URL, headless: true, trace: "on-first-retry" },
  webServer: {
    command: "npm run dev",
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
