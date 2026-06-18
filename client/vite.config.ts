import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// In dev, proxy API/webhook/health calls to the Express server on :8080.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      // Cache the app shell for offline launch. Never cache the API, webhook,
      // or health endpoints — those must always hit the network (and carry auth).
      workbox: {
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api/, /^\/webhooks/, /^\/health/],
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
      },
      includeAssets: ["icon-192.png", "icon-512.png"],
      manifest: {
        name: "Manumation Snapshot",
        short_name: "Manumation",
        description: "It helps you remember people.",
        theme_color: "#1c1a17",
        background_color: "#f7f5f0",
        display: "standalone",
        start_url: "/",
        scope: "/",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:8080",
      "/webhooks": "http://localhost:8080",
      "/health": "http://localhost:8080",
    },
  },
  build: {
    outDir: "dist",
  },
});
