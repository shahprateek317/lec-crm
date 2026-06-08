-- Migration: HealerPayout
--
-- Adds HealerPayout table to track actual cash disbursements to healers.
-- One payout per healer per period ("YYYY-MM"). `gross` is a snapshot of
-- computed earnings at record time — immutable even if fee rates change later.

CREATE TABLE "HealerPayout" (
    "id"          TEXT         NOT NULL,
    "healerId"    TEXT         NOT NULL,
    "createdById" TEXT         NOT NULL,
    "period"      TEXT         NOT NULL,
    "gross"       INTEGER      NOT NULL,
    "deductions"  INTEGER      NOT NULL DEFAULT 0,
    "net"         INTEGER      NOT NULL,
    "paidAt"      TIMESTAMP(3) NOT NULL,
    "paymentRef"  TEXT,
    "notes"       TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HealerPayout_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "HealerPayout"
    ADD CONSTRAINT "HealerPayout_healerId_fkey"
    FOREIGN KEY ("healerId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HealerPayout"
    ADD CONSTRAINT "HealerPayout_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "HealerPayout_healerId_period_key"
    ON "HealerPayout"("healerId", "period");

CREATE INDEX "HealerPayout_healerId_idx" ON "HealerPayout"("healerId");

-- Extend AuditAction enum with payout actions
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PAYOUT_RECORDED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PAYOUT_DELETED';
