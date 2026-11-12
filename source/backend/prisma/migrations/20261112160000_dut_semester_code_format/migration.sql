-- Update Semester codes to DUT YYKS format:
-- 2 digits academic year start + regular term (1 or 2) or summer/special term (21, 22)
UPDATE "Semester"
SET "semesterCode" = SUBSTRING("academicYear" FROM 3 FOR 2) ||
  CASE
    WHEN "termInYear" = 1 THEN '10'
    WHEN "termInYear" = 2 THEN '20'
    WHEN "termInYear" = 3 THEN '21'
    WHEN "termInYear" = 4 THEN '22'
    ELSE '10'
  END
WHERE "semesterCode" ~ '^\d{4}-\d{4}-\d+$';
