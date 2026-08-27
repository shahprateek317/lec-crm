import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NotificationKind } from "@prisma/client";

// ── in-memory fakes ──────────────────────────────────────────────────────────

type PrefRow = { userId: string; kind: NotificationKind; enabled: boolean };
type NotifRow = { recipientId: string; kind: NotificationKind; title: string };

let prefStore: PrefRow[] = [];
let notifStore: NotifRow[] = [];

vi.mock("@/lib/prisma", () => ({
  prisma: {
    notificationPreference: {
      findMany: async ({ where }: { where: { userId: string } }) =>
        prefStore.filter((p) => p.userId === where.userId),
      upsert: async ({ where, create }: { where: { userId_kind: { userId: string; kind: NotificationKind } }; create: PrefRow }) => {
        const idx = prefStore.findIndex(
          (p) => p.userId === where.userId_kind.userId && p.kind === where.userId_kind.kind,
        );
        if (idx >= 0) prefStore[idx] = create;
        else prefStore.push(create);
        return create;
      },
      deleteMany: async ({ where }: { where: { userId: string; kind?: NotificationKind | { in: NotificationKind[] } } }) => {
        prefStore = prefStore.filter((p) => {
          if (p.userId !== where.userId) return true;
          if (!where.kind) return false;
          if (typeof where.kind === "object" && "in" in where.kind) {
            return !(where.kind.in as NotificationKind[]).includes(p.kind);
          }
          return p.kind !== where.kind;
        });
        return { count: 0 };
      },
    },
    notification: {
      create: async (args: { data: NotifRow }) => {
        notifStore.push(args.data);
        return args.data;
      },
    },
  },
}));

// Import AFTER mock is set up
const { notify, isKindEnabled, savePreferences } = await import("./notify");

// ── helpers ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  prefStore = [];
  notifStore = [];
});

// ── isKindEnabled ────────────────────────────────────────────────────────────

describe("isKindEnabled", () => {
  it("returns true when no preference row exists (default on)", async () => {
    expect(await isKindEnabled("u1", "NEW_HEALING_ASSIGNMENT")).toBe(true);
  });

  it("returns false when user has disabled the kind", async () => {
    prefStore.push({ userId: "u1", kind: "NEW_HEALING_ASSIGNMENT", enabled: false });
    expect(await isKindEnabled("u1", "NEW_HEALING_ASSIGNMENT")).toBe(false);
  });

  it("returns true when user has explicitly enabled the kind", async () => {
    prefStore.push({ userId: "u1", kind: "NEW_HEALING_ASSIGNMENT", enabled: true });
    expect(await isKindEnabled("u1", "NEW_HEALING_ASSIGNMENT")).toBe(true);
  });
});

// ── notify respects preferences ──────────────────────────────────────────────

describe("notify", () => {
  it("writes the notification when kind is enabled (default)", async () => {
    await notify({ recipientId: "u1", kind: "PAYMENT_RECEIVED", title: "Paid" });
    expect(notifStore).toHaveLength(1);
  });

  it("suppresses the notification when user has opted out", async () => {
    prefStore.push({ userId: "u1", kind: "PAYMENT_RECEIVED", enabled: false });
    await notify({ recipientId: "u1", kind: "PAYMENT_RECEIVED", title: "Paid" });
    expect(notifStore).toHaveLength(0);
  });

  it("SESSION_REMINDER_1H can be independently suppressed", async () => {
    prefStore.push({ userId: "u1", kind: "SESSION_REMINDER_1H", enabled: false });
    await notify({ recipientId: "u1", kind: "SESSION_REMINDER_1H", title: "Reminder" });
    await notify({ recipientId: "u1", kind: "PAYMENT_RECEIVED", title: "Paid" });
    expect(notifStore).toHaveLength(1);
    expect(notifStore[0].kind).toBe("PAYMENT_RECEIVED");
  });
});

// ── savePreferences ──────────────────────────────────────────────────────────

describe("savePreferences", () => {
  it("persists enabled=false for disabled kinds", async () => {
    await savePreferences("u1", { NEW_HEALING_ASSIGNMENT: false, PAYMENT_RECEIVED: true });
    const disabled = prefStore.filter((p) => !p.enabled);
    expect(disabled).toHaveLength(1);
    expect(disabled[0].kind).toBe("NEW_HEALING_ASSIGNMENT");
  });

  it("removes rows for kinds set back to true (default)", async () => {
    prefStore.push({ userId: "u1", kind: "NEW_HEALING_ASSIGNMENT", enabled: false });
    await savePreferences("u1", { NEW_HEALING_ASSIGNMENT: true });
    expect(prefStore.filter((p) => p.userId === "u1")).toHaveLength(0);
  });
});
