// File upload library — S3 presigned URLs + Document model orchestration.
//
// Browsers upload directly to S3 via a presigned PUT URL (no proxy through
// our app server — Next.js standalone runs with 2 GB of RAM on the EC2 box,
// and file-proxying would exhaust it on a single 10 MB medical report).
// Reads happen the same way (presigned GET), with a 15-minute TTL.
//
// Validation runs server-side BEFORE issuing the presigned URL: per-kind
// size and content-type limits, filename safety, owner type matching.
// A bad request never produces a signed URL, so the bucket cannot be
// abused to host arbitrary content even by an authenticated user.
//
// Key naming (also enforced by IAM later if we tighten scoping):
//   healer-certs/<userId>/<documentId>/<filename>
//   client-docs/<clientId>/<documentId>/<filename>
//   profile-photos/<user|client>/<ownerId>/<documentId>/<filename>
//
// See docs/UX_ARCHITECTURE.md §7.

import type { DocumentKind } from "@prisma/client";
import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { audit } from "@/lib/audit";

// ── Per-kind policy ───────────────────────────────────────────────────
export const DOCUMENT_LIMITS: Record<DocumentKind, {
  maxBytes: number;
  allowedContentTypes: ReadonlySet<string>;
}> = {
  HEALER_CERT: {
    maxBytes: 5 * 1024 * 1024, // 5 MB
    allowedContentTypes: new Set([
      "application/pdf",
      "image/png",
      "image/jpeg",
    ]),
  },
  MEDICAL_REPORT: {
    maxBytes: 10 * 1024 * 1024, // 10 MB
    allowedContentTypes: new Set([
      "application/pdf",
      "image/png",
      "image/jpeg",
    ]),
  },
  PROFILE_PHOTO: {
    maxBytes: 2 * 1024 * 1024, // 2 MB
    allowedContentTypes: new Set([
      "image/png",
      "image/jpeg",
      "image/webp",
    ]),
  },
  OTHER: {
    maxBytes: 10 * 1024 * 1024,
    allowedContentTypes: new Set([
      "application/pdf",
      "image/png",
      "image/jpeg",
      "text/plain",
    ]),
  },
};

// ── Validation ────────────────────────────────────────────────────────
export type ValidateInput = {
  kind: DocumentKind;
  filename: string;
  contentType: string;
  sizeBytes: number;
};

export type ValidateResult =
  | { ok: true }
  | { ok: false; error: string };

export function validateUploadInputs(input: ValidateInput): ValidateResult {
  const policy = DOCUMENT_LIMITS[input.kind];
  if (!policy) return { ok: false, error: `Unknown document kind: ${input.kind}` };

  if (input.sizeBytes <= 0) return { ok: false, error: "File is empty" };
  if (input.sizeBytes > policy.maxBytes) {
    return { ok: false, error: `File too large (max ${Math.floor(policy.maxBytes / 1024 / 1024)} MB)` };
  }
  if (!policy.allowedContentTypes.has(input.contentType)) {
    return { ok: false, error: `Disallowed content type: ${input.contentType}` };
  }

  // Filename safety — block path traversal, NUL bytes, control chars,
  // path separators. Length cap at 200 (S3 supports much more but UI
  // truncation is ugly past that).
  const fn = input.filename;
  if (!fn || fn.length > 200) return { ok: false, error: "Invalid filename length" };
  if (fn.includes("/") || fn.includes("\\")) return { ok: false, error: "Invalid filename (no slashes)" };
  if (fn.includes("..")) return { ok: false, error: "Invalid filename (no path traversal)" };
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1f\x7f]/.test(fn)) return { ok: false, error: "Invalid filename (control chars)" };

  return { ok: true };
}

// ── Key generation ────────────────────────────────────────────────────
export type DocumentOwnerType = "USER" | "CLIENT";

export type KeyInput = {
  kind: DocumentKind;
  ownerType: DocumentOwnerType;
  ownerId: string;
  documentId: string;
  filename: string;
};

/** Sanitise a filename for S3 key embedding. Defensive — callers should
 * also have run validateUploadInputs. */
function safeFilename(filename: string): string {
  return filename
    .replace(/\\/g, "_")
    .replace(/\//g, "_")
    .replace(/\.\.+/g, ".")     // collapse repeated dots
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1f\x7f]/g, "_")
    .slice(0, 200);
}

export function documentStorageKey(input: KeyInput): string {
  const fn = safeFilename(input.filename);
  switch (input.kind) {
    case "HEALER_CERT":
      if (input.ownerType !== "USER") {
        throw new Error("HEALER_CERT requires ownerType USER");
      }
      return `healer-certs/${input.ownerId}/${input.documentId}/${fn}`;
    case "MEDICAL_REPORT":
      if (input.ownerType !== "CLIENT") {
        throw new Error("MEDICAL_REPORT requires ownerType CLIENT");
      }
      return `client-docs/${input.ownerId}/${input.documentId}/${fn}`;
    case "PROFILE_PHOTO":
      return `profile-photos/${input.ownerType.toLowerCase()}/${input.ownerId}/${input.documentId}/${fn}`;
    case "OTHER":
      return `other/${input.ownerType.toLowerCase()}/${input.ownerId}/${input.documentId}/${fn}`;
  }
}

// ── S3 client (singleton) ─────────────────────────────────────────────
// EC2 in production picks up credentials from the instance profile
// automatically when AWS_ACCESS_KEY_ID is absent. Local dev passes
// explicit creds via env if uploads are being exercised.
let _s3: S3Client | null = null;
function s3(): S3Client {
  if (_s3) return _s3;
  _s3 = new S3Client({
    region: env.AWS_REGION,
    ...(env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY
      ? {
          credentials: {
            accessKeyId: env.AWS_ACCESS_KEY_ID,
            secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
          },
        }
      : {}),
  });
  return _s3;
}

const PUT_TTL_SECONDS = 5 * 60;   // 5 minutes — enough to start the PUT
const GET_TTL_SECONDS = 15 * 60;  // 15 minutes — inline view window

// ── Public API ────────────────────────────────────────────────────────

export type IssueUploadIntentInput = {
  kind: DocumentKind;
  ownerType: DocumentOwnerType;
  ownerId: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  uploadedById?: string;
};

export type IssueUploadIntentResult =
  | { ok: true; documentId: string; uploadUrl: string; storageKey: string; expiresAt: Date }
  | { ok: false; error: string };

/**
 * Validate, create a Document row (status=PENDING), and return a presigned
 * PUT URL the browser can upload to directly. The Document row is the
 * source of truth for "this file was intended" — orphan rows older than
 * 24h are cleaned by a reconciler (Phase 2).
 */
export async function issueUploadIntent(input: IssueUploadIntentInput): Promise<IssueUploadIntentResult> {
  const v = validateUploadInputs({
    kind: input.kind,
    filename: input.filename,
    contentType: input.contentType,
    sizeBytes: input.sizeBytes,
  });
  if (!v.ok) return { ok: false, error: v.error };

  const doc = await prisma.document.create({
    data: {
      kind: input.kind,
      ownerUserId:   input.ownerType === "USER"   ? input.ownerId : null,
      ownerClientId: input.ownerType === "CLIENT" ? input.ownerId : null,
      storageKey: "_placeholder_", // overwritten below; @unique forces uniqueness
      filename: input.filename,
      contentType: input.contentType,
      sizeBytes: input.sizeBytes,
      status: "PENDING",
      uploadedById: input.uploadedById ?? null,
    },
  });

  // Generate the final key now that we have the doc id and patch the row.
  const storageKey = documentStorageKey({
    kind: input.kind,
    ownerType: input.ownerType,
    ownerId: input.ownerId,
    documentId: doc.id,
    filename: input.filename,
  });
  await prisma.document.update({
    where: { id: doc.id },
    data: { storageKey },
  });

  const cmd = new PutObjectCommand({
    Bucket: env.S3_UPLOADS_BUCKET,
    Key: storageKey,
    ContentType: input.contentType,
    ContentLength: input.sizeBytes,
  });
  const uploadUrl = await getSignedUrl(s3(), cmd, { expiresIn: PUT_TTL_SECONDS });
  const expiresAt = new Date(Date.now() + PUT_TTL_SECONDS * 1000);

  return { ok: true, documentId: doc.id, uploadUrl, storageKey, expiresAt };
}

/**
 * Confirm the browser's PUT completed by checking S3 directly, then mark
 * the Document UPLOADED. Idempotent — repeated calls are no-ops once the
 * row is UPLOADED.
 */
export async function markUploadComplete(documentId: string): Promise<{ ok: boolean; error?: string }> {
  const doc = await prisma.document.findUnique({ where: { id: documentId } });
  if (!doc) return { ok: false, error: "Document not found" };
  if (doc.status === "UPLOADED") return { ok: true };

  try {
    const head = await s3().send(new HeadObjectCommand({
      Bucket: env.S3_UPLOADS_BUCKET,
      Key: doc.storageKey,
    }));
    await prisma.document.update({
      where: { id: documentId },
      data: {
        status: "UPLOADED",
        uploadedAt: new Date(),
        // Trust the actual S3 size in case the client lied about it.
        sizeBytes: typeof head.ContentLength === "number" ? head.ContentLength : doc.sizeBytes,
      },
    });
    return { ok: true };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return { ok: false, error: errorMessage };
  }
}

/**
 * Issue a presigned GET URL valid for 15 minutes. Caller is responsible
 * for permission checks (per-route ownership rules). This helper writes
 * an audit-log entry as a side effect.
 */
export async function getDownloadUrl(documentId: string, opts: { actorId: string; auditAction?: "DOCUMENT_VIEWED" | "DOCUMENT_DOWNLOADED" } = { actorId: "" }): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const doc = await prisma.document.findUnique({ where: { id: documentId } });
  if (!doc) return { ok: false, error: "Not found" };
  if (doc.status !== "UPLOADED") return { ok: false, error: "Upload incomplete" };

  const cmd = new GetObjectCommand({
    Bucket: env.S3_UPLOADS_BUCKET,
    Key: doc.storageKey,
    ResponseContentDisposition: `inline; filename="${doc.filename}"`,
  });
  const url = await getSignedUrl(s3(), cmd, { expiresIn: GET_TTL_SECONDS });

  if (opts.actorId) {
    await audit(opts.auditAction ?? "DOCUMENT_VIEWED", "Document", documentId, {
      actorId: opts.actorId,
      meta: { filename: doc.filename, contentType: doc.contentType },
    });
  }

  return { ok: true, url };
}

/**
 * Soft-delete a Document — removes the S3 object and the row.
 * Versioning is enabled on the bucket so this is recoverable from
 * non-current versions for 365 days.
 */
export async function deleteDocument(documentId: string): Promise<void> {
  const doc = await prisma.document.findUnique({ where: { id: documentId } });
  if (!doc) return;
  await s3().send(new DeleteObjectCommand({
    Bucket: env.S3_UPLOADS_BUCKET,
    Key: doc.storageKey,
  })).catch((err) => console.error("[uploads] S3 delete failed", err));
  await prisma.document.delete({ where: { id: documentId } });
}
