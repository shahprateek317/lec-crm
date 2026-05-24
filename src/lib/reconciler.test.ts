// Tests for the DPDP tombstone reconciler.
//
// The pure helpers (computeAnonymizedFields, isAlreadyAnonymized) are
// exercised first. The runner (reconcileDeletedClients) is exercised
// against an in-memory fake store that mirrors the production interface
// — same pattern as client-auth.test.ts.
//
// What's covered:
//   - computeAnonymizedFields: shape, deterministic, suffix preserves
//     phone uniqueness across two different ids
//   - isAlreadyAnonymized: positive + negative cases
//   - reconcileDeletedClients: anonymizes candidates, scrubs documents,
//     skips already-anonymized rows, surfaces S3 failures in the
//     report, continues past a per-client error

import { describe, it, expect, beforeEach } from "vitest";
import { subDays, subHours } from "date-fns";
import {
  computeAnonymizedFields,
  isAlreadyAnonymized,
  reconcileDeletedClients,
  TOMBSTONE_DAYS,
  type AnonymizedFields,
  type CandidateClient,
  type ReconcilerStore,
  type StoredDocument,
} from "./reconciler";

// ── In-memory fake store ─────────────────────────────────────────────

type FakeClientRow = CandidateClient & { anonymized: AnonymizedFields | null };

function makeStore(opts: { failStorageFor?: Set<string>; throwOnAnonymizeFor?: Set<string> } = {}) {
  const clients: FakeClientRow[] = [];
  const docs: Array<StoredDocument & { clientId: string; scrubbed: boolean }> = [];
  const storageDeletes: string[] = [];

  const store: ReconcilerStore = {
    async findCandidates(deletedBefore, limit) {
      return clients
        .filter((c) => c.deletedAt < deletedBefore)
        .slice(0, limit)
        .map((c) => ({ id: c.id, name: c.name, phone: c.phone, deletedAt: c.deletedAt }));
    },
    async anonymizeClient(id, fields) {
      if (opts.throwOnAnonymizeFor?.has(id)) {
        throw new Error("simulated DB failure");
      }
      const row = clients.find((c) => c.id === id);
      if (!row) throw new Error(`fake: client ${id} not found`);
      row.anonymized = fields;
      row.name = fields.name;
      row.phone = fields.phone;
    },
    async findClientDocuments(clientId) {
      return docs
        .filter((d) => d.clientId === clientId)
        .map((d) => ({ id: d.id, storageKey: d.storageKey }));
    },
    async scrubDocument(id) {
      const d = docs.find((x) => x.id === id);
      if (d) d.scrubbed = true;
    },
    async deleteFromStorage(key) {
      storageDeletes.push(key);
      return !opts.failStorageFor?.has(key);
    },
  };

  return {
    store,
    _clients: clients,
    _docs: docs,
    _storageDeletes: storageDeletes,
    addClient(c: FakeClientRow) {
      clients.push(c);
    },
    addDoc(d: StoredDocument & { clientId: string; scrubbed: boolean }) {
      docs.push(d);
    },
  };
}

// ── Pure helpers ─────────────────────────────────────────────────────

describe("computeAnonymizedFields", () => {
  it("produces the expected shape with deterministic suffix", () => {
    const out = computeAnonymizedFields("clxabc1234567890");
    expect(out.name).toBe("Deleted Client #34567890");
    expect(out.phone).toBe("deleted-clxabc1234567890");
    expect(out.email).toBeNull();
    expect(out.gender).toBeNull();
    expect(out.notes).toBeNull();
    expect(out.secondaryConcerns).toEqual([]);
  });

  it("produces unique phone values for distinct ids (preserves @unique)", () => {
    const a = computeAnonymizedFields("client_one");
    const b = computeAnonymizedFields("client_two");
    expect(a.phone).not.toBe(b.phone);
  });

  it("is deterministic — same id => same fields across calls", () => {
    const a = computeAnonymizedFields("clx_same");
    const b = computeAnonymizedFields("clx_same");
    expect(a).toEqual(b);
  });
});

describe("isAlreadyAnonymized", () => {
  it("returns true for an anonymized row", () => {
    expect(isAlreadyAnonymized({ name: "Deleted Client #abc12345", phone: "deleted-clx1" })).toBe(true);
  });

  it("returns false for a fresh row", () => {
    expect(isAlreadyAnonymized({ name: "Asha Patel", phone: "+919812345678" })).toBe(false);
  });

  it("returns false if only one of name/phone matches the sentinel", () => {
    expect(isAlreadyAnonymized({ name: "Deleted Client #abc12345", phone: "+919812345678" })).toBe(false);
    expect(isAlreadyAnonymized({ name: "Asha Patel", phone: "deleted-clx1" })).toBe(false);
  });
});

// ── Runner ───────────────────────────────────────────────────────────

describe("reconcileDeletedClients", () => {
  const now = new Date("2026-05-24T00:00:00Z");
  const olderThanTombstone = subDays(now, TOMBSTONE_DAYS + 1);
  const insideTombstone = subDays(now, TOMBSTONE_DAYS - 1);

  let fake: ReturnType<typeof makeStore>;

  beforeEach(() => {
    fake = makeStore();
  });

  it("anonymizes a fresh candidate and scrubs its documents", async () => {
    fake.addClient({ id: "clx1", name: "Asha", phone: "+9198", deletedAt: olderThanTombstone, anonymized: null });
    fake.addDoc({ id: "doc1", clientId: "clx1", storageKey: "uploads/clx1/report.pdf", scrubbed: false });
    fake.addDoc({ id: "doc2", clientId: "clx1", storageKey: "uploads/clx1/scan.jpg", scrubbed: false });

    const result = await reconcileDeletedClients(fake.store, { now });

    expect(result.candidatesFound).toBe(1);
    expect(result.clientsAnonymized).toBe(1);
    expect(result.documentsScrubbed).toBe(2);
    expect(result.storageDeleteFailures).toBe(0);

    expect(fake._clients[0]?.name.startsWith("Deleted Client #")).toBe(true);
    expect(fake._clients[0]?.phone).toBe("deleted-clx1");
    expect(fake._docs.every((d) => d.scrubbed)).toBe(true);
    expect(fake._storageDeletes.sort()).toEqual(["uploads/clx1/report.pdf", "uploads/clx1/scan.jpg"].sort());
  });

  it("skips clients still inside the tombstone window", async () => {
    fake.addClient({ id: "fresh", name: "B", phone: "+9199", deletedAt: insideTombstone, anonymized: null });

    const result = await reconcileDeletedClients(fake.store, { now });

    expect(result.candidatesFound).toBe(0);
    expect(result.clientsAnonymized).toBe(0);
    expect(fake._clients[0]?.name).toBe("B"); // untouched
  });

  it("skips already-anonymized rows (idempotent across runs)", async () => {
    fake.addClient({
      id: "clx_done",
      name: "Deleted Client #abc12345",
      phone: "deleted-clx_done",
      deletedAt: olderThanTombstone,
      anonymized: null,
    });
    fake.addDoc({ id: "d", clientId: "clx_done", storageKey: "x", scrubbed: false });

    const result = await reconcileDeletedClients(fake.store, { now });

    expect(result.candidatesFound).toBe(1);
    expect(result.clientsAnonymized).toBe(0);
    expect(result.documentsScrubbed).toBe(0);
    expect(fake._storageDeletes).toEqual([]); // no re-deletes
    expect(fake._docs[0]?.scrubbed).toBe(false); // doc untouched
  });

  it("counts S3 failures but still scrubs the document row", async () => {
    fake = makeStore({ failStorageFor: new Set(["uploads/clx2/bad.pdf"]) });
    fake.addClient({ id: "clx2", name: "C", phone: "+91", deletedAt: olderThanTombstone, anonymized: null });
    fake.addDoc({ id: "doc", clientId: "clx2", storageKey: "uploads/clx2/bad.pdf", scrubbed: false });

    const result = await reconcileDeletedClients(fake.store, { now });

    expect(result.clientsAnonymized).toBe(1);
    expect(result.documentsScrubbed).toBe(1);
    expect(result.storageDeleteFailures).toBe(1);
    // Row scrubbed even though S3 delete failed — separate sweep retries S3.
    expect(fake._docs[0]?.scrubbed).toBe(true);
    expect(result.perClient[0]?.storageFailures).toBe(1);
  });

  it("continues past a per-client failure (one bad row doesn't block the rest)", async () => {
    fake = makeStore({ throwOnAnonymizeFor: new Set(["bad"]) });
    fake.addClient({ id: "good", name: "G", phone: "+91", deletedAt: olderThanTombstone, anonymized: null });
    fake.addClient({ id: "bad",  name: "B", phone: "+92", deletedAt: olderThanTombstone, anonymized: null });

    const result = await reconcileDeletedClients(fake.store, { now });

    expect(result.candidatesFound).toBe(2);
    expect(result.clientsAnonymized).toBe(1); // only "good"
    expect(fake._clients.find((c) => c.id === "good")?.anonymized).not.toBeNull();
    expect(fake._clients.find((c) => c.id === "bad")?.anonymized).toBeNull();
  });

  it("respects the limit parameter", async () => {
    for (let i = 0; i < 5; i++) {
      fake.addClient({
        id: `clx${i}`,
        name: `Name${i}`,
        phone: `+9${i}`,
        deletedAt: subDays(now, TOMBSTONE_DAYS + 2 + i),
        anonymized: null,
      });
    }

    const result = await reconcileDeletedClients(fake.store, { now, limit: 2 });

    expect(result.candidatesFound).toBe(2);
    expect(result.clientsAnonymized).toBe(2);
  });

  it("returns zero counts when there are no candidates", async () => {
    fake.addClient({ id: "ok", name: "OK", phone: "+91", deletedAt: subHours(now, 1), anonymized: null });

    const result = await reconcileDeletedClients(fake.store, { now });

    expect(result.candidatesFound).toBe(0);
    expect(result.clientsAnonymized).toBe(0);
    expect(result.documentsScrubbed).toBe(0);
    expect(result.perClient).toEqual([]);
  });
});
