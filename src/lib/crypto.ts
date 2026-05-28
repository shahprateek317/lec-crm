// Symmetric encryption helper used for at-rest secrets that the app
// needs to read back later — WhatsApp / Razorpay credentials in
// `settings.ts`, TOTP secrets in `User.totpSecret`.
//
// Algorithm: AES-256-GCM (authenticated). Key is derived by SHA-256
// hashing AUTH_SECRET so this file has no environment dependency
// beyond what NextAuth already requires.
//
// Format: base64( iv(12) || ciphertext || authTag(16) ). The IV is
// random per encrypt() call, so two encryptions of the same plaintext
// produce different ciphertexts — desirable for storage.
//
// IMPORTANT: if AUTH_SECRET rotates, every encrypted value becomes
// unrecoverable. Document this in HANDOVER and treat AUTH_SECRET like
// a primary credential. A future "rotate at rest" job (Phase 3) will
// re-encrypt under a new key before the rotation lands.

import crypto from "node:crypto";
import { env } from "@/lib/env";

function key(): Buffer {
  return crypto.createHash("sha256").update(env.AUTH_SECRET).digest();
}

/** Encrypt a UTF-8 plaintext for at-rest storage. */
export function encryptForStorage(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, enc, tag]).toString("base64");
}

/** Decrypt a value previously encrypted with `encryptForStorage`. */
export function decryptFromStorage(b64: string): string {
  const buf = Buffer.from(b64, "base64");
  if (buf.length < 12 + 16 + 1) {
    throw new Error("Ciphertext too short to be valid");
  }
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(buf.length - 16);
  const enc = buf.subarray(12, buf.length - 16);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
  return dec.toString("utf8");
}
