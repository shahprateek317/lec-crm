// Client-safe shared constants for the upload policy.
//
// `src/lib/uploads.ts` imports the AWS SDK and Prisma — too heavy to ship
// to the browser bundle. Client components import limits from here so the
// server-side allowlist and client-side validation stay in lockstep.
//
// If you edit the rules, edit this file and `src/lib/uploads.ts` together.
// The server is the authoritative gatekeeper; client checks are UX-only.

import type { DocumentKind } from "@prisma/client";

export const DOCUMENT_LIMITS: Record<DocumentKind, {
  maxBytes: number;
  allowedContentTypes: readonly string[];
}> = {
  HEALER_CERT: {
    maxBytes: 5 * 1024 * 1024,
    allowedContentTypes: ["application/pdf", "image/png", "image/jpeg"],
  },
  MEDICAL_REPORT: {
    maxBytes: 10 * 1024 * 1024,
    allowedContentTypes: ["application/pdf", "image/png", "image/jpeg"],
  },
  PROFILE_PHOTO: {
    maxBytes: 2 * 1024 * 1024,
    allowedContentTypes: ["image/png", "image/jpeg", "image/webp"],
  },
  OTHER: {
    maxBytes: 10 * 1024 * 1024,
    allowedContentTypes: ["application/pdf", "image/png", "image/jpeg", "text/plain"],
  },
};
