import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

// PWA wrapper. Generates a service worker that precaches static assets and
// runtime-caches navigations + same-origin GETs. Only enabled in production
// so HMR isn't fighting with the SW cache during dev.
const withPWA = withPWAInit({
  dest: "public",
  register: true,
  disable: process.env.NODE_ENV === "development",
  workboxOptions: {
    skipWaiting: true,
    clientsClaim: true,
  },
  cacheOnFrontEndNav: true,
  reloadOnOnline: true,
});

const nextConfig: NextConfig = {
  // Standalone output keeps the production Docker image small (~150 MB).
  output: "standalone",
};

export default withPWA(nextConfig);
