// Webhook signature verification for Meta WhatsApp Cloud API.
//
// Meta signs every webhook POST body with HMAC-SHA256 over the *raw* request
// body using the App Secret, and sends it as the `X-Hub-Signature-256` header
// in the format `sha256=<hex>`. We verify with constant-time compare to
// avoid timing oracles, and fail closed if the secret is missing — never
// silently accept (an outage on the WhatsApp secret is preferable to letting
// the internet inject phantom inbound messages into the coordinator inbox).
//
// Reference: https://developers.facebook.com/docs/graph-api/webhooks/getting-started#validate-payloads

import crypto from "node:crypto";

const HEX_64 = /^[0-9a-f]{64}$/;

/**
 * Verify a Meta-style `X-Hub-Signature-256` header against the raw request body.
 *
 * @param rawBody  The exact bytes Meta signed. Read via `req.text()` before any JSON parse.
 * @param signatureHeader  Value of the `X-Hub-Signature-256` header.
 *                         Expected format: `sha256=<64 lowercase hex chars>`.
 * @param appSecret  The App Secret from Meta App dashboard (App Settings → Basic).
 * @returns true iff the signature matches and the secret is configured.
 */
export function verifyWhatsAppSignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
  appSecret: string | null | undefined,
): boolean {
  // Fail closed: missing secret means we cannot verify. Never accept by default.
  if (!appSecret) return false;
  if (!signatureHeader) return false;

  // Strip + validate the algorithm prefix.
  if (!signatureHeader.startsWith("sha256=")) return false;
  const provided = signatureHeader.slice("sha256=".length).toLowerCase();
  if (!HEX_64.test(provided)) return false;

  const expected = crypto
    .createHmac("sha256", appSecret)
    .update(rawBody, "utf8")
    .digest("hex");

  // Buffers of equal length — required by timingSafeEqual.
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(provided, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
