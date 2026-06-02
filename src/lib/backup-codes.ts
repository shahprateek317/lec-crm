// TOTP backup code helpers.
//
// Backup codes are single-use 10-character codes (format: xxxxx-xxxxx) that
// let an admin sign in when they've lost access to their authenticator app.
// They are generated at TOTP enrollment, displayed ONCE, and never stored in
// plaintext — only their SHA-256 hashes live in UserBackupCode.
//
// Usage pattern:
//   At enrollment: const codes = await generateAndStoreBackupCodes(userId)
//                  display `codes` to the user once, then discard
//   At sign-in:    const ok = await consumeBackupCode(userId, submitted)

import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";

const BACKUP_CODE_COUNT = 10;
const WARN_THRESHOLD = 2; // show warning when ≤ this many codes remain

/** Generate a single backup code in "xxxxx-xxxxx" format (cryptographically random). */
function generateCode(): string {
  const bytes = crypto.randomBytes(5);
  const hex = bytes.toString("hex"); // 10 hex chars
  return `${hex.slice(0, 5)}-${hex.slice(5)}`;
}

/** SHA-256 hash of a normalised code (lowercase, no spaces). */
function hashCode(raw: string): string {
  const normalised = raw.toLowerCase().replace(/[\s-]/g, "");
  return crypto.createHash("sha256").update(normalised).digest("hex");
}

/**
 * Generate BACKUP_CODE_COUNT backup codes, store their hashes, and return
 * the plaintext codes for one-time display. Any previously generated
 * (unused) backup codes for the user are deleted first.
 */
export async function generateAndStoreBackupCodes(userId: string): Promise<string[]> {
  const codes = Array.from({ length: BACKUP_CODE_COUNT }, () => generateCode());

  // Replace all existing codes atomically.
  await prisma.$transaction([
    prisma.userBackupCode.deleteMany({ where: { userId } }),
    prisma.userBackupCode.createMany({
      data: codes.map((code) => ({
        userId,
        codeHash: hashCode(code),
      })),
    }),
  ]);

  return codes;
}

/**
 * Attempt to consume a backup code for the given user. Returns true on
 * success (marks the code usedAt), false if the code is not found or
 * already used. Constant-time comparison across all unused codes to
 * prevent timing-oracle enumeration.
 */
export async function consumeBackupCode(
  userId: string,
  submitted: string,
): Promise<boolean> {
  const submittedHash = hashCode(submitted);

  const unused = await prisma.userBackupCode.findMany({
    where: { userId, usedAt: null },
    select: { id: true, codeHash: true },
  });

  // Compare all hashes (constant-time via fixed-length SHA-256 buffers)
  // so the loop timing doesn't leak how many codes exist or their values.
  let matchId: string | null = null;
  for (const row of unused) {
    const rowBuf = Buffer.from(row.codeHash, "hex");
    const subBuf = Buffer.from(submittedHash, "hex");
    if (rowBuf.length === subBuf.length && crypto.timingSafeEqual(rowBuf, subBuf)) {
      matchId = row.id;
      // Don't break — continue comparing to keep timing uniform.
    }
  }

  if (!matchId) return false;

  await prisma.userBackupCode.update({
    where: { id: matchId },
    data: { usedAt: new Date() },
  });
  return true;
}

/**
 * Count how many backup codes the user has left (unused). Returns null if
 * the user has no backup codes at all (not enrolled or codes never generated).
 */
export async function remainingBackupCodeCount(userId: string): Promise<number | null> {
  const total = await prisma.userBackupCode.count({ where: { userId } });
  if (total === 0) return null;
  const used = await prisma.userBackupCode.count({ where: { userId, usedAt: { not: null } } });
  return total - used;
}

export { WARN_THRESHOLD };
