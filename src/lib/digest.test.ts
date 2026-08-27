import { describe, it, expect } from "vitest";
import { buildDigestText, buildDigestHtml, groupByKind, shouldSendDigest } from "./digest";
import type { NotificationKind } from "@prisma/client";

type DigestNotif = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string | null;
  href: string | null;
  createdAt: Date;
};

const n = (kind: NotificationKind, title: string, body?: string): DigestNotif => ({
  id: Math.random().toString(36),
  kind,
  title,
  body: body ?? null,
  href: "/dashboard",
  createdAt: new Date("2026-06-08T10:00:00Z"),
});

// ── shouldSendDigest ─────────────────────────────────────────────────────────

describe("shouldSendDigest", () => {
  it("returns false for empty notification list", () => {
    expect(shouldSendDigest([])).toBe(false);
  });

  it("returns true when there is at least one notification", () => {
    expect(shouldSendDigest([n("PAYMENT_RECEIVED", "Paid")])).toBe(true);
  });
});

// ── groupByKind ──────────────────────────────────────────────────────────────

describe("groupByKind", () => {
  it("groups notifications by kind", () => {
    const notifs = [
      n("PAYMENT_RECEIVED", "Payment 1"),
      n("PAYMENT_RECEIVED", "Payment 2"),
      n("NEW_HEALING_ASSIGNMENT", "Assigned"),
    ];
    const groups = groupByKind(notifs);
    expect(groups.get("PAYMENT_RECEIVED")).toHaveLength(2);
    expect(groups.get("NEW_HEALING_ASSIGNMENT")).toHaveLength(1);
  });

  it("preserves insertion order (by kind first seen)", () => {
    const notifs = [
      n("NEW_HEALING_ASSIGNMENT", "A"),
      n("PAYMENT_RECEIVED", "B"),
      n("NEW_HEALING_ASSIGNMENT", "C"),
    ];
    const keys = Array.from(groupByKind(notifs).keys());
    expect(keys[0]).toBe("NEW_HEALING_ASSIGNMENT");
    expect(keys[1]).toBe("PAYMENT_RECEIVED");
  });
});

// ── buildDigestText ──────────────────────────────────────────────────────────

describe("buildDigestText", () => {
  it("includes the user name and total count", () => {
    const notifs = [n("PAYMENT_RECEIVED", "Payment confirmed")];
    const text = buildDigestText("Ananya", notifs);
    expect(text).toContain("Ananya");
    expect(text).toContain("1 unread");
  });

  it("lists notification titles", () => {
    const notifs = [
      n("PAYMENT_RECEIVED", "Payment confirmed"),
      n("NEW_HEALING_ASSIGNMENT", "Session assigned"),
    ];
    const text = buildDigestText("Ananya", notifs);
    expect(text).toContain("Payment confirmed");
    expect(text).toContain("Session assigned");
  });

  it("pluralises correctly for multiple notifications", () => {
    const notifs = [n("PAYMENT_RECEIVED", "A"), n("PAYMENT_RECEIVED", "B")];
    const text = buildDigestText("Ananya", notifs);
    expect(text).toContain("2 unread");
  });
});

// ── buildDigestHtml ──────────────────────────────────────────────────────────

describe("buildDigestHtml", () => {
  it("returns valid HTML containing user name", () => {
    const html = buildDigestHtml("Ananya", [n("PAYMENT_RECEIVED", "Paid")], "https://crm.example.com");
    expect(html).toContain("Ananya");
    expect(html).toContain("<!DOCTYPE html");
  });

  it("includes notification titles", () => {
    const html = buildDigestHtml("Ananya", [n("PAYMENT_RECEIVED", "Payment confirmed")], "https://crm.example.com");
    expect(html).toContain("Payment confirmed");
  });

  it("includes CTA link to the app", () => {
    const html = buildDigestHtml("Ananya", [n("PAYMENT_RECEIVED", "Paid")], "https://crm.example.com");
    expect(html).toContain("https://crm.example.com");
  });

  it("escapes HTML in notification titles", () => {
    const html = buildDigestHtml("Ananya", [n("OTHER", "<script>xss</script>")], "https://crm.example.com");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
