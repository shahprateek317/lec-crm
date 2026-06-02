// Tests for the TOTP backup code library.
//
// Uses an in-memory fake store (no real DB) via vi.mock so the tests are
// fast and deterministic.

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── In-memory fake for UserBackupCode ────────────────────────────────────
type FakeCode = { id: string; userId: string; codeHash: string; usedAt: Date | null; createdAt: Date };
let fakeStore: FakeCode[] = [];
let idCounter = 0;

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: async (ops: unknown[]) => {
      for (const op of ops) await op;
    },
    userBackupCode: {
      deleteMany: async ({ where }: { where: { userId: string } }) => {
        fakeStore = fakeStore.filter((r) => r.userId !== where.userId);
        return { count: 0 };
      },
      createMany: async ({ data }: { data: { userId: string; codeHash: string }[] }) => {
        for (const d of data) {
          fakeStore.push({
            id: String(++idCounter),
            userId: d.userId,
            codeHash: d.codeHash,
            usedAt: null,
            createdAt: new Date(),
          });
        }
        return { count: data.length };
      },
      findMany: async ({ where }: { where: { userId: string; usedAt: null } }) => {
        return fakeStore.filter(
          (r) => r.userId === where.userId && r.usedAt === null,
        ).map((r) => ({ id: r.id, codeHash: r.codeHash }));
      },
      update: async ({ where, data }: { where: { id: string }; data: { usedAt: Date } }) => {
        const row = fakeStore.find((r) => r.id === where.id);
        if (row) row.usedAt = data.usedAt;
        return row;
      },
      count: async ({ where }: { where: { userId: string; usedAt?: unknown } }) => {
        let rows = fakeStore.filter((r) => r.userId === where.userId);
        if (where.usedAt !== undefined) {
          rows = rows.filter((r) => r.usedAt !== null);
        }
        return rows.length;
      },
    },
  },
}));

import {
  generateAndStoreBackupCodes,
  consumeBackupCode,
  remainingBackupCodeCount,
  WARN_THRESHOLD,
} from "./backup-codes";

beforeEach(() => {
  fakeStore = [];
  idCounter = 0;
});

describe("generateAndStoreBackupCodes", () => {
  it("generates exactly 10 codes", async () => {
    const codes = await generateAndStoreBackupCodes("user-1");
    expect(codes).toHaveLength(10);
  });

  it("codes are in xxxxx-xxxxx format", async () => {
    const codes = await generateAndStoreBackupCodes("user-1");
    for (const code of codes) {
      expect(code).toMatch(/^[0-9a-f]{5}-[0-9a-f]{5}$/);
    }
  });

  it("all codes are unique", async () => {
    const codes = await generateAndStoreBackupCodes("user-1");
    expect(new Set(codes).size).toBe(10);
  });

  it("replaces existing codes on regeneration", async () => {
    await generateAndStoreBackupCodes("user-1");
    const codes2 = await generateAndStoreBackupCodes("user-1");
    expect(fakeStore).toHaveLength(10); // old batch deleted
    expect(codes2).toHaveLength(10);
  });

  it("stores hashes not plaintext", async () => {
    const codes = await generateAndStoreBackupCodes("user-1");
    for (const stored of fakeStore) {
      for (const code of codes) {
        expect(stored.codeHash).not.toEqual(code);
      }
      // codeHash is a 64-char hex string (SHA-256)
      expect(stored.codeHash).toMatch(/^[0-9a-f]{64}$/);
    }
  });
});

describe("consumeBackupCode", () => {
  it("returns true and marks used for a valid code", async () => {
    const [code] = await generateAndStoreBackupCodes("user-1");
    const ok = await consumeBackupCode("user-1", code);
    expect(ok).toBe(true);
    expect(fakeStore.find((r) => r.usedAt !== null)).toBeDefined();
  });

  it("returns false for an invalid code", async () => {
    await generateAndStoreBackupCodes("user-1");
    const ok = await consumeBackupCode("user-1", "00000-00000");
    expect(ok).toBe(false);
  });

  it("returns false for an already-used code", async () => {
    const [code] = await generateAndStoreBackupCodes("user-1");
    await consumeBackupCode("user-1", code);
    const ok2 = await consumeBackupCode("user-1", code);
    expect(ok2).toBe(false);
  });

  it("is case-insensitive (normalises input)", async () => {
    const [code] = await generateAndStoreBackupCodes("user-1");
    const ok = await consumeBackupCode("user-1", code.toUpperCase());
    expect(ok).toBe(true);
  });

  it("tolerates spaces in submission", async () => {
    const [code] = await generateAndStoreBackupCodes("user-1");
    const ok = await consumeBackupCode("user-1", code.replace("-", " "));
    expect(ok).toBe(true);
  });
});

describe("remainingBackupCodeCount", () => {
  it("returns null when no codes exist", async () => {
    expect(await remainingBackupCodeCount("no-user")).toBeNull();
  });

  it("returns 10 after generation", async () => {
    const [code] = await generateAndStoreBackupCodes("user-1");
    expect(await remainingBackupCodeCount("user-1")).toBe(10);
    await consumeBackupCode("user-1", code);
    expect(await remainingBackupCodeCount("user-1")).toBe(9);
  });

  it("WARN_THRESHOLD is 2", () => {
    expect(WARN_THRESHOLD).toBe(2);
  });
});
