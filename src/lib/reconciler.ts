// DPDP-Act tombstone reconciler — nightly cleanup for soft-deleted clients.
//
// Policy choice (deliberate, see docs/UX_ARCHITECTURE.md §7):
//
//   We DO NOT hard-delete the Client row. HealingSession.client has
//   onDelete: Cascade, so removing the row would wipe the healer's
//   revenue history attached to those sessions. Instead, after the
//   30-day tombstone window we ANONYMIZE the row in place — name,
//   email, occupation, area, notes, and similar identity fields are
//   scrubbed; phone is replaced with a unique placeholder so the
//   @unique constraint still holds. The row stays referenceable as
//   "Deleted Client #<suffix>" forever.
//
//   Associated Documents (medical reports, profile photos) are
//   harder-deleted: the S3 object is removed, the row marked status=FAILED
//   with a scrubbed storageKey so a stale presigned URL can't resurrect
//   the file. This is the DPDP-relevant bit — text fields are merely
//   identifying, but medical reports are sensitive personal data.
//
//   A CLIENT_HARD_DELETED audit-log entry is written by the cron route
//   (not here) because the audit helper depends on the request context.
//
// The function is split into:
//   - computeAnonymizedFields(): pure, no IO, easy to test
//   - reconcileDeletedClients(): Prisma-backed runner the cron invokes
//
// The store interface keeps the runner unit-testable without a real DB.

import { subDays } from "date-fns";

// ── Tombstone window ──────────────────────────────────────────────────
// Clients soft-deleted longer ago than this are eligible for the
// anonymization pass. 30 days gives the data subject time to undo, and
// matches DPDP-2025 §10 guidance for self-service retention.
export const TOMBSTONE_DAYS = 30;

// Length of the random suffix appended to "Deleted #" — long enough to
// avoid collision in name searches but short enough to read.
const SUFFIX_LEN = 8;

/**
 * Pure: given a client id, return the field patches that anonymize the
 * row. Caller writes them via Prisma. Keeps this function testable.
 *
 * Why short id suffix: phone has a @unique constraint, so we can't null
 * it. Using a `deleted-<id>` prefix preserves uniqueness while clearly
 * marking the row.
 */
export function computeAnonymizedFields(clientId: string): AnonymizedFields {
  const suffix = clientId.slice(-SUFFIX_LEN);
  return {
    name: `Deleted Client #${suffix}`,
    phone: `deleted-${clientId}`,
    email: null,
    age: null,
    ageBucket: null,
    gender: null,
    maritalStatus: null,
    occupation: null,
    referredBy: null,
    area: null,
    areaCategory: null,
    issue: null,
    issueCategory: null,
    secondaryConcerns: [],
    issueRefined: null,
    issueDuration: null,
    notes: null,
    lostReason: null,
  };
}

export type AnonymizedFields = {
  name: string;
  phone: string;
  email: null;
  age: null;
  ageBucket: null;
  gender: null;
  maritalStatus: null;
  occupation: null;
  referredBy: null;
  area: null;
  areaCategory: null;
  issue: null;
  issueCategory: null;
  secondaryConcerns: string[];
  issueRefined: null;
  issueDuration: null;
  notes: null;
  lostReason: null;
};

/**
 * Pure: is this client row already anonymized? Cheap check on name +
 * phone shape so the reconciler can skip rows it already processed.
 */
export function isAlreadyAnonymized(client: { name: string; phone: string }): boolean {
  return client.name.startsWith("Deleted Client #") && client.phone.startsWith("deleted-");
}

// ── Store interface (for testability) ──────────────────────────────────

export type CandidateClient = {
  id: string;
  name: string;
  phone: string;
  deletedAt: Date;
};

export type StoredDocument = {
  id: string;
  storageKey: string;
};

export interface ReconcilerStore {
  /** Soft-deleted clients past the tombstone window. */
  findCandidates(deletedBefore: Date, limit: number): Promise<CandidateClient[]>;
  /** Apply anonymization patches to a client row. */
  anonymizeClient(id: string, fields: AnonymizedFields): Promise<void>;
  /** Documents owned by this client (medical reports, profile photos). */
  findClientDocuments(clientId: string): Promise<StoredDocument[]>;
  /** Mark a document row as scrubbed so stale URLs cannot resurrect it. */
  scrubDocument(id: string): Promise<void>;
  /** Best-effort S3 delete. Returns true on success, false on failure. */
  deleteFromStorage(storageKey: string): Promise<boolean>;
}

export type ReconcileResult = {
  candidatesFound: number;
  clientsAnonymized: number;
  documentsScrubbed: number;
  storageDeleteFailures: number;
  perClient: Array<{
    clientId: string;
    documentsScrubbed: number;
    storageFailures: number;
  }>;
};

/**
 * Runner: walk soft-deleted clients past the tombstone window, anonymize
 * each, and scrub their documents. Safe to re-run — already-anonymized
 * rows are skipped via the name-prefix sentinel.
 *
 * Errors on individual clients are logged and the loop continues so one
 * bad row doesn't block the whole nightly run.
 */
export async function reconcileDeletedClients(
  store: ReconcilerStore,
  opts: { now?: Date; limit?: number } = {},
): Promise<ReconcileResult> {
  const now = opts.now ?? new Date();
  const limit = opts.limit ?? 200;
  const cutoff = subDays(now, TOMBSTONE_DAYS);

  const candidates = await store.findCandidates(cutoff, limit);

  const result: ReconcileResult = {
    candidatesFound: candidates.length,
    clientsAnonymized: 0,
    documentsScrubbed: 0,
    storageDeleteFailures: 0,
    perClient: [],
  };

  for (const c of candidates) {
    if (isAlreadyAnonymized(c)) {
      // Skip rows we processed in a previous run. They satisfy the date
      // window forever, so without this check we'd re-anonymize each
      // night — harmless but noisy in the audit log.
      continue;
    }

    let documentsScrubbed = 0;
    let storageFailures = 0;

    try {
      const docs = await store.findClientDocuments(c.id);
      for (const d of docs) {
        const ok = await store.deleteFromStorage(d.storageKey);
        if (!ok) storageFailures += 1;
        // Always scrub the row even if S3 delete failed — the row tells
        // us "this doc is supposed to be gone". A separate sweep can
        // retry orphaned S3 keys.
        await store.scrubDocument(d.id);
        documentsScrubbed += 1;
      }

      await store.anonymizeClient(c.id, computeAnonymizedFields(c.id));

      result.clientsAnonymized += 1;
      result.documentsScrubbed += documentsScrubbed;
      result.storageDeleteFailures += storageFailures;
      result.perClient.push({
        clientId: c.id,
        documentsScrubbed,
        storageFailures,
      });
    } catch (err) {
      console.error("[reconciler] failed for client", c.id, err);
      // Continue with the next candidate — partial progress is better
      // than aborting the whole run.
    }
  }

  return result;
}
