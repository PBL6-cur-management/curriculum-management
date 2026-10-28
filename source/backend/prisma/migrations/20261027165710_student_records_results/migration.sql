-- CreateEnum
CREATE TYPE "StudentStatus" AS ENUM ('STUDYING', 'ON_LEAVE', 'WITHDRAWN', 'GRADUATED');

-- CreateEnum
CREATE TYPE "StudentDataSource" AS ENUM ('EXCEL', 'SCHOOL_DB');

-- CreateEnum
CREATE TYPE "EnrollmentType" AS ENUM ('PRIMARY', 'SECOND_MAJOR');

-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('ACTIVE', 'TRANSFERRED', 'ENDED');

-- CreateEnum
CREATE TYPE "AcademicResultStatus" AS ENUM ('PASSED', 'FAILED', 'IN_PROGRESS', 'EXEMPT');

-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL,
    "studentCode" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "cohortId" TEXT NOT NULL,
    "admissionSemesterId" TEXT NOT NULL,
    "statusSemesterId" TEXT NOT NULL,
    "major" TEXT NOT NULL,
    "status" "StudentStatus" NOT NULL DEFAULT 'STUDYING',
    "dataSource" "StudentDataSource" NOT NULL DEFAULT 'EXCEL',
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramEnrollment" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "cohortId" TEXT NOT NULL,
    "appliedVersionId" TEXT NOT NULL,
    "admissionVersionId" TEXT NOT NULL,
    "cohortAssignmentId" TEXT,
    "fromSemesterId" TEXT NOT NULL,
    "untilSemesterId" TEXT,
    "previousEnrollmentId" TEXT,
    "enrollmentType" "EnrollmentType" NOT NULL,
    "isException" BOOLEAN NOT NULL DEFAULT false,
    "basisDecision" TEXT,
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProgramEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcademicResult" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "semesterId" TEXT NOT NULL,
    "score10" DECIMAL(4,2),
    "score4" DECIMAL(3,2),
    "letterGrade" TEXT,
    "status" "AcademicResultStatus" NOT NULL,
    "dataSource" "StudentDataSource" NOT NULL DEFAULT 'EXCEL',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcademicResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcademicResultChange" (
    "id" TEXT NOT NULL,
    "academicResultId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "before" JSONB,
    "after" JSONB NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AcademicResultChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentCredentialDelivery" (
    "batchId" TEXT NOT NULL,
    "accountCount" INTEGER NOT NULL,
    "ciphertext" BYTEA,
    "iv" BYTEA,
    "authTag" BYTEA,
    "keyId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "downloadedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentCredentialDelivery_pkey" PRIMARY KEY ("batchId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Student_studentCode_key" ON "Student"("studentCode");

-- CreateIndex
CREATE UNIQUE INDEX "Student_userId_key" ON "Student"("userId");

-- CreateIndex
CREATE INDEX "Student_cohortId_status_idx" ON "Student"("cohortId", "status");

-- CreateIndex
CREATE INDEX "Student_fullName_id_idx" ON "Student"("fullName", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramEnrollment_previousEnrollmentId_key" ON "ProgramEnrollment"("previousEnrollmentId");

-- CreateIndex
CREATE INDEX "ProgramEnrollment_studentId_programId_idx" ON "ProgramEnrollment"("studentId", "programId");

-- CreateIndex
CREATE INDEX "ProgramEnrollment_programId_cohortId_status_isException_idx" ON "ProgramEnrollment"("programId", "cohortId", "status", "isException");

-- CreateIndex
CREATE INDEX "AcademicResult_studentId_semesterId_idx" ON "AcademicResult"("studentId", "semesterId");

-- CreateIndex
CREATE UNIQUE INDEX "AcademicResult_studentId_courseId_semesterId_key" ON "AcademicResult"("studentId", "courseId", "semesterId");

-- CreateIndex
CREATE INDEX "AcademicResultChange_recordedAt_id_idx" ON "AcademicResultChange"("recordedAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "AcademicResultChange_academicResultId_revision_key" ON "AcademicResultChange"("academicResultId", "revision");

-- CreateIndex
CREATE INDEX "StudentCredentialDelivery_expiresAt_idx" ON "StudentCredentialDelivery"("expiresAt");

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_admissionSemesterId_fkey" FOREIGN KEY ("admissionSemesterId") REFERENCES "Semester"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_statusSemesterId_fkey" FOREIGN KEY ("statusSemesterId") REFERENCES "Semester"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramEnrollment" ADD CONSTRAINT "ProgramEnrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramEnrollment" ADD CONSTRAINT "ProgramEnrollment_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramEnrollment" ADD CONSTRAINT "ProgramEnrollment_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramEnrollment" ADD CONSTRAINT "ProgramEnrollment_appliedVersionId_fkey" FOREIGN KEY ("appliedVersionId") REFERENCES "ProgramVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramEnrollment" ADD CONSTRAINT "ProgramEnrollment_admissionVersionId_fkey" FOREIGN KEY ("admissionVersionId") REFERENCES "ProgramVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramEnrollment" ADD CONSTRAINT "ProgramEnrollment_cohortAssignmentId_fkey" FOREIGN KEY ("cohortAssignmentId") REFERENCES "CohortVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramEnrollment" ADD CONSTRAINT "ProgramEnrollment_fromSemesterId_fkey" FOREIGN KEY ("fromSemesterId") REFERENCES "Semester"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramEnrollment" ADD CONSTRAINT "ProgramEnrollment_untilSemesterId_fkey" FOREIGN KEY ("untilSemesterId") REFERENCES "Semester"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramEnrollment" ADD CONSTRAINT "ProgramEnrollment_previousEnrollmentId_fkey" FOREIGN KEY ("previousEnrollmentId") REFERENCES "ProgramEnrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramEnrollment" ADD CONSTRAINT "ProgramEnrollment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicResult" ADD CONSTRAINT "AcademicResult_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicResult" ADD CONSTRAINT "AcademicResult_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicResult" ADD CONSTRAINT "AcademicResult_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "Semester"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicResultChange" ADD CONSTRAINT "AcademicResultChange_academicResultId_fkey" FOREIGN KEY ("academicResultId") REFERENCES "AcademicResult"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentCredentialDelivery" ADD CONSTRAINT "StudentCredentialDelivery_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Not expressible in Prisma: partial unique indexes and CHECK constraints.
CREATE UNIQUE INDEX "ProgramEnrollment_one_active_program"
  ON "ProgramEnrollment" ("studentId", "programId") WHERE "status" = 'ACTIVE';

CREATE UNIQUE INDEX "ProgramEnrollment_one_active_primary"
  ON "ProgramEnrollment" ("studentId")
  WHERE "status" = 'ACTIVE' AND "enrollmentType" = 'PRIMARY';

ALTER TABLE "ProgramEnrollment" ADD CONSTRAINT "ProgramEnrollment_exception_basis"
  CHECK (NOT "isException" OR length(btrim(coalesce("basisDecision", ''))) > 0);

ALTER TABLE "ProgramEnrollment" ADD CONSTRAINT "ProgramEnrollment_closed_interval"
  CHECK (("status" = 'ACTIVE') = ("untilSemesterId" IS NULL));

ALTER TABLE "AcademicResult" ADD CONSTRAINT "AcademicResult_score10_range"
  CHECK ("score10" IS NULL OR "score10" BETWEEN 0 AND 10);

ALTER TABLE "AcademicResult" ADD CONSTRAINT "AcademicResult_score4_range"
  CHECK ("score4" IS NULL OR "score4" BETWEEN 0 AND 4);

ALTER TABLE "AcademicResult" ADD CONSTRAINT "AcademicResult_revision_positive"
  CHECK ("revision" > 0);

ALTER TABLE "StudentCredentialDelivery" ADD CONSTRAINT "StudentCredentialDelivery_count_positive"
  CHECK ("accountCount" > 0);
