import type { PrismaClient } from '../../../../src/generated/prisma/client.js';
import {
  CYCLE_CHECKED_TYPES,
  findRequisiteCycle,
  lockRequisiteGraph,
} from '../../../../src/shared/courses/requisite-graph.js';
import { HOME_FACULTY_CODE } from '../../../../src/shared/org-units/home-faculty.js';
import { fromIsoDay, toIsoDay } from '../../../../src/shared/time/today.js';
import type { DutCatalogFile } from '../dut-data.js';

const DUT_RELATION_TX_TIMEOUT_MS = 60_000;
export interface SeedCounts {
  created: number;
  skipped: number;
}
export interface CatalogSeedResult {
  courseIds: Map<string, string>;
  // Course code → name and credits, frozen onto released curriculum rows.
  courses: Map<string, { courseName: string; credits: string }>;
  semesterIds: Map<string, { id: string; startDate: Date | null }>;
  // Legacy term code (2610) → semester id, for students and results.
  semesterIdsByLegacyCode: Map<string, string>;
  cohortIds: Map<string, string>;
  semesterDateDifferences: {
    semesterCode: string;
    existing: string | null;
    legacy: string;
  }[];
  relationsCreated: number;
  relationsSkippedCycle: number;
  counts: Record<
    'units' | 'courses' | 'relations' | 'semesters' | 'cohorts',
    SeedCounts
  >;
}

export async function seedDutCatalog(
  prisma: PrismaClient,
  catalog: DutCatalogFile,
  ids: { universityId: string; facultyId: string },
): Promise<CatalogSeedResult> {
  const result: CatalogSeedResult = {
    courseIds: new Map(),
    courses: new Map(),
    semesterIds: new Map(),
    semesterIdsByLegacyCode: new Map(),
    cohortIds: new Map(),
    semesterDateDifferences: [],
    relationsCreated: 0,
    relationsSkippedCycle: 0,
    counts: {
      units: { created: 0, skipped: 0 },
      courses: { created: 0, skipped: 0 },
      relations: { created: 0, skipped: 0 },
      semesters: { created: 0, skipped: 0 },
      cohorts: { created: 0, skipped: 0 },
    },
  };
  const unitIds = new Map([[HOME_FACULTY_CODE, ids.facultyId]]);
  for (const unit of catalog.units) {
    const existing = await prisma.orgUnit.findUnique({
      where: { unitCode: unit.unitCode },
      select: { id: true },
    });
    const row = await prisma.orgUnit.upsert({
      where: { unitCode: unit.unitCode },
      create: { ...unit, parentUnitId: ids.universityId },
      update: {},
    });
    unitIds.set(unit.unitCode, row.id);
    result.counts.units[existing ? 'skipped' : 'created']++;
  }
  for (const { ownerUnitCode, ...course } of catalog.courses) {
    const ownerFacultyId = unitIds.get(ownerUnitCode);
    if (!ownerFacultyId)
      throw new Error(`Missing owner unit code: ${ownerUnitCode}`);
    const existing = await prisma.course.findUnique({
      where: { courseCode: course.courseCode },
      select: { id: true },
    });
    const row = await prisma.course.upsert({
      where: { courseCode: course.courseCode },
      create: { ...course, ownerFacultyId },
      update: {},
      select: { id: true, courseName: true, credits: true },
    });
    result.courseIds.set(course.courseCode, row.id);
    result.courses.set(course.courseCode, {
      courseName: row.courseName,
      credits: row.credits.toString(),
    });
    result.counts.courses[existing ? 'skipped' : 'created']++;
  }
  for (const { legacyCode, ...semester } of catalog.semesters) {
    let row = await prisma.semester.findUnique({
      where: { semesterCode: semester.semesterCode },
    });
    if (row) {
      // A semester already in the database keeps its date: the Phòng Đào tạo may have corrected it on MH-10.
      result.counts.semesters.skipped++;
      const existing = row.startDate ? toIsoDay(row.startDate) : null;
      if (existing !== semester.startDate)
        result.semesterDateDifferences.push({
          semesterCode: semester.semesterCode,
          existing,
          legacy: semester.startDate,
        });
    } else {
      const collision = await prisma.semester.findUnique({
        where: {
          academicYear_termInYear: {
            academicYear: semester.academicYear,
            termInYear: semester.termInYear,
          },
        },
        select: { semesterCode: true },
      });
      if (collision)
        throw new Error(
          `Semester code ${semester.semesterCode} collides with ${collision.semesterCode}`,
        );
      row = await prisma.semester.create({
        data: { ...semester, startDate: fromIsoDay(semester.startDate) },
      });
      result.counts.semesters.created++;
    }
    result.semesterIds.set(semester.semesterCode, {
      id: row.id,
      startDate: row.startDate,
    });
    result.semesterIdsByLegacyCode.set(legacyCode, row.id);
  }
  for (const cohort of catalog.cohorts) {
    const existing = await prisma.cohort.findUnique({
      where: { cohortCode: cohort.cohortCode },
      select: { id: true },
    });
    const row = await prisma.cohort.upsert({
      where: { cohortCode: cohort.cohortCode },
      create: cohort,
      update: {},
    });
    result.cohortIds.set(cohort.cohortCode, row.id);
    result.counts.cohorts[existing ? 'skipped' : 'created']++;
  }
  const relationCounts = await prisma.$transaction(
    async (tx) => {
      await lockRequisiteGraph(tx);
      const edges = await tx.courseRelation.findMany({
        where: { relationType: { in: [...CYCLE_CHECKED_TYPES] } },
        select: { sourceCourseId: true, targetCourseId: true },
      });
      const counts = { created: 0, skipped: 0, cycle: 0 };
      for (const relation of catalog.relations) {
        const sourceCourseId = result.courseIds.get(relation.sourceCourseCode);
        const targetCourseId = result.courseIds.get(relation.targetCourseCode);
        if (!sourceCourseId || !targetCourseId)
          throw new Error(
            `Missing catalog relation course codes: ${relation.sourceCourseCode}:${relation.targetCourseCode}`,
          );
        const key = {
          sourceCourseId,
          targetCourseId,
          relationType: relation.relationType,
        };
        const existing = await tx.courseRelation.findUnique({
          where: { sourceCourseId_targetCourseId_relationType: key },
          select: { id: true },
        });
        const checked = CYCLE_CHECKED_TYPES.includes(relation.relationType);
        if (!existing && checked && findRequisiteCycle(edges, key)) {
          counts.skipped++;
          counts.cycle++;
          continue;
        }
        await tx.courseRelation.upsert({
          where: { sourceCourseId_targetCourseId_relationType: key },
          create: key,
          update: {},
        });
        counts[existing ? 'skipped' : 'created']++;
        if (!existing && checked)
          edges.push({ sourceCourseId, targetCourseId });
      }
      return counts;
    },
    { timeout: DUT_RELATION_TX_TIMEOUT_MS },
  );
  result.counts.relations = {
    created: relationCounts.created,
    skipped: relationCounts.skipped,
  };
  result.relationsCreated = relationCounts.created;
  result.relationsSkippedCycle = relationCounts.cycle;
  return result;
}
