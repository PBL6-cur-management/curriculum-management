-- F-22 invariants Prisma cannot express.

-- At most one run in progress: overlapping manual/scheduled requests get a unique violation (US-103 AC3).
CREATE UNIQUE INDEX "SyncLog_one_running_configuration"
  ON "SyncLog" ("configurationId") WHERE "status" = 'RUNNING';

ALTER TABLE "SchoolSyncConfiguration"
  ADD CONSTRAINT "SchoolSync_singleton"
    CHECK ("singletonKey" = 'SCHOOL_DB' AND "revision" > 0 AND "connectionRevision" > 0),
  ADD CONSTRAINT "SchoolSync_schedule_shape"
    CHECK (("cadence" = 'DAILY' AND "weekday" IS NULL)
      OR ("cadence" = 'WEEKLY' AND "weekday" BETWEEN 1 AND 7)),
  ADD CONSTRAINT "SchoolSync_mode_shape"
    CHECK (("mode" = 'SCHOOL_DB' OR NOT "enabled")
      AND (("enabled" AND "mode" = 'SCHOOL_DB') = ("nextDueAt" IS NOT NULL))),
  ADD CONSTRAINT "SchoolSync_password_envelope"
    CHECK (("passwordCiphertext" IS NULL) = ("passwordIv" IS NULL)
      AND ("passwordCiphertext" IS NULL) = ("passwordTag" IS NULL)
      AND ("passwordCiphertext" IS NULL) = ("passwordKeyId" IS NULL)),
  ADD CONSTRAINT "SchoolSync_port_range"
    CHECK ("port" IS NULL OR "port" BETWEEN 1 AND 65535),
  ADD CONSTRAINT "SchoolSync_local_time"
    CHECK ("localTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');

ALTER TABLE "SyncLog"
  ADD CONSTRAINT "SyncLog_terminal_shape"
    CHECK (("status" = 'RUNNING') = ("finishedAt" IS NULL)),
  ADD CONSTRAINT "SyncLog_expiry_after_start"
    CHECK ("expiresAt" > "startedAt"),
  ADD CONSTRAINT "SyncLog_nonnegative_counts"
    CHECK ("recordCount" >= 0 AND "studentCount" >= 0 AND "resultCount" >= 0
      AND "classCount" >= 0 AND "changedCount" >= 0 AND "conflictCount" >= 0
      AND "recordCount" = "studentCount" + "resultCount" + "classCount"),
  -- A failed run committed nothing, so it reports nothing.
  ADD CONSTRAINT "SyncLog_failed_has_no_domain_counts"
    CHECK ("status" <> 'FAILED'
      OR ("recordCount" = 0 AND "changedCount" = 0 AND "conflictCount" = 0)),
  ADD CONSTRAINT "SyncLog_error_shape"
    CHECK (("status" = 'FAILED') = ("errorCode" IS NOT NULL AND "errorMessage" IS NOT NULL));

ALTER TABLE "SyncConflict"
  ADD CONSTRAINT "SyncConflict_sources"
    CHECK ("previousSource" = 'EXCEL' AND "selectedSource" = 'SCHOOL_DB');
