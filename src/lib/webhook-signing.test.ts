// Webhook signature verification tests.
// HMAC-SHA256 (Meta's X-Hub-Signature-256 scheme) — must be constant-time
// to avoid timing attacks, fail-closed when the secret is missing in prod,
// and tolerant of the "sha256=" prefix Meta uses.

import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import { verifyWhatsAppSignature } from "./webhook-signing";

const SECRET = "test_app_secret_abc123";
const BODY = JSON.stringify({ entry: [{ id: "123", changes: [{ value: { messages: [{ from: "919876543210", id: "m1", timestamp: "1700000000", type: "text", text: { body: "hi" } }] } }] }] });

function sign(body: string, secret: string): string {
  const h = crypto.createHmac("sha256", secret).update(body, "utf8").digest("hex");
  return `sha256=${h}`;
}

describe("verifyWhatsAppSignature", () => {
  it("accepts a correctly-signed body", () => {
    expect(verifyWhatsAppSignature(BODY, sign(BODY, SECRET), SECRET)).toBe(true);
  });

  it("rejects a body with a tampered character", () => {
    const tampered = BODY.replace("hi", "ha");
    expect(verifyWhatsAppSignature(tampered, sign(BODY, SECRET), SECRET)).toBe(false);
  });

  it("rejects an outright wrong signature", () => {
    expect(verifyWhatsAppSignature(BODY, "sha256=" + "0".repeat(64), SECRET)).toBe(false);
  });

  it("rejects when the signature header is missing", () => {
    expect(verifyWhatsAppSignature(BODY, null, SECRET)).toBe(false);
    expect(verifyWhatsAppSignature(BODY, "", SECRET)).toBe(false);
  });

  it("rejects when the signature header is malformed (no sha256= prefix)", () => {
    const h = crypto.createHmac("sha256", SECRET).update(BODY, "utf8").digest("hex");
    expect(verifyWhatsAppSignature(BODY, h, SECRET)).toBe(false); // missing prefix
  });

  it("rejects when the signature header has wrong algorithm prefix", () => {
    expect(verifyWhatsAppSignature(BODY, "sha1=abc", SECRET)).toBe(false);
  });

  it("fails closed when the app secret is missing or empty (prevents bypass)", () => {
    expect(verifyWhatsAppSignature(BODY, sign(BODY, SECRET), undefined)).toBe(false);
    expect(verifyWhatsAppSignature(BODY, sign(BODY, SECRET), "")).toBe(false);
  });

  it("rejects when secret matches but body bytes differ (whitespace matters)", () => {
    const padded = BODY + " "; // extra space — Meta signs raw bytes
    expect(verifyWhatsAppSignature(padded, sign(BODY, SECRET), SECRET)).toBe(false);
  });

  it("accepts an empty body when signed correctly", () => {
    expect(verifyWhatsAppSignature("", sign("", SECRET), SECRET)).toBe(true);
  });

  it("rejects a signature signed with a different secret", () => {
    expect(verifyWhatsAppSignature(BODY, sign(BODY, "different_secret"), SECRET)).toBe(false);
  });

  it("rejects short signature hex (would crash naïve compare)", () => {
    expect(verifyWhatsAppSignature(BODY, "sha256=abc", SECRET)).toBe(false);
  });

  it("rejects non-hex signature characters", () => {
    expect(verifyWhatsAppSignature(BODY, "sha256=" + "z".repeat(64), SECRET)).toBe(false);
  });
});
