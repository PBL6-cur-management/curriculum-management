-- CreateEnum
CREATE TYPE "IntegrationClientStatus" AS ENUM ('ACTIVE', 'LOCKED');

-- CreateTable
CREATE TABLE "IntegrationClient" (
    "id" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "keyHash" CHAR(64) NOT NULL,
    "rateLimit" INTEGER NOT NULL DEFAULT 60,
    "status" "IntegrationClientStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationClient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationRateWindow" (
    "clientId" TEXT NOT NULL,
    "windowStart" TIMESTAMPTZ(3) NOT NULL,
    "used" INTEGER NOT NULL,

    CONSTRAINT "IntegrationRateWindow_pkey" PRIMARY KEY ("clientId","windowStart")
);

-- CreateTable
CREATE TABLE "IntegrationCallLog" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "clientId" TEXT,
    "resource" TEXT NOT NULL,
    "studentCode" TEXT,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "httpStatus" INTEGER NOT NULL,
    "errorCode" TEXT,
    "durationMs" INTEGER NOT NULL,

    CONSTRAINT "IntegrationCallLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationClient_clientName_key" ON "IntegrationClient"("clientName");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationClient_keyHash_key" ON "IntegrationClient"("keyHash");

-- CreateIndex
CREATE INDEX "IntegrationRateWindow_windowStart_idx" ON "IntegrationRateWindow"("windowStart");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationCallLog_requestId_key" ON "IntegrationCallLog"("requestId");

-- CreateIndex
CREATE INDEX "IntegrationCallLog_clientId_occurredAt_idx" ON "IntegrationCallLog"("clientId", "occurredAt");

-- CreateIndex
CREATE INDEX "IntegrationCallLog_studentCode_occurredAt_idx" ON "IntegrationCallLog"("studentCode", "occurredAt");

-- AddForeignKey
ALTER TABLE "IntegrationClient" ADD CONSTRAINT "IntegrationClient_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationRateWindow" ADD CONSTRAINT "IntegrationRateWindow_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "IntegrationClient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationCallLog" ADD CONSTRAINT "IntegrationCallLog_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "IntegrationClient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- F-21 invariants (INTEGRATION constants): rate limit 1..2147483647, key hash = lowercase SHA-256 hex,
-- nonblank client name, positive window counts, HTTP status 100..599, nonnegative duration, six resources.
ALTER TABLE "IntegrationClient"
  ADD CONSTRAINT "IntegrationClient_rateLimit_check" CHECK ("rateLimit" BETWEEN 1 AND 2147483647),
  ADD CONSTRAINT "IntegrationClient_keyHash_check" CHECK ("keyHash" ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT "IntegrationClient_clientName_check" CHECK (btrim("clientName") <> '');
ALTER TABLE "IntegrationRateWindow"
  ADD CONSTRAINT "IntegrationRateWindow_used_check" CHECK ("used" > 0);
ALTER TABLE "IntegrationCallLog"
  ADD CONSTRAINT "IntegrationCallLog_httpStatus_check" CHECK ("httpStatus" BETWEEN 100 AND 599),
  ADD CONSTRAINT "IntegrationCallLog_durationMs_check" CHECK ("durationMs" >= 0),
  ADD CONSTRAINT "IntegrationCallLog_resource_check" CHECK ("resource" IN
    ('STUDENT_PROGRAM', 'PROGRAM_VERSION', 'SYLLABUS', 'PROGRESS', 'ELIGIBILITY', 'GRADUATION'));

-- Call records are append-only at runtime. Only an owner-level maintenance transaction
-- (SET LOCAL ctdt.integration_log_maintenance = 'on', used by the e2e purge) may remove rows.
CREATE FUNCTION "IntegrationCallLog_append_only"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' AND current_setting('ctdt.integration_log_maintenance', true) = 'on' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'IntegrationCallLog is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "IntegrationCallLog_append_only"
  BEFORE UPDATE OR DELETE ON "IntegrationCallLog"
  FOR EACH ROW EXECUTE FUNCTION "IntegrationCallLog_append_only"();
