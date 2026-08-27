// Tests for enrolClient()'s credit-ledger concurrency fix.
//
// The bug: the "already enrolled" check and the credit-balance read used
// to happen BEFORE prisma.$transaction, so two concurrent enrolClient()
// calls for the same client could both read the same balance and both
// debit it, driving the CreditLedgerEntry ledger negative.
//
// The fix moves both reads inside the transaction (now run at Serializable
// isolation). This fake prisma mimics that guarantee by serializing
// transaction bodies with a mutex, so the test fails if the reads ever
// move back outside the transaction boundary.

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/providers/payment", () => ({
  getPaymentProvider: () => ({
    createPaymentLink: async ({ reference }: { reference: string }) => ({
      providerLinkId: `stub_${reference}`,
      url: `/dev/pay/${reference}`,
    }),
  }),
}));

vi.mock("@/lib/providers/whatsapp", () => ({
  getWhatsAppProvider: () => ({
    sendTemplate: async () => ({ ok: true }),
  }),
}));

vi.mock("@/lib/pipeline", () => ({
  transitionStage: async () => ({}),
}));

// ── In-memory fake store ─────────────────────────────────────────────
type FakeCourse = { id: string; name: string; fee: number; prerequisites: unknown[] };
type FakeClient = { id: string; name: string; phone: string; email: string | null };
type FakeEnrollment = {
  id: string;
  clientId: string;
  courseId: string;
  status: string;
  feePaid: number;
  creditsAdjustedAmount: number;
  enrolledAt: Date | null;
  paymentId: string | null;
};
type FakeLedgerEntry = { id: string; clientId: string; delta: number; balanceAfter: number; reason: string };
type FakePayment = { id: string; clientId: string; amount: number; status: string };

let courses: FakeCourse[] = [];
let clients: FakeClient[] = [];
let enrollments: FakeEnrollment[] = [];
let ledger: FakeLedgerEntry[] = [];
let payments: FakePayment[] = [];
let idCounter = 0;

// Serializes transaction bodies — stands in for Postgres SERIALIZABLE
// isolation actually preventing two conflicting transactions from both
// reading-then-writing the same rows.
let txMutex: Promise<void> = Promise.resolve();

function makeTxClient() {
  return {
    enrollment: {
      findUnique: async ({ where }: { where: { clientId_courseId: { clientId: string; courseId: string } } }) => {
        const { clientId, courseId } = where.clientId_courseId;
        return enrollments.find((e) => e.clientId === clientId && e.courseId === courseId) ?? null;
      },
      upsert: async ({ where, create, update }: any) => {
        const { clientId, courseId } = where.clientId_courseId;
        const found = enrollments.find((e) => e.clientId === clientId && e.courseId === courseId);
        if (found) {
          Object.assign(found, update);
          return found;
        }
        const row: FakeEnrollment = {
          id: `enr_${++idCounter}`,
          clientId,
          courseId,
          paymentId: null,
          ...create,
        };
        enrollments.push(row);
        return row;
      },
      update: async ({ where, data }: any) => {
        const row = enrollments.find((e) => e.id === where.id);
        if (row) Object.assign(row, data);
        return row;
      },
    },
    creditLedgerEntry: {
      aggregate: async ({ where }: { where: { clientId: string } }) => {
        const sum = ledger.filter((l) => l.clientId === where.clientId).reduce((s, l) => s + l.delta, 0);
        return { _sum: { delta: ledger.some((l) => l.clientId === where.clientId) ? sum : null } };
      },
      create: async ({ data }: { data: Omit<FakeLedgerEntry, "id"> }) => {
        const row: FakeLedgerEntry = { id: `led_${++idCounter}`, ...data };
        ledger.push(row);
        return row;
      },
    },
    payment: {
      create: async ({ data }: { data: { clientId: string; amount: number } }) => {
        const row: FakePayment = { id: `pay_${++idCounter}`, status: "PENDING", ...data };
        payments.push(row);
        return row;
      },
    },
  };
}

vi.mock("@/lib/prisma", () => ({
  prisma: {
    course: {
      findUniqueOrThrow: async ({ where }: { where: { id: string } }) => {
        const c = courses.find((x) => x.id === where.id);
        if (!c) throw new Error("course not found");
        return c;
      },
    },
    client: {
      findUniqueOrThrow: async ({ where }: { where: { id: string } }) => {
        const c = clients.find((x) => x.id === where.id);
        if (!c) throw new Error("client not found");
        return c;
      },
    },
    enrollment: {
      findMany: async ({ where }: { where: { clientId: string } }) =>
        enrollments.filter((e) => e.clientId === where.clientId),
    },
    payment: {
      update: async ({ where, data }: any) => {
        const row = payments.find((p) => p.id === where.id);
        if (row) Object.assign(row, data);
        return { ...row, providerPaymentLinkId: data.providerPaymentLinkId, providerPaymentLinkUrl: data.providerPaymentLinkUrl };
      },
    },
    $transaction: async (callback: (tx: ReturnType<typeof makeTxClient>) => Promise<unknown>) => {
      let release!: () => void;
      const prevMutex = txMutex;
      txMutex = new Promise((resolve) => (release = resolve));
      await prevMutex;
      try {
        return await callback(makeTxClient());
      } finally {
        release();
      }
    },
  },
}));

import { enrolClient } from "./courses";

beforeEach(() => {
  courses = [];
  clients = [];
  enrollments = [];
  ledger = [];
  payments = [];
  idCounter = 0;

  clients.push({ id: "client-1", name: "Asha Patel", phone: "+919800000000", email: null });
  courses.push({ id: "course-a", name: "Level 1", fee: 500, prerequisites: [] });
  courses.push({ id: "course-b", name: "Level 2", fee: 500, prerequisites: [] });
  // One credit (worth ₹500) on the ledger — only enough to fully cover ONE
  // of the two courses below.
  ledger.push({ id: "led_seed", clientId: "client-1", delta: 1, balanceAfter: 1, reason: "seed" });
});

describe("enrolClient concurrency", () => {
  it("never lets two concurrent enrolments double-spend the same credit balance", async () => {
    const [resultA, resultB] = await Promise.all([
      enrolClient({ clientId: "client-1", courseId: "course-a", applyCreditsToFee: true, byUserId: "staff-1" }),
      enrolClient({ clientId: "client-1", courseId: "course-b", applyCreditsToFee: true, byUserId: "staff-1" }),
    ]);

    // Exactly one of the two enrolments should have been able to apply the
    // single available credit; the other must see balance 0.
    const adjustedAmounts = [resultA.enrolment.creditsAdjustedAmount, resultB.enrolment.creditsAdjustedAmount];
    expect(adjustedAmounts.filter((a) => a === 500)).toHaveLength(1);
    expect(adjustedAmounts.filter((a) => a === 0)).toHaveLength(1);

    // The ledger must never go negative, and the running balanceAfter on
    // every entry must be consistent (no double-debit of the same credit).
    const finalBalance = ledger.reduce((s, l) => s + l.delta, 0);
    expect(finalBalance).toBe(0);
    for (const entry of ledger) {
      expect(entry.balanceAfter).toBeGreaterThanOrEqual(0);
    }
  });

  it("rejects a duplicate enrolment in the same course (idempotent re-submit)", async () => {
    await enrolClient({ clientId: "client-1", courseId: "course-a", applyCreditsToFee: false, byUserId: "staff-1" });
    await expect(
      enrolClient({ clientId: "client-1", courseId: "course-a", applyCreditsToFee: false, byUserId: "staff-1" }),
    ).rejects.toThrow("already enrolled");
  });
});
