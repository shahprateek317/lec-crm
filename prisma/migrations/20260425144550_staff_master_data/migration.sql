-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY');

-- CreateEnum
CREATE TYPE "PHLevel" AS ENUM ('BPH', 'APH', 'PSYCHOTHERAPY', 'CRYSTAL_HEALING', 'ARHATIC_PREP', 'ACPH', 'CPH', 'KRIYASHAKTI', 'TWIN_HEART_TRAINER', 'OTHER');

-- CreateEnum
CREATE TYPE "DayOfWeek" AS ENUM ('MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN');

-- CreateEnum
CREATE TYPE "TimeBand" AS ENUM ('EARLY_MORNING', 'MORNING', 'AFTERNOON', 'EVENING', 'NIGHT');

-- CreateEnum
CREATE TYPE "PranicColor" AS ENUM ('WHITE', 'GREEN', 'ORANGE', 'YELLOW', 'BLUE', 'VIOLET', 'RED', 'ELECTRIC_VIOLET', 'GOLD');

-- CreateEnum
CREATE TYPE "MaritalStatus" AS ENUM ('SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED', 'SEPARATED', 'PREFER_NOT_TO_SAY');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Role" ADD VALUE 'SUPER_ADMIN';
ALTER TYPE "Role" ADD VALUE 'SENIOR_COUNSELLOR';
ALTER TYPE "Role" ADD VALUE 'SENIOR_HEALER';
ALTER TYPE "Role" ADD VALUE 'ACCOUNTS';
ALTER TYPE "Role" ADD VALUE 'MARKETING_MANAGER';
ALTER TYPE "Role" ADD VALUE 'VIEWER';

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "gender" "Gender",
ADD COLUMN     "leadScore" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "maritalStatus" "MaritalStatus",
ADD COLUMN     "occupation" TEXT,
ADD COLUMN     "referredBy" TEXT,
ADD COLUMN     "secondaryConcerns" TEXT[],
ADD COLUMN     "takingMedicalTreatment" BOOLEAN;

-- AlterTable
ALTER TABLE "HealingSession" ADD COLUMN     "clientResponse" TEXT,
ADD COLUMN     "colorsUsed" "PranicColor"[],
ADD COLUMN     "followUpNeeded" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "nextSessionRecommendedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "address" TEXT,
ADD COLUMN     "areaCity" TEXT,
ADD COLUMN     "dob" TIMESTAMP(3),
ADD COLUMN     "emergencyContact" TEXT,
ADD COLUMN     "employeeCode" TEXT,
ADD COLUMN     "gender" "Gender",
ADD COLUMN     "joiningDate" TIMESTAMP(3),
ADD COLUMN     "lastLoginAt" TIMESTAMP(3),
ADD COLUMN     "profilePhotoUrl" TEXT,
ADD COLUMN     "remarks" TEXT,
ADD COLUMN     "whatsappPhone" TEXT;

-- CreateTable
CREATE TABLE "HealerProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "experienceYears" INTEGER,
    "phLevels" "PHLevel"[],
    "languages" TEXT[],
    "certificationUrl" TEXT,
    "acceptsInPerson" BOOLEAN NOT NULL DEFAULT true,
    "acceptsDistant" BOOLEAN NOT NULL DEFAULT true,
    "preferredTimeBands" "TimeBand"[],
    "availableDays" "DayOfWeek"[],
    "maxHealingsPerDay" INTEGER,
    "daysPriorNoticeRequired" INTEGER NOT NULL DEFAULT 0,
    "emergencySameDay" BOOLEAN NOT NULL DEFAULT false,
    "canVisitCentre" BOOLEAN NOT NULL DEFAULT true,
    "homeVisitPossible" BOOLEAN NOT NULL DEFAULT false,
    "acceptsDemoFree" BOOLEAN NOT NULL DEFAULT true,
    "acceptsPaidOnly" BOOLEAN NOT NULL DEFAULT false,
    "acceptsNewLeads" BOOLEAN NOT NULL DEFAULT true,
    "prefersRepeatClients" BOOLEAN NOT NULL DEFAULT false,
    "focusAreas" TEXT[],
    "perSessionCharge" INTEGER,
    "demoSessionCharge" INTEGER,
    "revenueSharePercent" INTEGER,
    "paymentMode" TEXT,
    "acceptsUrgentCases" BOOLEAN NOT NULL DEFAULT false,
    "acceptsChildCases" BOOLEAN NOT NULL DEFAULT true,
    "acceptsElderlyCases" BOOLEAN NOT NULL DEFAULT true,
    "weekendAvailable" BOOLEAN NOT NULL DEFAULT false,
    "groupHealingAvailable" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HealerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CounsellorProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "experienceYears" INTEGER,
    "languages" TEXT[],
    "specializations" TEXT[],
    "acceptsOnline" BOOLEAN NOT NULL DEFAULT true,
    "acceptsOffline" BOOLEAN NOT NULL DEFAULT true,
    "preferredTimeBands" "TimeBand"[],
    "maxSessionsPerDay" INTEGER,
    "canCloseLead" BOOLEAN NOT NULL DEFAULT false,
    "canAssignVisit" BOOLEAN NOT NULL DEFAULT true,
    "canOffer99Program" BOOLEAN NOT NULL DEFAULT true,
    "incentiveEligible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CounsellorProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoordinatorProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "handlesLeads" BOOLEAN NOT NULL DEFAULT true,
    "handlesFollowUp" BOOLEAN NOT NULL DEFAULT true,
    "handlesWhatsAppGroups" BOOLEAN NOT NULL DEFAULT true,
    "handlesPaymentFollowUp" BOOLEAN NOT NULL DEFAULT true,
    "handlesScheduling" BOOLEAN NOT NULL DEFAULT true,
    "maxCallsPerDay" INTEGER,
    "shiftTiming" TEXT,
    "languages" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoordinatorProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false,
    "fullCrmAccess" BOOLEAN NOT NULL DEFAULT true,
    "userCreationRights" BOOLEAN NOT NULL DEFAULT true,
    "reportAccess" BOOLEAN NOT NULL DEFAULT true,
    "financeAccess" BOOLEAN NOT NULL DEFAULT true,
    "dashboardAccess" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HealerProfile_userId_key" ON "HealerProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CounsellorProfile_userId_key" ON "CounsellorProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CoordinatorProfile_userId_key" ON "CoordinatorProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AdminProfile_userId_key" ON "AdminProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "User_employeeCode_key" ON "User"("employeeCode");

-- AddForeignKey
ALTER TABLE "HealerProfile" ADD CONSTRAINT "HealerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CounsellorProfile" ADD CONSTRAINT "CounsellorProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoordinatorProfile" ADD CONSTRAINT "CoordinatorProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminProfile" ADD CONSTRAINT "AdminProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

