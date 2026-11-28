-- CreateEnum
CREATE TYPE "MajorStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- AlterEnum
ALTER TYPE "ChangeRequestStatus" ADD VALUE 'PENDING_FACULTY_LEADERSHIP';

-- AlterEnum
ALTER TYPE "DegreeLevel" ADD VALUE 'MASTER';
ALTER TYPE "DegreeLevel" ADD VALUE 'DOCTORATE';

-- AlterEnum
ALTER TYPE "ImportType" ADD VALUE 'PROGRAM_TRANSFER';

-- DropIndex
DROP INDEX "CurriculumItem_versionId_courseId_key";

-- AlterTable
ALTER TABLE "ApprovalStep" ADD COLUMN "forFacultyId" TEXT;

-- AlterTable
ALTER TABLE "CurriculumItem" ADD COLUMN "trackId" TEXT;

-- AlterTable
ALTER TABLE "ElectiveGroup" ADD COLUMN "trackId" TEXT;

-- AlterTable
ALTER TABLE "OrgUnit" ADD COLUMN "isExternal" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Program" ADD COLUMN "majorId" TEXT;

-- AlterTable
ALTER TABLE "ProgramEnrollment" ADD COLUMN "trackId" TEXT;

-- AlterTable
ALTER TABLE "ProgramVersion" ADD COLUMN "minGraduationGpa" DECIMAL(3,2);

-- AlterTable
ALTER TABLE "Syllabus" ADD COLUMN "documentNumber" TEXT,
ADD COLUMN "effectiveSemesterId" TEXT,
ADD COLUMN "signedDate" DATE;

-- CreateTable
CREATE TABLE "Major" (
    "id" TEXT NOT NULL,
    "majorCode" TEXT NOT NULL,
    "majorName" TEXT NOT NULL,
    "englishName" TEXT,
    "degreeGroup" TEXT,
    "facultyId" TEXT,
    "status" "MajorStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Major_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramTrack" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "trackCode" TEXT NOT NULL,
    "trackName" TEXT NOT NULL,
    "englishName" TEXT,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "compulsoryCredits" DECIMAL(5,2),
    "electiveCredits" DECIMAL(5,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProgramTrack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChangeRequestCohort" (
    "id" TEXT NOT NULL,
    "changeRequestId" TEXT NOT NULL,
    "cohortId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChangeRequestCohort_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Major_majorCode_key" ON "Major"("majorCode");
CREATE INDEX "Major_facultyId_idx" ON "Major"("facultyId");
CREATE INDEX "Major_status_idx" ON "Major"("status");

CREATE INDEX "ProgramTrack_versionId_sortOrder_idx" ON "ProgramTrack"("versionId", "sortOrder");
CREATE UNIQUE INDEX "ProgramTrack_versionId_trackCode_key" ON "ProgramTrack"("versionId", "trackCode");

CREATE INDEX "ChangeRequestCohort_cohortId_idx" ON "ChangeRequestCohort"("cohortId");
CREATE UNIQUE INDEX "ChangeRequestCohort_changeRequestId_cohortId_key" ON "ChangeRequestCohort"("changeRequestId", "cohortId");

CREATE INDEX "ApprovalStep_forFacultyId_idx" ON "ApprovalStep"("forFacultyId");
CREATE INDEX "CurriculumItem_trackId_idx" ON "CurriculumItem"("trackId");
CREATE UNIQUE INDEX "CurriculumItem_versionId_trackId_courseId_key" ON "CurriculumItem"("versionId", "trackId", "courseId");
CREATE UNIQUE INDEX "CurriculumItem_versionId_common_courseId_key" ON "CurriculumItem"("versionId", "courseId") WHERE "trackId" IS NULL;

CREATE INDEX "ElectiveGroup_trackId_idx" ON "ElectiveGroup"("trackId");
CREATE INDEX "Program_majorId_idx" ON "Program"("majorId");
CREATE INDEX "ProgramEnrollment_trackId_idx" ON "ProgramEnrollment"("trackId");

-- AddForeignKey
ALTER TABLE "Major" ADD CONSTRAINT "Major_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "OrgUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Program" ADD CONSTRAINT "Program_majorId_fkey" FOREIGN KEY ("majorId") REFERENCES "Major"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProgramTrack" ADD CONSTRAINT "ProgramTrack_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "ProgramVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ElectiveGroup" ADD CONSTRAINT "ElectiveGroup_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "ProgramTrack"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CurriculumItem" ADD CONSTRAINT "CurriculumItem_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "ProgramTrack"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Syllabus" ADD CONSTRAINT "Syllabus_effectiveSemesterId_fkey" FOREIGN KEY ("effectiveSemesterId") REFERENCES "Semester"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ChangeRequestCohort" ADD CONSTRAINT "ChangeRequestCohort_changeRequestId_fkey" FOREIGN KEY ("changeRequestId") REFERENCES "ChangeRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChangeRequestCohort" ADD CONSTRAINT "ChangeRequestCohort_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ApprovalStep" ADD CONSTRAINT "ApprovalStep_forFacultyId_fkey" FOREIGN KEY ("forFacultyId") REFERENCES "OrgUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProgramEnrollment" ADD CONSTRAINT "ProgramEnrollment_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "ProgramTrack"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Update hand-managed CHECK constraints
ALTER TABLE "ApprovalStep" DROP CONSTRAINT "ApprovalStep_level_range";
ALTER TABLE "ApprovalStep" ADD CONSTRAINT "ApprovalStep_level_range" CHECK ("approvalLevel" BETWEEN 1 AND 4);

ALTER TABLE "ApprovalDelegation" DROP CONSTRAINT "ApprovalDelegation_scope_level";
ALTER TABLE "ApprovalDelegation" ADD CONSTRAINT "ApprovalDelegation_scope_level" CHECK ("scopeLevel" IS NULL OR "scopeLevel" IN (1, 2, 3));

ALTER TABLE "IntegrationCallLog" DROP CONSTRAINT "IntegrationCallLog_resource_check";
ALTER TABLE "IntegrationCallLog" ADD CONSTRAINT "IntegrationCallLog_resource_check" CHECK ("resource" IN (
    'STUDENT_PROGRAM',
    'PROGRAM_VERSION',
    'SYLLABUS',
    'PROGRESS',
    'ELIGIBILITY',
    'GRADUATION',
    'COURSE_CATALOG',
    'COURSE_DETAIL'
));

ALTER TABLE "ProgramVersion" ADD CONSTRAINT "ProgramVersion_minGraduationGpa_range" CHECK (
    "minGraduationGpa" IS NULL OR ("minGraduationGpa" >= 0 AND "minGraduationGpa" <= 4)
);
