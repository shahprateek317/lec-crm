-- Migration: NotificationPreference
--
-- Per-user opt-out for each NotificationKind. A row only exists when the
-- user has explicitly changed a preference; absence means default (enabled).

CREATE TABLE "NotificationPreference" (
    "id"        TEXT         NOT NULL,
    "userId"    TEXT         NOT NULL,
    "kind"      "NotificationKind" NOT NULL,
    "enabled"   BOOLEAN      NOT NULL DEFAULT true,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "NotificationPreference"
    ADD CONSTRAINT "NotificationPreference_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "NotificationPreference_userId_kind_key"
    ON "NotificationPreference"("userId", "kind");
