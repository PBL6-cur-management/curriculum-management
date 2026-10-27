-- CreateEnum
CREATE TYPE "ImportType" AS ENUM ('COURSE_CATALOG', 'CURRICULUM', 'STUDENT_LIST', 'ACADEMIC_RESULT');

-- CreateEnum
CREATE TYPE "ImportBatchStatus" AS ENUM ('VALIDATING', 'DRY_RUN', 'COMMITTING', 'COMMITTED', 'ABORTED');

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL,
    "importType" "ImportType" NOT NULL,
    "fileName" TEXT NOT NULL,
    "performedById" TEXT NOT NULL,
    "programId" TEXT,
    "versionId" TEXT,
    "status" "ImportBatchStatus" NOT NULL,
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "successRows" INTEGER NOT NULL DEFAULT 0,
    "errorRows" INTEGER NOT NULL DEFAULT 0,
    "errorReport" JSONB,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportBatchFile" (
    "batchId" TEXT NOT NULL,
    "content" BYTEA NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportBatchFile_pkey" PRIMARY KEY ("batchId")
);

-- CreateIndex
CREATE INDEX "ImportBatch_performedById_recordedAt_idx" ON "ImportBatch"("performedById", "recordedAt");

-- CreateIndex
CREATE INDEX "ImportBatch_programId_recordedAt_idx" ON "ImportBatch"("programId", "recordedAt");

-- CreateIndex
CREATE INDEX "ImportBatch_status_recordedAt_idx" ON "ImportBatch"("status", "recordedAt");

-- CreateIndex
CREATE INDEX "ImportBatchFile_expiresAt_idx" ON "ImportBatchFile"("expiresAt");

-- AddForeignKey
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "ProgramVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportBatchFile" ADD CONSTRAINT "ImportBatchFile_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddCheckConstraint
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_program_for_curriculum"
  CHECK (("importType" = 'CURRICULUM') = ("programId" IS NOT NULL));

-- AddCheckConstraint
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_row_counts"
  CHECK ("totalRows" >= 0 AND "successRows" >= 0 AND "errorRows" >= 0 AND "successRows" + "errorRows" = "totalRows");
