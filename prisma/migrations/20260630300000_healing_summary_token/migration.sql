-- Add summaryToken to HealingSession for the public healing summary page
ALTER TABLE "HealingSession" ADD COLUMN "summaryToken" TEXT;
CREATE UNIQUE INDEX "HealingSession_summaryToken_key" ON "HealingSession"("summaryToken");
