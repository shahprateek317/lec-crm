-- CreateEnum
CREATE TYPE "ScheduleBlockReason" AS ENUM ('EMERGENCY', 'PERSONAL', 'TRAVEL', 'SICK_LEAVE', 'TRAINING', 'OTHER');

-- CreateTable
CREATE TABLE "ScheduleBlock" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "fullDay" BOOLEAN NOT NULL DEFAULT false,
    "reason" "ScheduleBlockReason" NOT NULL DEFAULT 'OTHER',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduleBlock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScheduleBlock_userId_startsAt_idx" ON "ScheduleBlock"("userId", "startsAt");

-- CreateIndex
CREATE INDEX "ScheduleBlock_startsAt_endsAt_idx" ON "ScheduleBlock"("startsAt", "endsAt");

-- AddForeignKey
ALTER TABLE "ScheduleBlock" ADD CONSTRAINT "ScheduleBlock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

