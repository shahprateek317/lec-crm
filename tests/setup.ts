// Vitest global setup — minimal env so modules that validate
// process.env at import time (src/lib/env.ts) load cleanly.
// Real integration tests can override these per-suite.

// NODE_ENV is a special read-only property in some Node typings, so use
// Object.assign rather than dotted assignment. Other vars are vanilla.
const E = process.env as Record<string, string | undefined>;
E.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test?schema=public";
E.AUTH_SECRET ??= "test_secret_at_least_sixteen_chars_long_xyz";
E.AUTH_URL ??= "http://localhost:3000";
E.NODE_ENV ??= "test";
E.WHATSAPP_PROVIDER ??= "stub";
E.RAZORPAY_PROVIDER ??= "stub";
E.S3_UPLOADS_BUCKET ??= "test-bucket";
E.AWS_REGION ??= "ap-south-1";
