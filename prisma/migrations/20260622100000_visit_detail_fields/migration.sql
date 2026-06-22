ALTER TABLE "Visit" ADD COLUMN "problemsDiscussed" TEXT;
ALTER TABLE "Visit" ADD COLUMN "healingExplained" TEXT;
ALTER TABLE "Visit" ADD COLUMN "demoHealingDone" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Visit" ADD COLUMN "demoHealingNotes" TEXT;
