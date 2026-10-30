-- CreateEnum
CREATE TYPE "GraduationConclusion" AS ENUM ('ELIGIBLE', 'NOT_ELIGIBLE');

-- CreateEnum
CREATE TYPE "GraduationAuditTrigger" AS ENUM ('STAFF', 'BATCH', 'RESULT_CHANGE');

-- CreateEnum
CREATE TYPE "GraduationBatchStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'COMPLETED_WITH_ERRORS', 'FAILED');

-- CreateEnum
CREATE TYPE "GraduationBatchItemStatus" AS ENUM ('PENDING', 'REVIEWED', 'ERROR');

-- CreateEnum
CREATE TYPE "GraduationReauditStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'COVERED', 'FAILED');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'GRADUATION_CONCLUSION_CHANGED';

-- CreateTable
CREATE TABLE "GraduationAuditContext" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "semesterId" TEXT NOT NULL,
    "lastAuditId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GraduationAuditContext_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GraduationAudit" (
    "id" TEXT NOT NULL,
    "contextId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "programVersionId" TEXT NOT NULL,
    "auditedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "auditedById" TEXT,
    "trigger" "GraduationAuditTrigger" NOT NULL,
    "operationKey" TEXT NOT NULL,
    "conclusion" "GraduationConclusion" NOT NULL,
    "schemaVersion" INTEGER NOT NULL,
    "ruleVersion" TEXT NOT NULL,
    "shortfalls" JSONB NOT NULL,
    "result" JSONB NOT NULL,
    "inputs" JSONB NOT NULL,
    "inputDigest" TEXT NOT NULL,
    "supersedesId" TEXT,

    CONSTRAINT "GraduationAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GraduationBatch" (
    "id" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "requestKey" TEXT NOT NULL,
    "filters" JSONB NOT NULL,
    "previewRevision" TEXT NOT NULL,
    "rosterDigest" TEXT NOT NULL,
    "studentCount" INTEGER NOT NULL,
    "enrollmentCount" INTEGER NOT NULL,
    "status" "GraduationBatchStatus" NOT NULL DEFAULT 'QUEUED',
    "failureCode" TEXT,
    "leaseToken" TEXT,
    "leaseUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "GraduationBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GraduationBatchItem" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "semesterId" TEXT NOT NULL,
    "rosterEnrollmentId" TEXT,
    "rosterIdentity" JSONB NOT NULL,
    "status" "GraduationBatchItemStatus" NOT NULL DEFAULT 'PENDING',
    "auditId" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "GraduationBatchItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GraduationResultChangeReceipt" (
    "changeId" TEXT NOT NULL,
    "targetCount" INTEGER NOT NULL,
    "reason" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GraduationResultChangeReceipt_pkey" PRIMARY KEY ("changeId")
);

-- CreateTable
CREATE TABLE "GraduationReauditTask" (
    "id" TEXT NOT NULL,
    "changeId" TEXT NOT NULL,
    "contextId" TEXT NOT NULL,
    "baselineAuditId" TEXT NOT NULL,
    "completedAuditId" TEXT,
    "status" "GraduationReauditStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "leaseToken" TEXT,
    "leaseUntil" TIMESTAMP(3),
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "GraduationReauditTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GraduationAuditContext_lastAuditId_key" ON "GraduationAuditContext"("lastAuditId");

-- CreateIndex
CREATE INDEX "GraduationAuditContext_studentId_idx" ON "GraduationAuditContext"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "GraduationAuditContext_studentId_programId_semesterId_key" ON "GraduationAuditContext"("studentId", "programId", "semesterId");

-- CreateIndex
CREATE UNIQUE INDEX "GraduationAudit_operationKey_key" ON "GraduationAudit"("operationKey");

-- CreateIndex
CREATE UNIQUE INDEX "GraduationAudit_supersedesId_key" ON "GraduationAudit"("supersedesId");

-- CreateIndex
CREATE INDEX "GraduationAudit_contextId_auditedAt_id_idx" ON "GraduationAudit"("contextId", "auditedAt", "id");

-- CreateIndex
CREATE INDEX "GraduationAudit_enrollmentId_auditedAt_idx" ON "GraduationAudit"("enrollmentId", "auditedAt");

-- CreateIndex
CREATE INDEX "GraduationBatch_status_leaseUntil_createdAt_idx" ON "GraduationBatch"("status", "leaseUntil", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "GraduationBatch_requestedById_requestKey_key" ON "GraduationBatch"("requestedById", "requestKey");

-- CreateIndex
CREATE UNIQUE INDEX "GraduationBatchItem_auditId_key" ON "GraduationBatchItem"("auditId");

-- CreateIndex
CREATE INDEX "GraduationBatchItem_batchId_status_id_idx" ON "GraduationBatchItem"("batchId", "status", "id");

-- CreateIndex
CREATE UNIQUE INDEX "GraduationBatchItem_batchId_studentId_programId_semesterId_key" ON "GraduationBatchItem"("batchId", "studentId", "programId", "semesterId");

-- CreateIndex
CREATE INDEX "GraduationReauditTask_status_leaseUntil_createdAt_idx" ON "GraduationReauditTask"("status", "leaseUntil", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "GraduationReauditTask_changeId_contextId_key" ON "GraduationReauditTask"("changeId", "contextId");

-- AddForeignKey
ALTER TABLE "GraduationAuditContext" ADD CONSTRAINT "GraduationAuditContext_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GraduationAuditContext" ADD CONSTRAINT "GraduationAuditContext_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GraduationAuditContext" ADD CONSTRAINT "GraduationAuditContext_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "Semester"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GraduationAuditContext" ADD CONSTRAINT "GraduationAuditContext_lastAuditId_fkey" FOREIGN KEY ("lastAuditId") REFERENCES "GraduationAudit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GraduationAudit" ADD CONSTRAINT "GraduationAudit_contextId_fkey" FOREIGN KEY ("contextId") REFERENCES "GraduationAuditContext"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GraduationAudit" ADD CONSTRAINT "GraduationAudit_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "ProgramEnrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GraduationAudit" ADD CONSTRAINT "GraduationAudit_programVersionId_fkey" FOREIGN KEY ("programVersionId") REFERENCES "ProgramVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GraduationAudit" ADD CONSTRAINT "GraduationAudit_auditedById_fkey" FOREIGN KEY ("auditedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GraduationAudit" ADD CONSTRAINT "GraduationAudit_supersedesId_fkey" FOREIGN KEY ("supersedesId") REFERENCES "GraduationAudit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GraduationBatch" ADD CONSTRAINT "GraduationBatch_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GraduationBatchItem" ADD CONSTRAINT "GraduationBatchItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "GraduationBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GraduationBatchItem" ADD CONSTRAINT "GraduationBatchItem_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GraduationBatchItem" ADD CONSTRAINT "GraduationBatchItem_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GraduationBatchItem" ADD CONSTRAINT "GraduationBatchItem_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "Semester"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GraduationBatchItem" ADD CONSTRAINT "GraduationBatchItem_rosterEnrollmentId_fkey" FOREIGN KEY ("rosterEnrollmentId") REFERENCES "ProgramEnrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GraduationBatchItem" ADD CONSTRAINT "GraduationBatchItem_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "GraduationAudit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GraduationResultChangeReceipt" ADD CONSTRAINT "GraduationResultChangeReceipt_changeId_fkey" FOREIGN KEY ("changeId") REFERENCES "AcademicResultChange"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GraduationReauditTask" ADD CONSTRAINT "GraduationReauditTask_changeId_fkey" FOREIGN KEY ("changeId") REFERENCES "GraduationResultChangeReceipt"("changeId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GraduationReauditTask" ADD CONSTRAINT "GraduationReauditTask_contextId_fkey" FOREIGN KEY ("contextId") REFERENCES "GraduationAuditContext"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GraduationReauditTask" ADD CONSTRAINT "GraduationReauditTask_baselineAuditId_fkey" FOREIGN KEY ("baselineAuditId") REFERENCES "GraduationAudit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GraduationReauditTask" ADD CONSTRAINT "GraduationReauditTask_completedAuditId_fkey" FOREIGN KEY ("completedAuditId") REFERENCES "GraduationAudit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Invariants Prisma cannot express
ALTER TABLE "GraduationAudit"
  ADD CONSTRAINT "GraduationAudit_schemaVersion_check"
    CHECK ("schemaVersion" > 0),
  ADD CONSTRAINT "GraduationAudit_reviewer_check" CHECK (
    ("trigger" IN ('STAFF', 'BATCH') AND "auditedById" IS NOT NULL)
    OR ("trigger" = 'RESULT_CHANGE' AND "auditedById" IS NULL)
  );

ALTER TABLE "GraduationBatch"
  ADD CONSTRAINT "GraduationBatch_roster_counts_check" CHECK (
    "studentCount" > 0 AND "enrollmentCount" > 0
    AND "studentCount" <= "enrollmentCount"
  ),
  ADD CONSTRAINT "GraduationBatch_running_lease_check" CHECK (
    "status" <> 'RUNNING'
    OR ("leaseToken" IS NOT NULL AND "leaseUntil" IS NOT NULL)
  );

ALTER TABLE "GraduationBatchItem"
  ADD CONSTRAINT "GraduationBatchItem_outcome_check" CHECK (
    ("status" = 'REVIEWED'
      AND "auditId" IS NOT NULL AND "rosterEnrollmentId" IS NOT NULL
      AND "errorCode" IS NULL AND "errorMessage" IS NULL)
    OR ("status" = 'ERROR' AND "auditId" IS NULL
      AND "errorCode" IS NOT NULL AND "errorMessage" IS NOT NULL)
    OR ("status" = 'PENDING' AND "auditId" IS NULL
      AND "errorCode" IS NULL AND "errorMessage" IS NULL)
  );

ALTER TABLE "GraduationResultChangeReceipt"
  ADD CONSTRAINT "GraduationResultChangeReceipt_targetCount_check"
    CHECK ("targetCount" >= 0);

ALTER TABLE "GraduationReauditTask"
  ADD CONSTRAINT "GraduationReauditTask_attempts_check"
    CHECK ("attempts" >= 0),
  ADD CONSTRAINT "GraduationReauditTask_running_lease_check" CHECK (
    "status" <> 'RUNNING'
    OR ("leaseToken" IS NOT NULL AND "leaseUntil" IS NOT NULL)
  );
