import { defineConfig } from "vitest/config";
import type { ProxyOptions } from "vite";
import react from "@vitejs/plugin-react";

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const bmkgProxy: Record<string, ProxyOptions> = {
  "/bmkg-geo": {
    target: "https://cuaca.bmkg.go.id",
    changeOrigin: true,
    secure: true,
    rewrite: (path) => path.replace(/^\/bmkg-geo/, ""),
    headers: {
      Origin: "https://cuaca.bmkg.go.id",
      Referer: "https://cuaca.bmkg.go.id/",
      "Sec-Fetch-Site": "same-origin",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Dest": "empty",
      "User-Agent": BROWSER_UA,
    },
  },
  "/bmkg-api": {
    target: "https://api.bmkg.go.id",
    changeOrigin: true,
    secure: true,
    rewrite: (path) => path.replace(/^\/bmkg-api/, ""),
    headers: {
      Referer: "https://cuaca.bmkg.go.id/",
      "User-Agent": BROWSER_UA,
    },
  },
};

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: bmkgProxy,
  },
  preview: {
    proxy: bmkgProxy,
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    css: true,
  },
});
