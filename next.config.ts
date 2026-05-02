import type { NextConfig } from "next";

// Standalone output keeps the future Docker image small (~150 MB).
//
// PWA service worker — we tried @ducanh2912/next-pwa but it injects a
// webpack-only plugin which breaks under Next.js 16 / Turbopack. The
// install affordance still works because:
//   • /public/manifest.webmanifest declares the app
//   • src/components/install-prompt.tsx listens for beforeinstallprompt
//     (Chrome / Edge / Android) and shows an iOS Safari hint
// Offline caching can come back via a workbox rebuild on Turbopack when
// the ecosystem catches up — for now, online-only behaves identically.
const nextConfig: NextConfig = {
  output: "standalone",
};

export default nextConfig;
