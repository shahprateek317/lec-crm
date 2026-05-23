// Tests for the file-upload library — pure validation logic.
//
// The S3+DB-coupled functions (issueUploadIntent, getDownloadUrl, etc) are
// integration-tested separately. These cover the policy rules: per-kind
// size limits, content-type allowlists, key naming, ownerType validation.

import { describe, it, expect } from "vitest";
import {
  validateUploadInputs,
  documentStorageKey,
  DOCUMENT_LIMITS,
} from "./uploads";

describe("validateUploadInputs", () => {
  it("accepts a valid healer cert PDF", () => {
    const r = validateUploadInputs({
      kind: "HEALER_CERT",
      filename: "basic-pranic.pdf",
      contentType: "application/pdf",
      sizeBytes: 100_000,
    });
    expect(r.ok).toBe(true);
  });

  it("rejects a healer cert with disallowed content type", () => {
    const r = validateUploadInputs({
      kind: "HEALER_CERT",
      filename: "cert.exe",
      contentType: "application/x-msdownload",
      sizeBytes: 100,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/content type/i);
  });

  it("rejects an oversize healer cert", () => {
    const r = validateUploadInputs({
      kind: "HEALER_CERT",
      filename: "cert.pdf",
      contentType: "application/pdf",
      sizeBytes: DOCUMENT_LIMITS.HEALER_CERT.maxBytes + 1,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/too large/i);
  });

  it("rejects zero-byte uploads", () => {
    const r = validateUploadInputs({
      kind: "HEALER_CERT",
      filename: "cert.pdf",
      contentType: "application/pdf",
      sizeBytes: 0,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/empty/i);
  });

  it("rejects suspiciously long filenames", () => {
    const r = validateUploadInputs({
      kind: "HEALER_CERT",
      filename: "a".repeat(300) + ".pdf",
      contentType: "application/pdf",
      sizeBytes: 1000,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/filename/i);
  });

  it("rejects filenames with path-traversal", () => {
    const r = validateUploadInputs({
      kind: "HEALER_CERT",
      filename: "../../etc/passwd.pdf",
      contentType: "application/pdf",
      sizeBytes: 100,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/filename/i);
  });

  it("accepts profile photo only with image content type", () => {
    const ok = validateUploadInputs({
      kind: "PROFILE_PHOTO",
      filename: "me.png",
      contentType: "image/png",
      sizeBytes: 50_000,
    });
    expect(ok.ok).toBe(true);
    const bad = validateUploadInputs({
      kind: "PROFILE_PHOTO",
      filename: "me.pdf",
      contentType: "application/pdf",
      sizeBytes: 50_000,
    });
    expect(bad.ok).toBe(false);
  });

  it("medical report allows larger files than cert", () => {
    expect(DOCUMENT_LIMITS.MEDICAL_REPORT.maxBytes).toBeGreaterThan(
      DOCUMENT_LIMITS.HEALER_CERT.maxBytes,
    );
  });
});

describe("documentStorageKey", () => {
  it("uses healer-certs/<userId>/<docId>/<filename> for HEALER_CERT", () => {
    const k = documentStorageKey({
      kind: "HEALER_CERT",
      ownerType: "USER",
      ownerId: "user_abc",
      documentId: "doc_123",
      filename: "BPH-2020.pdf",
    });
    expect(k).toBe("healer-certs/user_abc/doc_123/BPH-2020.pdf");
  });

  it("uses client-docs/<clientId>/<docId>/<filename> for MEDICAL_REPORT", () => {
    const k = documentStorageKey({
      kind: "MEDICAL_REPORT",
      ownerType: "CLIENT",
      ownerId: "client_xyz",
      documentId: "doc_456",
      filename: "scan.pdf",
    });
    expect(k).toBe("client-docs/client_xyz/doc_456/scan.pdf");
  });

  it("uses profile-photos/<ownerType>/<id>/<docId>/<filename> for PROFILE_PHOTO", () => {
    const k = documentStorageKey({
      kind: "PROFILE_PHOTO",
      ownerType: "USER",
      ownerId: "user_def",
      documentId: "doc_789",
      filename: "avatar.png",
    });
    expect(k).toBe("profile-photos/user/user_def/doc_789/avatar.png");
  });

  it("sanitises filenames — strips path separators and weird chars", () => {
    const k = documentStorageKey({
      kind: "HEALER_CERT",
      ownerType: "USER",
      ownerId: "u",
      documentId: "d",
      // Even though validateUploadInputs catches this, the key gen must
      // sanitise defensively (it might receive a pre-validated name from
      // a future caller path that skips validation).
      filename: "foo/bar..baz.pdf",
    });
    expect(k).not.toContain("/bar");
    expect(k).not.toContain("..");
    expect(k).toMatch(/healer-certs\/u\/d\/foo_bar\.baz\.pdf$/);
  });

  it("client-docs key requires CLIENT ownerType — throws otherwise", () => {
    expect(() => documentStorageKey({
      kind: "MEDICAL_REPORT",
      ownerType: "USER",
      ownerId: "u",
      documentId: "d",
      filename: "x.pdf",
    })).toThrow();
  });

  it("healer-certs key requires USER ownerType — throws otherwise", () => {
    expect(() => documentStorageKey({
      kind: "HEALER_CERT",
      ownerType: "CLIENT",
      ownerId: "c",
      documentId: "d",
      filename: "x.pdf",
    })).toThrow();
  });
});
