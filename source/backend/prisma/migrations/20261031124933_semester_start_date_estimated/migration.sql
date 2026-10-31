-- AlterTable
ALTER TABLE "Semester" ADD COLUMN     "startDateEstimated" BOOLEAN NOT NULL DEFAULT false;

-- An estimated start date needs a date (added by hand: not modelled by Prisma).
ALTER TABLE "Semester" ADD CONSTRAINT "Semester_estimated_needs_date" CHECK (NOT "startDateEstimated" OR "startDate" IS NOT NULL);
