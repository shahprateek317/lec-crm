-- Enums
CREATE TYPE "ActionType" AS ENUM ('BROCHURE_SENT','COUNSELING','CENTER_VISIT_DEMO_HEALING','INTRO_PRANIC_HEALING_GROUP','MEDITATION_GROUP','TELEPHONIC_CALL','PAID_HEALING','COURSE_ENROLLMENT','NOT_INTERESTED');
CREATE TYPE "LeadStatus" AS ENUM ('ACTIVE','DORMANT','NOT_INTERESTED','CONVERTED');
CREATE TYPE "AttendanceStatus" AS ENUM ('REGISTERED','ATTENDED','DID_NOT_ATTEND');
CREATE TYPE "MeditationMemberStatus" AS ENUM ('ACTIVE','INACTIVE','EXITED');

-- Client new fields
ALTER TABLE "Client" ADD COLUMN "leadStatus" "LeadStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "Client" ADD COLUMN "currentAction" "ActionType";
ALTER TABLE "Client" ADD COLUMN "nextAction" "ActionType";
ALTER TABLE "Client" ADD COLUMN "nextActionDate" TIMESTAMP(3);
ALTER TABLE "Client" ADD COLUMN "actionRemarks" TEXT;

-- Pranic Group Session
CREATE TABLE "PranicGroupSession" (
  "id"          TEXT NOT NULL,
  "scheduledAt" TIMESTAMP(3) NOT NULL,
  "notes"       TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PranicGroupSession_pkey" PRIMARY KEY ("id")
);

-- Pranic Group Attendance
CREATE TABLE "PranicGroupAttendance" (
  "id"        TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "clientId"  TEXT NOT NULL,
  "status"    "AttendanceStatus" NOT NULL DEFAULT 'REGISTERED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PranicGroupAttendance_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PranicGroupAttendance_sessionId_clientId_key" ON "PranicGroupAttendance"("sessionId","clientId");
CREATE INDEX "PranicGroupAttendance_clientId_idx" ON "PranicGroupAttendance"("clientId");
ALTER TABLE "PranicGroupAttendance" ADD CONSTRAINT "PranicGroupAttendance_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "PranicGroupSession"("id") ON DELETE CASCADE;
ALTER TABLE "PranicGroupAttendance" ADD CONSTRAINT "PranicGroupAttendance_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE;

-- Meditation Group Membership
CREATE TABLE "MeditationGroupMembership" (
  "id"              TEXT NOT NULL,
  "clientId"        TEXT NOT NULL,
  "joinedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "attendanceCount" INTEGER NOT NULL DEFAULT 0,
  "lastAttendedAt"  TIMESTAMP(3),
  "status"          "MeditationMemberStatus" NOT NULL DEFAULT 'ACTIVE',
  "exitedAt"        TIMESTAMP(3),
  "notes"           TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MeditationGroupMembership_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MeditationGroupMembership_clientId_key" ON "MeditationGroupMembership"("clientId");
CREATE INDEX "MeditationGroupMembership_status_idx" ON "MeditationGroupMembership"("status");
ALTER TABLE "MeditationGroupMembership" ADD CONSTRAINT "MeditationGroupMembership_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE;
