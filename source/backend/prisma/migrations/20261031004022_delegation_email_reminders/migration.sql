-- CreateEnum
CREATE TYPE "ApprovalDelegationStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "EmailDeliveryStatus" AS ENUM ('PENDING', 'SENDING', 'SENT', 'FAILED', 'SKIPPED', 'UNKNOWN');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'DELEGATION_RECEIVED';
ALTER TYPE "NotificationType" ADD VALUE 'REQUEST_DEADLINE_REMINDER';

-- AlterTable
ALTER TABLE "ApprovalStep" ADD COLUMN     "delegationId" TEXT;

-- CreateTable
CREATE TABLE "ApprovalDelegation" (
    "id" TEXT NOT NULL,
    "delegatorId" TEXT NOT NULL,
    "delegateId" TEXT NOT NULL,
    "scopeLevel" INTEGER,
    "validFrom" DATE NOT NULL,
    "validTo" DATE NOT NULL,
    "status" "ApprovalDelegationStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdById" TEXT NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "revokedById" TEXT,
    "revokeReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApprovalDelegation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "userId" TEXT NOT NULL,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "NotificationEmailDelivery" (
    "notificationId" TEXT NOT NULL,
    "status" "EmailDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attemptedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "failureCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationEmailDelivery_pkey" PRIMARY KEY ("notificationId")
);

-- CreateTable
CREATE TABLE "ApprovalReminderDispatch" (
    "id" TEXT NOT NULL,
    "changeRequestId" TEXT NOT NULL,
    "submissionRound" INTEGER NOT NULL,
    "approvalLevel" INTEGER NOT NULL,
    "levelEnteredAt" TIMESTAMP(3) NOT NULL,
    "cycleIndex" INTEGER NOT NULL,
    "recipientId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApprovalReminderDispatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ApprovalDelegation_delegateId_status_validFrom_validTo_idx" ON "ApprovalDelegation"("delegateId", "status", "validFrom", "validTo");

-- CreateIndex
CREATE INDEX "ApprovalDelegation_delegatorId_status_idx" ON "ApprovalDelegation"("delegatorId", "status");

-- CreateIndex
CREATE INDEX "ApprovalDelegation_status_validTo_idx" ON "ApprovalDelegation"("status", "validTo");

-- CreateIndex
CREATE INDEX "NotificationEmailDelivery_status_createdAt_idx" ON "NotificationEmailDelivery"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ApprovalReminderDispatch_recipientId_createdAt_idx" ON "ApprovalReminderDispatch"("recipientId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalReminderDispatch_cycle_recipient_key" ON "ApprovalReminderDispatch"("changeRequestId", "submissionRound", "approvalLevel", "levelEnteredAt", "cycleIndex", "recipientId");

-- CreateIndex
CREATE INDEX "ApprovalStep_delegationId_idx" ON "ApprovalStep"("delegationId");

-- AddForeignKey
ALTER TABLE "ApprovalStep" ADD CONSTRAINT "ApprovalStep_delegationId_fkey" FOREIGN KEY ("delegationId") REFERENCES "ApprovalDelegation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalDelegation" ADD CONSTRAINT "ApprovalDelegation_delegatorId_fkey" FOREIGN KEY ("delegatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalDelegation" ADD CONSTRAINT "ApprovalDelegation_delegateId_fkey" FOREIGN KEY ("delegateId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalDelegation" ADD CONSTRAINT "ApprovalDelegation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalDelegation" ADD CONSTRAINT "ApprovalDelegation_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationEmailDelivery" ADD CONSTRAINT "NotificationEmailDelivery_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalReminderDispatch" ADD CONSTRAINT "ApprovalReminderDispatch_changeRequestId_fkey" FOREIGN KEY ("changeRequestId") REFERENCES "ChangeRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalReminderDispatch" ADD CONSTRAINT "ApprovalReminderDispatch_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- F-25 invariants the schema language cannot express.
ALTER TABLE "ApprovalDelegation"
  ADD CONSTRAINT "ApprovalDelegation_different_users" CHECK ("delegatorId" <> "delegateId"),
  ADD CONSTRAINT "ApprovalDelegation_valid_range" CHECK ("validTo" >= "validFrom"),
  ADD CONSTRAINT "ApprovalDelegation_scope_level" CHECK ("scopeLevel" IS NULL OR "scopeLevel" IN (1, 2));
ALTER TABLE "ApprovalReminderDispatch"
  ADD CONSTRAINT "ApprovalReminderDispatch_cycle_nonnegative" CHECK ("cycleIndex" >= 0);
ALTER TABLE "ApprovalStep"
  ADD CONSTRAINT "ApprovalStep_delegation_evidence" CHECK (
    "delegationId" IS NULL OR
    ("performedById" IS NOT NULL AND NOT "isOverride" AND NOT "isSkipped" AND "action" <> 'PENDING')
  );
