# LEC CRM — UX & System Architecture

This is the north-star design for the Life Energy Centre CRM. It synthesises
Papa's intent from his five requirement docs (`MASTER DATA…`, `Build a complete
web…`, `HEALER ASSIGNMENT…`, `Update the existing Healing…`, `form enquiry…`)
and translates it into a system that honours his outcomes while using modern
UX and engineering practices.

If you're a future contributor (human or AI): read this top-to-bottom once. It
explains *why* the system is shaped the way it is. Implementation details live
in `HANDOVER.md`; this doc is about intent and direction.

---

## 1. Read of Papa's intent

Five documents over ~6 weeks, all hand-written in Microsoft Word with field
tables and Unicode bullets. Distilled:

| Theme | Outcome he wants | Mechanism (negotiable) |
|---|---|---|
| **No lead is lost** | Every enquiry advances or is recovered | Funnel automation, follow-up generation, dormant reactivation |
| **Healing is a tracked craft** | Centre can prove efficacy via chakra before/after | Mandatory chakra form, improvement score, per-session audit trail |
| **Six personas, six panels** | Each role has a tailored surface | Role-aware navigation + RBAC + role-specific dashboards |
| **Personal phones stay private** | Healer phone never reaches client; client phone is masked from healer | Centralised comms via centre's WhatsApp Business number; coordinator routing |
| **Anti-fraud at session boundaries** | Proof a session happened, proof of duration | One-tap WhatsApp confirmation links at start + end (replaces literal OTP) |
| **Referrals as flywheel** | Healed client refers; rewarded with credits | Referral codes + auto-grant on referee's qualifying event |
| **Automation does the boring work** | Staff don't hand-craft routine messages | WhatsApp templates, auto-assign, lead-score, follow-up auto-generation |
| **Conversion to courses is the apex** | Healings funnel into the multi-week paid courses | Course catalogue with prereqs; credits applicable toward course fees |

Things he *doesn't* prescribe (good — we choose well):
- The auth model
- The exact UI patterns
- The notification cadence
- The data architecture
- The tech stack (he never specified)

---

## 2. Three product surfaces

Today everything lives behind `/sign-in` with a username and password. That's
correct for staff and *wrong* for clients — clients will not tolerate a
password for a wellness portal. We split into three surfaces:

```
┌─────────────────────────┬──────────────────────────┬────────────────────────┐
│  PUBLIC                 │  CLIENT PORTAL (/me)     │  STAFF WORKSPACE       │
│  (no auth)              │  (passwordless,          │  (password + 2FA       │
│                         │   WhatsApp magic-link)   │   eventually)          │
├─────────────────────────┼──────────────────────────┼────────────────────────┤
│ /  marketing landing    │ /me  dashboard           │ /dashboard             │
│ /enquiry  lead form     │ /me/sessions             │ /inbox (new)           │
│ /confirm/[token]        │ /me/sessions/[id]        │ /leads + kanban        │
│ /book/[healer?] (later) │ /me/refer                │ /schedule              │
│                         │ /me/messages (Phase 2)   │ /healing               │
│                         │ /me/credits (Phase 2)    │ /my-schedule (healer)  │
│                         │ /me/courses (Phase 2)    │ /me/profile (healer)   │
│                         │ /me/documents (Phase 2)  │ /quality + drill-down  │
│                         │ /me/profile              │ /healers/[id] (new)    │
│                         │                          │ /settings              │
└─────────────────────────┴──────────────────────────┴────────────────────────┘
```

### Why three surfaces, not one

- **Different security postures.** Staff: password + planned 2FA. Clients:
  passwordless via WhatsApp magic-link (their phone *is* their identity in
  this market — every Indian client uses WhatsApp). Public: stateless.
- **Different mental models.** Staff are in this all day; favour density,
  keyboard shortcuts, ⌘K. Clients open it once a week; favour large tap
  targets, big illustrations, gentle guidance.
- **Different ops cadence.** Staff features ship behind feature flags + QA on
  staging. Client features need extra care — a broken client portal hurts
  the brand more than a broken admin screen.

---

## 3. Auth model

### Staff
- Existing: NextAuth Credentials provider, JWT sessions, bcrypt-hashed
  passwords. Edge-safe config in `src/lib/auth.config.ts`.
- Add (Phase 3+): TOTP-based 2FA for ADMIN + SUPER_ADMIN. Required when
  the role can touch financial / user-management endpoints.

### Clients (NEW — Phase 1b)

**Hybrid: OTP (primary) + magic-link (secondary) delivered in one WhatsApp
message.** The Indian wellness demographic (clients aged 30–65) is conditioned
by years of banking, UPI, and Aadhaar flows to *expect* a 6-digit code.
Magic-link is faster but less familiar; some WhatsApp link-preview crawlers
also consume single-use tokens before a human can tap. We ship both in the
same template so the user self-selects:

> *"Life Energy Centre sign-in code: **384721** — or tap to sign in
> instantly: https://crm.lifeenergycentre.in/me/auth/<token>*
> *Valid for 15 minutes. Did not request this? Ignore.*"

**Flow:**
1. Client visits `/me/sign-in`, enters phone number.
2. Server resolves to a `Client` row (or auto-creates a `PROSPECT`-stage one
   with name "Unknown" pending first sign-in completion).
3. Server generates **(a)** a 6-digit OTP, **(b)** a 24-byte base64url
   magic-link token. **Both stored as SHA-256 hashes** — never plaintext —
   with a 15-minute TTL.
4. Sends `client_magic_link` WhatsApp template carrying both.
5. User completes the flow either by:
   - Pasting the OTP into the sign-in form, or
   - Tapping the link, which lands at `/me/auth/<token>`.
6. Server validates (race-safe conditional update, marks consumed atomically),
   mints a 30-day session cookie (`lec_me_session`, HttpOnly, Secure,
   SameSite=Lax). Token-hash compare is constant-time.
7. Re-auth same path. Phone is the stable identifier.

**Fallbacks:**
- Email magic-link if a client has email on file and the WhatsApp template
  fails (Phase 2).
- Coordinator-initiated "send sign-in" button on `/leads/[id]` so a stuck
  client can be helped from inside the CRM (Phase 1b).

**Rate limits (Postgres-backed, no Redis):**
- 3 sign-in requests per phone per rolling hour. After 5/hr, the client row
  is flagged for coordinator review.
- 5 OTP attempts per token. Lock after 5 wrong codes (re-request required).
- 60 webhook calls per second hard cap on `/api/webhook/whatsapp` (single
  IP). 30/sec on `/api/uploads/sign`.

**Schema (tokens stored hashed):**
```prisma
model ClientMagicLink {
  id          String   @id @default(cuid())
  // SHA-256 hex of the link token. Plaintext is never persisted.
  tokenHash   String   @unique
  // SHA-256 hex of the OTP. Plaintext never persisted; bcrypt overkill at 6 digits.
  otpHash     String
  otpAttempts Int      @default(0)
  clientId    String
  client      Client   @relation(fields: [clientId], references: [id], onDelete: Cascade)
  expiresAt   DateTime
  consumedAt  DateTime?
  consumedVia LinkConsumeMethod?    // "OTP" or "LINK" — for analytics
  createdAt   DateTime @default(now())
  requestIp   String?
  @@index([clientId, createdAt])
}
enum LinkConsumeMethod { OTP LINK }

model ClientSession {
  id         String   @id @default(cuid())
  tokenHash  String   @unique  // SHA-256 hex of the session cookie value
  clientId   String
  client     Client   @relation(fields: [clientId], references: [id], onDelete: Cascade)
  expiresAt  DateTime // 30 days from issue, sliding renewal at >50% elapsed
  lastUsedAt DateTime @default(now())
  createdAt  DateTime @default(now())
  userAgent  String?
  revokedAt  DateTime?
  @@index([clientId])
}
```

**Decision: roll our own, not NextAuth.** NextAuth's Email provider could
deliver a magic-link via a custom `sendVerificationRequest` and reuse
`VerificationToken`, but it conflates two distinct user models (`User` =
staff, `Client` = customer) and forces a single auth surface. The savings
(CSRF, session machinery) are real but Next.js 16's `cookies()` API +
hashed-token tables get us there in <300 LOC, with a cleaner mental model.
Costs of being wrong here: low — we can migrate to NextAuth later if the
custom code becomes a maintenance burden.

### Public
- No auth. Server-side rate-limiting on `/api/enquiry` (already shipped).
- `/confirm/[token]` for session check-ins (token is the auth).

---

## 4. Communications architecture

Single transport: WhatsApp Business API (WABA) via the centre's number.
Three logical channels on top:

```
                              ┌─────────────────────┐
                              │  WhatsApp Business  │
                              │   (centre's number) │
                              └──────────┬──────────┘
                                         │
                ┌────────────────────────┼────────────────────────┐
                │                        │                        │
        ┌───────▼──────┐         ┌───────▼──────┐         ┌───────▼──────┐
        │  OUTBOUND    │         │   INBOUND     │         │ NOTIFICATION │
        │  templates   │         │   webhook     │         │ (system →    │
        │  (system →   │         │   (client →   │         │  staff via   │
        │   client)    │         │    system)    │         │  in-app +    │
        └──────────────┘         └───────┬──────┘         │  email)      │
                                         │                 └──────────────┘
                                  ┌──────▼──────┐
                                  │  /inbox     │
                                  │  coordinator│
                                  │  triage     │
                                  └─────────────┘
```

### Outbound (system → client)
Templates currently seeded: 19. Categorised:
- **Lifecycle**: `lead_welcome`, `intro_session_invitation`,
  `demo_healing_offer`, `dormant_reactivation`
- **Scheduling**: `counseling_invite`, `counseling_confirmation`,
  `visit_invite`, `visit_confirmation`, `healer_assignment`
- **Payments**: `payment_link`, `low_credits`, `package_offer`
- **Sessions**: `session_check_in_start`, `session_check_in_end`,
  `feedback_request`
- **Growth**: `course_promotion`, `referral_thank_you`
- **NEW Phase 1**: `client_magic_link` (auth), `inbox_reply` (free-text
  reply within 24h session window)

Quiet hours: 22:00–07:00 IST. Non-urgent templates queue for 07:00 send.
Urgent (check-in links, magic-links, low-credit during active healing)
bypass quiet hours.

### Inbound (client → centre)

Webhook at `/api/webhook/whatsapp` **MUST** verify Meta's
`X-Hub-Signature-256` header (HMAC-SHA256 of the raw body with the App
Secret) before processing — otherwise anyone on the internet can inject
phantom messages into the coordinator inbox. The Razorpay webhook already
does this; the WhatsApp webhook will mirror that pattern in Phase 1a #1.

Inbound messages with a matching `Client.phone` land on that client's
thread. Unmatched phones create an "Unknown sender" pseudo-thread in
`/inbox` with a one-click "Attach to existing client" / "Create new client"
action — never silently dropped.

Phone normalisation: `Client.phone` is canonicalised to E.164 with `+`
prefix (`+919876543210`). Webhook receives digits-only (`919876543210`)
and prepends `+`. Tested in the webhook unit tests.

### Healer routing
**No healer ever messages a client from their personal WhatsApp.** Two
mechanisms:
1. **Phase 1**: Coordinator triages inbound messages, types replies on
   centre's number. Healer input is requested in-app (in-app note pinged
   to healer; healer replies inside CRM; coordinator relays).
2. **Phase 3+ (only if bandwidth demands)**: Exotel masked numbers for
   healer ↔ client direct chat with phone privacy preserved. Documented
   escape hatch; not built until coordinator throughput is the bottleneck.

### Client in-app view (Phase 2)
`/me/messages` renders the same WhatsApp conversation as a thread inside
the portal. Same transport (WhatsApp); different render. Client can
choose where to live.

---

## 5. Coordinator inbox — design

Modelled after Front / Help Scout / Slack:

| Element | Behaviour |
|---|---|
| **Threads** | One per client. Inbound + outbound WhatsApp messages, chronological. |
| **States** | `OPEN` (default), `SNOOZED` (until timestamp), `RESOLVED`. |
| **Assignment** | Optional. "Assign to me" or "Assign to <coordinator>". |
| **Escalation** | `ESCALATED` boolean — surfaces in admin's queue. |
| **Filters** | Quick-tabs: All open / Mine / Waiting on me (unread inbound) / Snoozed / Escalated / Resolved. |
| **Quick reply** | Templates dropdown + free-text (when inside 24h customer-care window). Send-as-template dropdown when outside window. |
| **Window indicator** | Visible label: "Customer-care window: 18h left" or "Window closed — template only". |
| **SLA badge** | "Waiting 3h" / "Waiting 1d" on stale unreplied threads. |
| **Keyboard** | `j/k` to move, `e` to resolve, `s` to snooze, `r` to reply, `?` for help. |

### Why a derived view vs a new table
Inbound + outbound messages already live in `WhatsAppMessage`. We add a
sibling `WhatsAppThread` aggregate (one row per client) holding the
mutable triage state (assignee, status, snoozeUntil, resolvedAt). Messages
remain the immutable log; threads carry the state. Avoids denormalising
message content into a thread table.

```prisma
enum ThreadStatus { OPEN SNOOZED RESOLVED }

model WhatsAppThread {
  id          String       @id @default(cuid())
  clientId    String       @unique
  client      Client       @relation(fields: [clientId], references: [id], onDelete: Cascade)
  status      ThreadStatus @default(OPEN)
  assigneeId  String?
  assignee    User?        @relation(fields: [assigneeId], references: [id])
  snoozeUntil DateTime?
  escalated   Boolean      @default(false)
  resolvedAt  DateTime?
  resolvedById String?
  lastInboundAt  DateTime?
  lastOutboundAt DateTime?
  unreadCount    Int       @default(0)
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt
  @@index([status, assigneeId])
  @@index([status, lastInboundAt])
}
```

The webhook upserts the thread on each inbound (resetting status from
RESOLVED → OPEN if it was resolved, bumping unreadCount). Outbound resets
unreadCount to 0 (we replied; the ball is in their court).

---

## 6. Quality module

### Per-session audit
QC opens a healing session at `/quality/sessions/[id]`. Sees:
- Chakra before/after grid (visual diff: same component as healer entry,
  but read-only and highlighting where state improved)
- Healer's narrative notes
- Client confirmation timestamps + skew flag
- Existing client feedback (if any)
- Previous audit notes (timeline)
- **Audit form**: rating 1–5 (smiley scale), private note, "needs healer
  attention" flag, "escalate to admin" flag.

```prisma
enum QualityRating { POOR FAIR GOOD VERY_GOOD EXCELLENT }

model QualityNote {
  id              String        @id @default(cuid())
  sessionId       String
  session         HealingSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  authorId        String
  author          User          @relation(fields: [authorId], references: [id])
  rating          QualityRating?
  note            String
  needsHealerAttention Boolean  @default(false)
  escalated       Boolean       @default(false)
  acknowledgedByHealerAt DateTime?
  createdAt       DateTime      @default(now())
  @@index([sessionId])
  @@index([authorId, createdAt])
}
```

### Cert verification
Moves from "would live on admin's user-edit screen" to `/quality/healers/[id]`.
QC verifies, admin is backstop. Healer sees the verified badge on `/me/profile`.

### Healer scorecards
`/healers/[id]` (visible to QC + admin; also to the healer themselves as
their `/me/scorecard`) — six metrics:
- Sessions completed (rolling 30d / 90d / lifetime)
- Avg improvement score
- Avg client rating
- Avg QC rating
- Missed-confirmation rate (sessions where client never tapped confirm)
- Pre-session-block adherence (did they actually deliver booked slots?)

Visualised with sparklines + percentile ranking within the team.

---

## 7. File uploads

Two payload types:
- **Healer certificates** (PDF/image, <5 MB)
- **Client medical documents** (PDF/image, <10 MB)

Mechanism: **S3 presigned PUT URLs** — browser uploads directly to S3, no
proxy through the app server. Avoids node-level file-buffering costs and
keeps the EC2 disk pristine.

### Bucket layout
- Bucket: `lec-crm-uploads-397068653443` (new, separate from backups for
  IAM clarity)
- **Versioning: enabled day one.** Accidental client overwrites must be
  recoverable.
- **Cross-region replication to `ap-southeast-1`** (Singapore): same
  customer-data zone, geographic redundancy. Adds ~₹50/month. Worth it
  for medical-doc protection.
- Encryption: SSE-S3 (managed). Upgrade to SSE-KMS later if compliance
  demands.
- Lifecycle: keep all files indefinitely (storage is cheap, evidence
  matters in audit cases). Move to Glacier IR after 365 days.
- Public access: blocked. Reads via presigned GET URLs (15-min TTL).
- CORS: allow `https://crm.lifeenergycentre.in` (and localhost in dev).

### IAM
Reuse `lec-crm-backup-profile` role, add a second inline policy granting
`s3:PutObject`, `s3:GetObject`, `s3:DeleteObject` on this bucket only.

### Path convention
```
healer-certs/<healerUserId>/<certId>/<originalFilename>
client-docs/<clientId>/<docId>/<originalFilename>
```
- Avoids guessable URLs (cert/doc IDs are CUIDs).
- Owner-isolated for IAM expressions if we ever scope further.

### Server flow
```
POST /api/uploads/sign     → returns { uploadUrl, fileKey, fileId }
PUT  <uploadUrl> (browser → S3, multipart for large)
POST /api/uploads/complete → marks Document.uploadStatus = UPLOADED
GET  /api/uploads/[fileId] → server-side presigned GET, 15-min TTL
```

### Schema

Polymorphic ownership via **two nullable FKs + CHECK constraint** —
not a pure-string `ownerId`. Reviewer flagged that loose coupling will
rot; the FK approach lets the DB enforce that exactly one owner is set
and cascade-deletes work cleanly.

```prisma
enum DocumentKind { HEALER_CERT MEDICAL_REPORT PROFILE_PHOTO OTHER }
enum DocumentStatus { PENDING UPLOADED FAILED }

model Document {
  id          String         @id @default(cuid())
  kind        DocumentKind
  // Polymorphic: exactly one of ownerUserId / ownerClientId must be set.
  // Enforced by a CHECK constraint in the migration.
  ownerUserId   String?
  ownerUser     User?        @relation("UserDocuments", fields: [ownerUserId], references: [id], onDelete: Cascade)
  ownerClientId String?
  ownerClient   Client?      @relation("ClientDocuments", fields: [ownerClientId], references: [id], onDelete: Cascade)
  storageKey  String         @unique
  filename    String
  contentType String
  sizeBytes   Int?
  status      DocumentStatus @default(PENDING)
  uploadedById String?       // who initiated the upload (may differ from owner)
  uploadedAt  DateTime?
  createdAt   DateTime       @default(now())
  @@index([ownerUserId])
  @@index([ownerClientId])
}
// Migration adds:
//   ALTER TABLE "Document" ADD CONSTRAINT "Document_one_owner"
//     CHECK ((ownerUserId IS NOT NULL)::int + (ownerClientId IS NOT NULL)::int = 1);
```

`HealerCertificate.storageKey` migrates to `documentId` (foreign key
into Document). When a User or Client is deleted, their owned Documents
cascade — but **S3 objects are not auto-deleted by the cascade**. A
nightly reconciler job (Phase 2) finds Document rows in `DELETED` state
and removes the S3 objects (versioned, so 30-day recovery window).

---

## 8. Notifications

Three channels, one engine:

| Channel | Audience | Mechanism | Use |
|---|---|---|---|
| **WhatsApp** | Clients + healers | WABA templates | Time-critical, externally visible |
| **In-app** | Staff | Bell icon in nav + toast on receive | Real-time work feedback |
| **Email** | Admin only | Resend / SES | Daily digests, billing receipts |

```prisma
enum NotificationKind {
  NEW_INBOUND_MESSAGE
  NEW_HEALING_ASSIGNMENT
  SESSION_REMINDER_1H
  CLIENT_DID_NOT_CONFIRM_START
  QC_FLAGGED_SESSION
  CERT_VERIFIED
  REFERRAL_REWARD_GRANTED
  // ...
}

model Notification {
  id         String           @id @default(cuid())
  recipientId String
  recipient  User             @relation(fields: [recipientId], references: [id], onDelete: Cascade)
  kind       NotificationKind
  title      String
  body       String?
  href       String?
  readAt     DateTime?
  createdAt  DateTime         @default(now())
  @@index([recipientId, readAt])
  @@index([recipientId, createdAt])
}
```

Bell icon shows unread count. Click → `/inbox/notifications`. Settings
per user: which kinds to receive (sensible defaults per role).

---

## 8a. Audit log (NEW — Phase 1a)

QC and admin can read every client's medical document, healing transcript,
and WhatsApp history. For a healthcare-adjacent CRM holding sensitive data
we need *who-looked-at-what* visibility. Cheap insurance against insider
risk; required-ish by DPDP Act 2025 if ever questioned.

```prisma
enum AuditAction {
  DOCUMENT_VIEWED
  DOCUMENT_DOWNLOADED
  CLIENT_DATA_EXPORTED
  WHATSAPP_THREAD_OPENED
  HEALING_SESSION_VIEWED
  USER_CREATED
  USER_DISABLED
  CLIENT_DELETED
  SETTING_CHANGED
}

model AuditLog {
  id         String      @id @default(cuid())
  actorId    String      // who did it (User.id)
  actor      User        @relation(fields: [actorId], references: [id])
  action     AuditAction
  targetType String      // "Client", "Document", "HealingSession", etc.
  targetId   String
  meta       Json?       // additional context (e.g. download user-agent)
  ip         String?
  at         DateTime    @default(now())
  @@index([actorId, at])
  @@index([targetType, targetId, at])
  @@index([action, at])
}
```

A thin helper `audit(action, targetType, targetId, meta?)` called from
every GET that touches client-sensitive data. Append-only; admins can
read at `/settings/audit-log`.

---

## 8b. Account lifecycle (DPDP Act 2025 compliance)

Clients have legal rights to deletion + export. The schema decisions
made today determine how expensive these flows will be later.

### "Sign me out of all devices" — `/me/profile`
Deletes all `ClientSession` rows for the current client. One-tap, no
confirmation needed (it just signs them back in next time).

### "Delete my account" — `/me/profile`
Two-step (confirmation modal + email/WhatsApp confirmation), with a
soft-delete window of 30 days before hard delete.

| Field family | Soft-delete behaviour | Hard-delete behaviour |
|---|---|---|
| Identity (`Client.name`, `phone`, `email`, `area`) | Replaced with hashes (`name = "Deleted user <8charHash>"`, phone retained for stage-transition uniqueness) | Wiped to NULL |
| Healing sessions | Retained — healer revenue / centre records integrity | Anonymised: client FK kept, name stays as the soft-delete hash |
| WhatsApp messages | Retained for audit | Body redacted to `[redacted]`; metadata kept |
| Documents | Retained 30d for accidental-delete recovery, then S3 + row deletion | Hard delete from S3 + Document row |
| Referrals | Counter retained; referee link anonymised | Same |

### "Download my data" — `/me/profile`
Generates a JSON archive of everything tied to this `clientId`:
sessions, payments, credits, referrals, messages (own messages only,
not coordinator's notes), documents (presigned GET URLs valid 24h).
Background job, emails the client when ready. Phase 2 — schema
decisions today make this trivially generatable.

### Schema additions (in Phase 1a migration)
```prisma
model Client {
  // ... existing ...
  deletedAt  DateTime?
  // Hard-delete cron picks up rows where deletedAt < now() - 30 days.
}
```

---

## 9. Referral system — client-facing

Backend already grants credits on referee's qualifying events
(`grantReferralReward`). Phase 1 ships the *client-side* mechanism:

### Flow
1. Client visits `/me/refer`. Sees:
   - Their unique referral code (`LEC-<client-shortid>`)
   - Shareable link (`https://crm.lifeenergycentre.in/enquiry?ref=<code>`)
   - Big WhatsApp share button (deep link with prefilled message)
   - Credits earned to date
   - List of friends they referred + status (Joined / Visited / Purchased)
2. Referred friend lands on `/enquiry?ref=<code>`. Code attribution stored
   in session/cookie; on submit, `Client.referrerClientId` is set
   atomically.
3. Existing backend grants credits on referee's qualifying events.
4. Referrer gets `referral_thank_you` WhatsApp on each grant.

### Sharing UX
- Primary CTA: "Share on WhatsApp" — opens `wa.me/?text=<encoded
  pre-filled message with link>`.
- Secondary: copy link button (Web Clipboard API).
- Tertiary: "Email a friend" deep link (`mailto:`).

### Anti-fraud
- Same phone number cannot self-refer (referrer == referee blocked).
- Annual cap: 10 credits per referrer (existing rule).
- Coordinator review queue for "suspicious referrer" — same referrer >3
  refereees in 24h.

---

## 10. Role-aware landing

Tiny change, big perceived improvement.

```ts
// src/app/(app)/page.tsx
const landingByRole: Record<Role, string> = {
  COORDINATOR: "/inbox",
  COUNSELLOR: "/schedule",
  SENIOR_COUNSELLOR: "/schedule",
  HEALER: "/my-schedule",
  SENIOR_HEALER: "/my-schedule",
  QUALITY_CONTROLLER: "/quality",
  ADMIN: "/dashboard",
  SUPER_ADMIN: "/dashboard",
};
redirect(landingByRole[session.user.role] ?? "/dashboard");
```

Honoured everywhere except sign-in flow's explicit `callbackUrl`.

---

## 11. Design system

Already in place; promote to a named, reusable layer:

- **Tokens** (in `globals.css`): cream `--background`, violet `--primary`,
  teal `--secondary`, gold `--accent`, soft shadows, 8px grid.
- **Typography**: Lora (headings), Inter (body).
- **Primitives**: `availability-grid`, `chip-multi-select`, `tag-input`,
  `date-picker`, `submit-button` (with `useFormStatus` pending state),
  `flash-toaster`, `empty-state`, `command-palette`.
- **NEW Phase 1**: `bottom-sheet` (mobile-first modal replacement),
  `swipe-actions` (left-swipe to snooze/resolve threads), `pill-badge`
  (status indicators), `avatar` (initials fallback, deterministic colour).
- **`/_design`** (Phase 2): living gallery of every primitive — Storybook-
  lite for the next developer to ramp on.

### Mobile rules
- Bottom-sheet > centre-modal on `< 768px`.
- 44×44 minimum tap target.
- Sticky bottom CTA on long forms.
- Pull-to-refresh on `/inbox` and `/my-schedule`.

---

## 12. Roadmap (re-cut after architecture review)

Reviewer rightly flagged the original "9 items in 2 weeks" as fantasy
single-developer math. Honest re-cut into three sub-phases:

### Phase 1a — weeks 1–2 (security + foundation)
1. **Webhook HMAC fix on `/api/webhook/whatsapp`** — production security
   debt. TDD.
2. **AuditLog schema + helper** + read-path instrumentation on
   documents and inbox.
3. **Single migration** for: `Document` (polymorphic FK + CHECK),
   `WhatsAppThread`, `QualityNote`, `Notification`, `AuditLog`,
   `ClientMagicLink`, `ClientSession` (hashed tokens), `Client.deletedAt`,
   `Notification` kinds enum.
4. **S3 bucket** `lec-crm-uploads-…` with versioning + CRR; IAM policy
   update on the EC2 instance role; `src/lib/uploads.ts` (presigned URL
   helpers, TDD).
5. **Healer cert file upload** on `/me/profile` — end-to-end pipeline
   smoke test on the lowest-risk surface.
6. **Role-aware landing redirect** at `/(app)/page.tsx`.

### Phase 1b — weeks 3–4 (clients online)
7. **Client auth library** — OTP + magic-link hybrid, hashed tokens,
   sliding sessions, rate limits. TDD.
8. **Account lifecycle** — sign-out-all, delete-account (soft → hard),
   skeleton of data-export job.
9. **`/me` shell** — sign-in, dashboard (next session, credit balance,
   referrals widget), session-list, feedback form, refer page.
10. **Coordinator `/inbox` MVP** — thread list (filter by Open / Mine /
    Waiting-on-me / Snoozed / Resolved), thread detail with send-template
    + free-text-within-window. Snooze/escalate/keyboard shortcuts
    deferred to 1c.
11. **Quality drill-down** — `/quality/sessions/[id]` audit form;
    cert-verify under `/quality/healers/[id]`.

### Phase 1c — weeks 5–6 (polish + connect surfaces)
12. **Healing form unification** — refactor `/leads/[id]/healing/new` to
    update an in-progress session by `inProgressSessionId`.
13. **`/me/sessions`** list + per-session chakra timeline visual.
14. **`/me/messages`** view-only WhatsApp transcript inside the client
    portal.
15. **Inbox keyboard shortcuts** + snooze + escalate; threads SLA badges.
16. **Notification bell** in staff nav (top-right) — unread count, jump
    to handled item.

### Phase 2 — weeks 7–10
- `/me/credits` (Razorpay buy flow when KYC clears)
- `/me/courses` (browse + enroll; credits-toward-course)
- `/me/documents` (upload medical reports — pipeline already proven in 1a)
- `/me/messages` two-way (in-app composer → WhatsApp transport)
- `/me/earnings` for healers
- 1-hour pre-session WhatsApp cron
- Bulk WhatsApp send for dormant cohorts
- TOTP 2FA for admin roles
- Data export background job

### Phase 3 — weeks 11–14
- Self-service booking (likely embed Cal.com via iframe + webhook sync
  rather than build from scratch — reviewer's suggestion, ~2 months saved)
- `/me reschedule/cancel`
- `/me/events` (online meditation sessions)
- Saved reports
- i18n Bengali/Hindi populated
- Healer ↔ client "message via coordinator" in-app

### Later
- Razorpay live (KYC dependency)
- Exotel masked numbers (only if comms scale demands)
- Multi-tenancy (only if a sister centre joins)
- `/_design` primitive gallery (internal — defer)
- WhatsApp health dashboard widget (template quality tier, daily send count)

---

## 13. Engineering principles

1. **Server-authoritative**. Never trust client-computed values for
   credits, improvement score, ratings, prices.
2. **Idempotent writes**. Use DB unique constraints + P2002 catches.
   Examples already in `grantReferralReward`, `confirmCheckIn`.
3. **Append-only logs**. `StageTransition`, `WhatsAppMessage`,
   `QualityNote`, `CreditLedgerEntry` — never mutate, only insert.
   Truth lives in the log.
4. **TDD for security + correctness paths.** Magic-link consumption,
   credit math, audit authorisation, webhook HMAC verification. UI
   tests are lower priority.
5. **Single source of truth per entity.** Avoid syncing the same data
   into two tables. Prefer derived views (e.g. `WhatsAppThread.unreadCount`
   updated by trigger / hook, not duplicated content).
6. **Server actions over API routes** wherever the consumer is our own
   UI. API routes only for webhooks and the public enquiry endpoint.
7. **Loading + empty + error states are required.** Not optional polish.
   Use `<EmptyState />`, `<SubmitButton />`, `<Suspense />`.
8. **One commit = one shippable unit.** Schema + code + tests in the
   same commit. Reviewers can revert atomically.

---

## 14. Open questions / tradeoffs

| Decision | Status | Tradeoff |
|---|---|---|
| Magic-link vs OTP for clients | **Hybrid (both in one message; user picks)** | OTP for the WhatsApp-trained Indian wellness demographic; link as zero-type for the tech-savvy. A/B observability via `LinkConsumeMethod`. |
| Token storage | **Hashed (SHA-256)** in `tokenHash`, never plaintext | DB dump no longer leaks live credentials |
| Auth: roll our own vs NextAuth Email-provider | **Roll our own** for clients (`Client` ≠ `User`); staff stays on NextAuth | Reviewed; ~300 LOC and clearer mental model |
| WhatsApp webhook HMAC verification | **Phase 1a #1 — blocker** | Was missing in production; cannot ship client portal until fixed |
| WhatsApp inbox: derive vs duplicate | Decided: derive (thread row + immutable messages) | More queries; cleaner state model |
| Unknown-sender inbound messages | Render in pseudo-thread with "attach / create new client" action | Don't silently drop |
| Document FK | **Polymorphic with CHECK constraint** (two nullable FKs, exactly one set) | Pure-string ownerId rots; FK lets cascade work |
| S3 versioning + CRR | **Day-one enable** on uploads bucket | ~₹50/month for medical-doc protection |
| Audit log | **Phase 1a — required** | DPDP Act 2025; insider-risk insurance |
| Account deletion + data export | **Phase 1a schema; UI in 1b/2** | DPDP Act 2025 requirement |
| Cert verification owner | Decided: QC primary, admin backstop | Could centralise on admin only; QC is more aligned with quality |
| Two-way client messaging Phase | Decided: Phase 2 | Phase 1c = view-only; reduces scope while still useful |
| Booking self-service | **Embed Cal.com (Phase 3)** vs build | Reviewer's call: ~2 months saved; LEC owns the UX shell |
| Razorpay live in Phase 1 | Decided: no | KYC dependency; client portal still useful without |
| Exotel masked numbers | Decided: deferred indefinitely | Only build if coordinator throughput proves bottleneck |
| Multi-tenancy | Decided: deferred indefinitely | Premature; LEC is the only tenant |
| TOTP 2FA for admins | Decided: Phase 2 | Useful but not blocking |
| Inbox keyboard shortcuts | **Power-user reward, not primary UX** | Reviewer's call: non-technical coordinators; visible buttons primary |
| `/_design` primitive gallery | **Deferred indefinitely** (was Phase 2) | Internal nice-to-have; not user-facing |

---

## 15. Glossary

- **WABA** — WhatsApp Business API.
- **Customer-care window** — 24-hour rolling window after a client's last
  inbound message during which the centre can send free-text replies
  (outside this window, only approved templates).
- **Magic link** — Single-use, time-limited URL that authenticates the
  recipient on tap. No password.
- **Improvement score** — Sum across chakras of (after-state numeric
  score − before-state numeric score). Server-computed.
- **Quiet hours** — 22:00–07:00 IST. Non-urgent WhatsApp template sends
  defer to 07:00.
- **QC** — Quality Controller. Role responsible for auditing healing
  sessions.

---

*This document is living. When a decision changes, update the relevant
section here before merging the code change. The git history of this file
is the project's design-decision log.*
