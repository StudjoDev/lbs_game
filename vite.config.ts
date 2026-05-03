import { defineConfig } from "vite";

export default defineConfig({
  base: process.env.BASE_PATH ?? "/",
  server: {
    port: 5173
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"]
  }
});
