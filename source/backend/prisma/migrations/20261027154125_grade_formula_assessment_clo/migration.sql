-- AlterTable
ALTER TABLE "Syllabus" ADD COLUMN     "failingScore" DECIMAL(9,2);

-- CreateTable
CREATE TABLE "AssessmentComponent" (
    "id" TEXT NOT NULL,
    "syllabusId" TEXT NOT NULL,
    "componentCode" TEXT NOT NULL,
    "componentName" TEXT NOT NULL,
    "weight" DECIMAL(5,2) NOT NULL,
    "assessmentForm" TEXT,
    "isConditional" BOOLEAN NOT NULL DEFAULT false,
    "conditionThreshold" DECIMAL(9,2),
    "failingScore" DECIMAL(9,2),

    CONSTRAINT "AssessmentComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentCLOMapping" (
    "id" TEXT NOT NULL,
    "assessmentComponentId" TEXT NOT NULL,
    "cloId" TEXT NOT NULL,
    "cloWeight" DECIMAL(5,2),

    CONSTRAINT "AssessmentCLOMapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentComponent_syllabusId_componentCode_key" ON "AssessmentComponent"("syllabusId", "componentCode");

-- CreateIndex
CREATE INDEX "AssessmentCLOMapping_cloId_idx" ON "AssessmentCLOMapping"("cloId");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentCLOMapping_assessmentComponentId_cloId_key" ON "AssessmentCLOMapping"("assessmentComponentId", "cloId");

-- AddForeignKey
ALTER TABLE "AssessmentComponent" ADD CONSTRAINT "AssessmentComponent_syllabusId_fkey" FOREIGN KEY ("syllabusId") REFERENCES "Syllabus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentCLOMapping" ADD CONSTRAINT "AssessmentCLOMapping_assessmentComponentId_fkey" FOREIGN KEY ("assessmentComponentId") REFERENCES "AssessmentComponent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentCLOMapping" ADD CONSTRAINT "AssessmentCLOMapping_cloId_fkey" FOREIGN KEY ("cloId") REFERENCES "CLO"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Declaration shape checks; sum-to-100 and same-revision mapping are enforced by the locked writers.
ALTER TABLE "Syllabus" ADD CONSTRAINT "Syllabus_failingScore_nonnegative"
  CHECK ("failingScore" IS NULL OR "failingScore" >= 0);
ALTER TABLE "AssessmentComponent" ADD CONSTRAINT "AssessmentComponent_weight_range"
  CHECK ("weight" > 0 AND "weight" <= 100);
ALTER TABLE "AssessmentComponent" ADD CONSTRAINT "AssessmentComponent_threshold_shape"
  CHECK (("isConditional" AND "conditionThreshold" IS NOT NULL AND "conditionThreshold" >= 0)
      OR (NOT "isConditional" AND "conditionThreshold" IS NULL));
ALTER TABLE "AssessmentComponent" ADD CONSTRAINT "AssessmentComponent_failingScore_nonnegative"
  CHECK ("failingScore" IS NULL OR "failingScore" >= 0);
ALTER TABLE "AssessmentCLOMapping" ADD CONSTRAINT "AssessmentCLOMapping_weight_range"
  CHECK ("cloWeight" IS NULL OR ("cloWeight" > 0 AND "cloWeight" <= 100));
