-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'COORDINATOR', 'COUNSELLOR', 'HEALER');

-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('FACEBOOK', 'INSTAGRAM', 'WHATSAPP', 'WALK_IN', 'REFERRAL', 'MANUAL', 'OTHER');

-- CreateEnum
CREATE TYPE "PipelineStage" AS ENUM ('NEW', 'CONTACTED', 'COUNSELING_SCHEDULED', 'COUNSELING_DONE', 'VISIT_SCHEDULED', 'VISIT_DONE', 'HEALING_ACTIVE', 'CONVERTED', 'ON_HOLD', 'LOST');

-- CreateEnum
CREATE TYPE "Chakra" AS ENUM ('CROWN', 'FOREHEAD', 'AJNA', 'THROAT', 'HEART', 'SOLAR_PLEXUS_FRONT', 'SOLAR_PLEXUS_BACK', 'NAVEL', 'MENG_MEIN', 'SPLEEN_FRONT', 'SPLEEN_BACK', 'SEX', 'BASIC');

-- CreateEnum
CREATE TYPE "HealingMode" AS ENUM ('IN_PERSON', 'DISTANT');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'REFUNDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('RAZORPAY', 'MANUAL');

-- CreateEnum
CREATE TYPE "FollowUpStatus" AS ENUM ('PENDING', 'INTERESTED', 'DELAYED', 'NOT_RESPONDING', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FollowUpReason" AS ENUM ('MISSED_COUNSELING', 'MISSED_VISIT', 'POST_VISIT', 'PAYMENT_REMINDER', 'LOW_CREDITS', 'COURSE_CONVERSION', 'CUSTOM');

-- CreateEnum
CREATE TYPE "WhatsAppDirection" AS ENUM ('OUTBOUND', 'INBOUND');

-- CreateEnum
CREATE TYPE "WhatsAppStatus" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED');

-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('PENDING_PAYMENT', 'ENROLLED', 'IN_PROGRESS', 'COMPLETED', 'DROPPED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "age" INTEGER,
    "area" TEXT,
    "issue" TEXT,
    "issueRefined" TEXT,
    "issueDuration" TEXT,
    "severity" INTEGER,
    "source" "LeadSource" NOT NULL DEFAULT 'MANUAL',
    "stage" "PipelineStage" NOT NULL DEFAULT 'NEW',
    "assignedToId" TEXT,
    "notes" TEXT,
    "lostReason" TEXT,
    "convertedAt" TIMESTAMP(3),
    "lastContactedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StageTransition" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "fromStage" "PipelineStage",
    "toStage" "PipelineStage" NOT NULL,
    "byUserId" TEXT,
    "note" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StageTransition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CounselingSession" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "counsellorId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "doneAt" TIMESTAMP(3),
    "issueRefined" TEXT,
    "severity" INTEGER,
    "keyNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CounselingSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Visit" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "assignedHealerId" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "visitedAt" TIMESTAMP(3),
    "initialFeedback" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Visit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HealingSession" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "healerId" TEXT NOT NULL,
    "mode" "HealingMode" NOT NULL DEFAULT 'IN_PERSON',
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "chakras" "Chakra"[],
    "process" TEXT,
    "durationMinutes" INTEGER,
    "remarks" TEXT,
    "creditUsed" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HealingSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditPackage" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "credits" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditPackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "packageId" TEXT,
    "amount" INTEGER NOT NULL,
    "creditsGranted" INTEGER NOT NULL DEFAULT 0,
    "provider" "PaymentProvider" NOT NULL DEFAULT 'RAZORPAY',
    "providerPaymentLinkId" TEXT,
    "providerPaymentLinkUrl" TEXT,
    "providerPaymentId" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditLedgerEntry" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "healingSessionId" TEXT,
    "paymentId" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DistantHealingGroup" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "whatsappGroupName" TEXT,
    "whatsappGroupLink" TEXT,
    "photoUrl" TEXT,
    "problemAreas" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DistantHealingGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HealerUpdate" (
    "id" TEXT NOT NULL,
    "distantGroupId" TEXT NOT NULL,
    "healerId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "chakras" "Chakra"[],
    "process" TEXT,
    "durationMinutes" INTEGER,
    "remarks" TEXT,
    "postedToWhatsAppAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HealerUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientFeedback" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "healingSessionId" TEXT,
    "content" TEXT NOT NULL,
    "rating" INTEGER,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FollowUp" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "assignedToId" TEXT,
    "reason" "FollowUpReason" NOT NULL,
    "status" "FollowUpStatus" NOT NULL DEFAULT 'PENDING',
    "dueAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FollowUp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "bodyTemplate" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppMessage" (
    "id" TEXT NOT NULL,
    "clientId" TEXT,
    "templateId" TEXT,
    "phone" TEXT NOT NULL,
    "direction" "WhatsAppDirection" NOT NULL DEFAULT 'OUTBOUND',
    "body" TEXT NOT NULL,
    "status" "WhatsAppStatus" NOT NULL DEFAULT 'QUEUED',
    "providerMessageId" TEXT,
    "errorMessage" TEXT,
    "scheduledFor" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "fee" INTEGER NOT NULL,
    "durationHours" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoursePrerequisite" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "prerequisiteId" TEXT NOT NULL,

    CONSTRAINT "CoursePrerequisite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Enrollment" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "feePaid" INTEGER NOT NULL DEFAULT 0,
    "creditsAdjustedAmount" INTEGER NOT NULL DEFAULT 0,
    "paymentId" TEXT,
    "enrolledAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Enrollment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "Client_phone_key" ON "Client"("phone");

-- CreateIndex
CREATE INDEX "Client_stage_idx" ON "Client"("stage");

-- CreateIndex
CREATE INDEX "Client_assignedToId_idx" ON "Client"("assignedToId");

-- CreateIndex
CREATE INDEX "Client_createdAt_idx" ON "Client"("createdAt");

-- CreateIndex
CREATE INDEX "StageTransition_clientId_at_idx" ON "StageTransition"("clientId", "at");

-- CreateIndex
CREATE INDEX "CounselingSession_clientId_idx" ON "CounselingSession"("clientId");

-- CreateIndex
CREATE INDEX "CounselingSession_scheduledAt_idx" ON "CounselingSession"("scheduledAt");

-- CreateIndex
CREATE INDEX "Visit_clientId_idx" ON "Visit"("clientId");

-- CreateIndex
CREATE INDEX "Visit_scheduledAt_idx" ON "Visit"("scheduledAt");

-- CreateIndex
CREATE INDEX "HealingSession_clientId_date_idx" ON "HealingSession"("clientId", "date");

-- CreateIndex
CREATE INDEX "HealingSession_healerId_date_idx" ON "HealingSession"("healerId", "date");

-- CreateIndex
CREATE INDEX "Payment_clientId_idx" ON "Payment"("clientId");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "CreditLedgerEntry_healingSessionId_key" ON "CreditLedgerEntry"("healingSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "CreditLedgerEntry_paymentId_key" ON "CreditLedgerEntry"("paymentId");

-- CreateIndex
CREATE INDEX "CreditLedgerEntry_clientId_at_idx" ON "CreditLedgerEntry"("clientId", "at");

-- CreateIndex
CREATE UNIQUE INDEX "DistantHealingGroup_clientId_key" ON "DistantHealingGroup"("clientId");

-- CreateIndex
CREATE INDEX "HealerUpdate_distantGroupId_date_idx" ON "HealerUpdate"("distantGroupId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "ClientFeedback_healingSessionId_key" ON "ClientFeedback"("healingSessionId");

-- CreateIndex
CREATE INDEX "ClientFeedback_clientId_submittedAt_idx" ON "ClientFeedback"("clientId", "submittedAt");

-- CreateIndex
CREATE INDEX "FollowUp_status_dueAt_idx" ON "FollowUp"("status", "dueAt");

-- CreateIndex
CREATE INDEX "FollowUp_clientId_idx" ON "FollowUp"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppTemplate_name_key" ON "WhatsAppTemplate"("name");

-- CreateIndex
CREATE INDEX "WhatsAppMessage_clientId_createdAt_idx" ON "WhatsAppMessage"("clientId", "createdAt");

-- CreateIndex
CREATE INDEX "WhatsAppMessage_status_idx" ON "WhatsAppMessage"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Course_name_key" ON "Course"("name");

-- CreateIndex
CREATE UNIQUE INDEX "CoursePrerequisite_courseId_prerequisiteId_key" ON "CoursePrerequisite"("courseId", "prerequisiteId");

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_paymentId_key" ON "Enrollment"("paymentId");

-- CreateIndex
CREATE INDEX "Enrollment_status_idx" ON "Enrollment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_clientId_courseId_key" ON "Enrollment"("clientId", "courseId");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StageTransition" ADD CONSTRAINT "StageTransition_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StageTransition" ADD CONSTRAINT "StageTransition_byUserId_fkey" FOREIGN KEY ("byUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CounselingSession" ADD CONSTRAINT "CounselingSession_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CounselingSession" ADD CONSTRAINT "CounselingSession_counsellorId_fkey" FOREIGN KEY ("counsellorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_assignedHealerId_fkey" FOREIGN KEY ("assignedHealerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealingSession" ADD CONSTRAINT "HealingSession_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealingSession" ADD CONSTRAINT "HealingSession_healerId_fkey" FOREIGN KEY ("healerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "CreditPackage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditLedgerEntry" ADD CONSTRAINT "CreditLedgerEntry_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditLedgerEntry" ADD CONSTRAINT "CreditLedgerEntry_healingSessionId_fkey" FOREIGN KEY ("healingSessionId") REFERENCES "HealingSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditLedgerEntry" ADD CONSTRAINT "CreditLedgerEntry_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DistantHealingGroup" ADD CONSTRAINT "DistantHealingGroup_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealerUpdate" ADD CONSTRAINT "HealerUpdate_distantGroupId_fkey" FOREIGN KEY ("distantGroupId") REFERENCES "DistantHealingGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealerUpdate" ADD CONSTRAINT "HealerUpdate_healerId_fkey" FOREIGN KEY ("healerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientFeedback" ADD CONSTRAINT "ClientFeedback_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientFeedback" ADD CONSTRAINT "ClientFeedback_healingSessionId_fkey" FOREIGN KEY ("healingSessionId") REFERENCES "HealingSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppMessage" ADD CONSTRAINT "WhatsAppMessage_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppMessage" ADD CONSTRAINT "WhatsAppMessage_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "WhatsAppTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoursePrerequisite" ADD CONSTRAINT "CoursePrerequisite_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoursePrerequisite" ADD CONSTRAINT "CoursePrerequisite_prerequisiteId_fkey" FOREIGN KEY ("prerequisiteId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
