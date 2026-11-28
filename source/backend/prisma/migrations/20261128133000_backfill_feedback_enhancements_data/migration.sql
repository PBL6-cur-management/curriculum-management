-- Backfill data migrated from the pre-4-level / pre-Major schema on existing databases:
-- 1. Pre-4-level Academic Office approval steps were stored at approvalLevel = 3 with forFacultyId IS NULL.
--    Move them to approvalLevel = 4 so in-flight and historical requests remain consistent with the 4-level flow.
UPDATE "ApprovalStep"
SET "approvalLevel" = 4
WHERE "approvalLevel" = 3
  AND "forFacultyId" IS NULL;

-- 2. Standardize legacy DUT OrgUnit abbreviations ("K." -> "Khoa", "P." -> "Phòng")
--    and flag partner-university external units (DUT-2xx..5xx).
UPDATE "OrgUnit"
SET "unitName" = regexp_replace(
  regexp_replace(trim("unitName"), '^K\.\s*', 'Khoa '),
  '^P\.\s*', 'Phòng '
)
WHERE "unitName" ~ '^(K\.|P\.)\s*';

UPDATE "OrgUnit"
SET "isExternal" = true
WHERE "unitCode" ~ '^DUT-[2-5][0-9]{2}$'
  AND "isExternal" = false;

-- 3. Backfill Program.majorId from Major matching either exact ProgramVersion.majorCode
--    or its leading numeric national major code (e.g. 7480201A / 7480201TN -> 7480201).
WITH latest_pv AS (
  SELECT DISTINCT ON ("programId") "programId", "majorCode"
  FROM "ProgramVersion"
  WHERE "sourceRequestId" IS NULL
  ORDER BY "programId",
    CASE status WHEN 'ACTIVE' THEN 0 WHEN 'PENDING' THEN 1 WHEN 'HISTORICAL' THEN 2 ELSE 3 END,
    "createdAt" DESC
)
UPDATE "Program" p
SET "majorId" = COALESCE(m_exact.id, m_base.id)
FROM latest_pv lpv
LEFT JOIN "Major" m_exact ON m_exact."majorCode" = lpv."majorCode"
LEFT JOIN "Major" m_base ON m_base."majorCode" = regexp_replace(lpv."majorCode", '[^0-9].*$', '')
WHERE p.id = lpv."programId"
  AND p."majorId" IS NULL
  AND COALESCE(m_exact.id, m_base.id) IS NOT NULL;
