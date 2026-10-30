-- CreateEnum
CREATE TYPE "SchoolSyncMode" AS ENUM ('EXCEL_ONLY', 'SCHOOL_DB');

-- CreateEnum
CREATE TYPE "SchoolSyncProfile" AS ENUM ('SIMULATED_SQL_SERVER', 'EXTERNAL_SQL_SERVER');

-- CreateEnum
CREATE TYPE "SchoolSyncCadence" AS ENUM ('DAILY', 'WEEKLY');

-- CreateEnum
CREATE TYPE "SchoolSyncStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "SchoolSyncTrigger" AS ENUM ('SCHEDULED', 'MANUAL', 'RETRY');

-- CreateEnum
CREATE TYPE "SchoolMappingKind" AS ENUM ('COHORT', 'PROGRAM', 'SEMESTER', 'COURSE');

-- CreateEnum
CREATE TYPE "SchoolConflictEntity" AS ENUM ('STUDENT', 'ACADEMIC_RESULT');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'SCHOOL_SYNC_FAILED';

-- CreateTable
CREATE TABLE "SchoolSyncConfiguration" (
    "id" TEXT NOT NULL,
    "singletonKey" TEXT NOT NULL DEFAULT 'SCHOOL_DB',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "mode" "SchoolSyncMode" NOT NULL DEFAULT 'EXCEL_ONLY',
    "profile" "SchoolSyncProfile" NOT NULL DEFAULT 'SIMULATED_SQL_SERVER',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "sourceIdentity" TEXT NOT NULL DEFAULT 'SYNTHETIC-SCHOOL-V1',
    "host" TEXT,
    "port" INTEGER,
    "database" TEXT,
    "username" TEXT,
    "passwordCiphertext" BYTEA,
    "passwordIv" BYTEA,
    "passwordTag" BYTEA,
    "passwordKeyId" TEXT,
    "connectionRevision" INTEGER NOT NULL DEFAULT 1,
    "verifiedConnectionRevision" INTEGER,
    "cadence" "SchoolSyncCadence" NOT NULL DEFAULT 'DAILY',
    "localTime" TEXT NOT NULL DEFAULT '02:00',
    "weekday" INTEGER,
    "nextDueAt" TIMESTAMP(3),
    "lastSuccessfulRunId" TEXT,
    "lastSnapshotVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolSyncConfiguration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolReferenceMapping" (
    "id" TEXT NOT NULL,
    "configurationId" TEXT NOT NULL,
    "kind" "SchoolMappingKind" NOT NULL,
    "sourceCode" TEXT NOT NULL,
    "targetCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolReferenceMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolClassMirror" (
    "id" TEXT NOT NULL,
    "configurationId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "classCode" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "semesterId" TEXT NOT NULL,
    "lastSnapshotVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolClassMirror_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncLog" (
    "id" TEXT NOT NULL,
    "configurationId" TEXT NOT NULL,
    "requestKey" TEXT NOT NULL,
    "dataSource" TEXT NOT NULL DEFAULT 'SCHOOL_DB',
    "profile" "SchoolSyncProfile" NOT NULL,
    "trigger" "SchoolSyncTrigger" NOT NULL,
    "requestedById" TEXT,
    "retryOfId" TEXT,
    "configurationRevision" INTEGER NOT NULL,
    "status" "SchoolSyncStatus" NOT NULL DEFAULT 'RUNNING',
    "workerToken" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),
    "snapshotVersion" TEXT,
    "recordCount" INTEGER NOT NULL DEFAULT 0,
    "studentCount" INTEGER NOT NULL DEFAULT 0,
    "resultCount" INTEGER NOT NULL DEFAULT 0,
    "classCount" INTEGER NOT NULL DEFAULT 0,
    "changedCount" INTEGER NOT NULL DEFAULT 0,
    "conflictCount" INTEGER NOT NULL DEFAULT 0,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncConflict" (
    "id" TEXT NOT NULL,
    "syncLogId" TEXT NOT NULL,
    "entityType" "SchoolConflictEntity" NOT NULL,
    "recordKey" TEXT NOT NULL,
    "previousSource" "StudentDataSource" NOT NULL,
    "selectedSource" "StudentDataSource" NOT NULL,
    "fields" TEXT[],
    "before" JSONB NOT NULL,
    "after" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncConflict_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SchoolSyncConfiguration_singletonKey_key" ON "SchoolSyncConfiguration"("singletonKey");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolReferenceMapping_configurationId_kind_sourceCode_key" ON "SchoolReferenceMapping"("configurationId", "kind", "sourceCode");

-- CreateIndex
CREATE INDEX "SchoolClassMirror_courseId_semesterId_idx" ON "SchoolClassMirror"("courseId", "semesterId");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolClassMirror_configurationId_sourceId_key" ON "SchoolClassMirror"("configurationId", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "SyncLog_requestKey_key" ON "SyncLog"("requestKey");

-- CreateIndex
CREATE INDEX "SyncLog_startedAt_id_idx" ON "SyncLog"("startedAt", "id");

-- CreateIndex
CREATE INDEX "SyncLog_status_startedAt_id_idx" ON "SyncLog"("status", "startedAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "SyncConflict_syncLogId_entityType_recordKey_key" ON "SyncConflict"("syncLogId", "entityType", "recordKey");

-- AddForeignKey
ALTER TABLE "SchoolReferenceMapping" ADD CONSTRAINT "SchoolReferenceMapping_configurationId_fkey" FOREIGN KEY ("configurationId") REFERENCES "SchoolSyncConfiguration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolClassMirror" ADD CONSTRAINT "SchoolClassMirror_configurationId_fkey" FOREIGN KEY ("configurationId") REFERENCES "SchoolSyncConfiguration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolClassMirror" ADD CONSTRAINT "SchoolClassMirror_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolClassMirror" ADD CONSTRAINT "SchoolClassMirror_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "Semester"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncLog" ADD CONSTRAINT "SyncLog_configurationId_fkey" FOREIGN KEY ("configurationId") REFERENCES "SchoolSyncConfiguration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncLog" ADD CONSTRAINT "SyncLog_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncLog" ADD CONSTRAINT "SyncLog_retryOfId_fkey" FOREIGN KEY ("retryOfId") REFERENCES "SyncLog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncConflict" ADD CONSTRAINT "SyncConflict_syncLogId_fkey" FOREIGN KEY ("syncLogId") REFERENCES "SyncLog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
