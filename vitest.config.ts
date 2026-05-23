// Vitest config — unit + integration tests for security-critical paths.
//
// Scope today (Phase 1): pure / near-pure functions where correctness is
// load-bearing — magic-link auth lifecycle, presigned-URL signing, credit
// math, audit-note authorisation. UI component tests are deliberately not
// in scope yet; we lean on Playwright (eventually) for those.
//
// Test files live next to the code under test as `*.test.ts`, OR under
// `tests/` for cross-cutting integration tests that need DB fixtures.

import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    globals: false,
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    setupFiles: ["./tests/setup.ts"],
    // Each test file gets a fresh module graph so module-level singletons
    // (Prisma client mocks, env stubs) don't leak across files.
    isolate: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/lib/**/*.ts"],
      exclude: ["**/*.test.ts", "**/index.ts"],
    },
  },
});
