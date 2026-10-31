import type {
  Prisma,
  PrismaClient,
} from '../../../../src/generated/prisma/client.js';
import { todayDate } from '../../../../src/shared/time/today.js';
import type { DutProgram, DutProgramsFile, DutVersion } from '../dut-data.js';
import { releasedStatuses } from '../legacy-mapping.js';
import type { CatalogSeedResult } from './seed-catalog.js';

export const DUT_PROGRAM_TX_TIMEOUT_MS = 60_000;

// The DUT source has no legal decision numbers. Issued versions still need one (applied-version rules refuse an
// issued version without it), so the seed writes a labelled placeholder that the Khoa replaces later.
export function dutDecisionPlaceholder(
  programCode: string,
  versionNumber: string,
): string {
  return `DUT-${programCode}-${versionNumber}`;
}

const ISSUED_STATUSES = ['PENDING', 'ACTIVE', 'HISTORICAL'] as const;
export interface ProgramsSeedResult {
  created: string[];
  skippedExisting: string[];
  backfilledDecisions: number;
}
interface ProgramSeedContext {
  facultyId: string;
  publisherId: string;
  catalog: CatalogSeedResult;
}

function requiredValue<Value>(
  values: ReadonlyMap<string, Value>,
  code: string,
  kind: string,
): Value {
  const value = values.get(code);
  if (value === undefined) throw new Error(`Missing ${kind} code: ${code}`);
  return value;
}

async function writeVersionContent(
  tx: Prisma.TransactionClient,
  versionId: string,
  version: DutVersion,
  courseIds: ReadonlyMap<string, string>,
): Promise<void> {
  const groups = version.groups.length
    ? await tx.electiveGroup.createManyAndReturn({
        data: version.groups.map((group) => ({ versionId, ...group })),
        select: { id: true, groupCode: true },
      })
    : [];
  const groupIds = new Map(groups.map((group) => [group.groupCode, group.id]));
  const items = version.items.length
    ? await tx.curriculumItem.createManyAndReturn({
        data: version.items.map((item) => ({
          versionId,
          courseId: requiredValue(courseIds, item.courseCode, 'course'),
          plannedSemester: item.plannedSemester,
          sortOrder: item.sortOrder,
          isElective: item.isElective,
          electiveGroupId:
            item.groupCode === null
              ? null
              : requiredValue(groupIds, item.groupCode, 'elective group'),
          htDa: item.htDa,
          tqDa: item.tqDa,
          note: item.note,
        })),
        select: { id: true, courseId: true },
      })
    : [];
  const itemIds = new Map(items.map((item) => [item.courseId, item.id]));
  if (version.requisites.length)
    await tx.curriculumRequisite.createMany({
      data: version.requisites.map((requisite) => ({
        itemId: requiredValue(
          itemIds,
          requiredValue(courseIds, requisite.targetCourseCode, 'target course'),
          'curriculum item',
        ),
        sourceCourseId: requiredValue(
          courseIds,
          requisite.sourceCourseCode,
          'source course',
        ),
        relationType: requisite.relationType,
      })),
    });
}

function versionDescription(version: DutVersion) {
  return {
    programName: version.programName,
    majorCode: version.majorCode,
    majorName: version.majorName,
    semesterCount: version.semesterCount,
    totalCredits: version.totalCredits,
    compulsoryCredits: version.compulsoryCredits,
    electiveCredits: version.electiveCredits,
  };
}

async function writeProgram(
  tx: Prisma.TransactionClient,
  program: DutProgram,
  ctx: ProgramSeedContext & { today: Date },
): Promise<void> {
  const row = await tx.program.create({
    data: {
      programCode: program.programCode,
      facultyId: ctx.facultyId,
      degreeLevel: program.degreeLevel,
    },
  });
  const released = program.versions
    .filter((version) => version.startSemesterCode !== null)
    .map((version) => {
      const semester = requiredValue(
        ctx.catalog.semesterIds,
        version.startSemesterCode!,
        'semester',
      );
      if (!semester.startDate)
        throw new Error(
          `Missing semester start date: ${version.startSemesterCode}`,
        );
      return { version, semesterId: semester.id, start: semester.startDate };
    })
    .sort(
      (left, right) =>
        left.start.getTime() - right.start.getTime() ||
        left.version.frameCode.localeCompare(right.version.frameCode),
    );
  const statuses = releasedStatuses(
    released.map((entry) => entry.start),
    ctx.today,
  );
  let previousVersionId: string | null = null;
  for (const [index, entry] of released.entries()) {
    const version: { id: string } = await tx.programVersion.create({
      data: {
        programId: row.id,
        ...versionDescription(entry.version),
        versionNumber: `${index + 1}.0`,
        decisionNumber: dutDecisionPlaceholder(
          program.programCode,
          `${index + 1}.0`,
        ),
        status: statuses[index],
        effectiveSemesterId: entry.semesterId,
        publishedById: ctx.publisherId,
        publishedAt: entry.start,
        createdAt: entry.start,
        previousVersionId,
      },
    });
    await writeVersionContent(
      tx,
      version.id,
      entry.version,
      ctx.catalog.courseIds,
    );
    if (entry.version.cohortCode)
      await tx.cohortVersion.create({
        data: {
          cohortId: requiredValue(
            ctx.catalog.cohortIds,
            entry.version.cohortCode,
            'cohort',
          ),
          programVersionId: version.id,
          fromSemesterId: entry.semesterId,
        },
      });
    previousVersionId = version.id;
  }
  for (const draft of program.versions.filter(
    (version) => version.startSemesterCode === null,
  )) {
    const version = await tx.programVersion.create({
      data: { programId: row.id, ...versionDescription(draft) },
    });
    await writeVersionContent(tx, version.id, draft, ctx.catalog.courseIds);
  }
}

export async function seedDutPrograms(
  prisma: PrismaClient,
  file: DutProgramsFile,
  ctx: ProgramSeedContext,
): Promise<ProgramsSeedResult> {
  const result: ProgramsSeedResult = {
    created: [],
    skippedExisting: [],
    backfilledDecisions: 0,
  };
  const today = todayDate();
  for (const program of file.programs) {
    const existing = await prisma.program.findUnique({
      where: { programCode: program.programCode },
      select: { id: true },
    });
    if (existing) {
      result.backfilledDecisions += await backfillDecisionNumbers(
        prisma,
        existing.id,
        program.programCode,
      );
      result.skippedExisting.push(program.programCode);
      continue;
    }
    await prisma.$transaction(
      (tx) => writeProgram(tx, program, { ...ctx, today }),
      { timeout: DUT_PROGRAM_TX_TIMEOUT_MS },
    );
    result.created.push(program.programCode);
  }
  return result;
}

// Re-running the seed on an older database fills only the missing placeholders; a number entered by hand stays.
async function backfillDecisionNumbers(
  prisma: PrismaClient,
  programId: string,
  programCode: string,
): Promise<number> {
  const missing = await prisma.programVersion.findMany({
    where: {
      programId,
      decisionNumber: null,
      sourceRequestId: null,
      versionNumber: { not: null },
      status: { in: [...ISSUED_STATUSES] },
    },
    select: { id: true, versionNumber: true },
  });
  for (const version of missing)
    await prisma.programVersion.update({
      where: { id: version.id },
      data: {
        decisionNumber: dutDecisionPlaceholder(
          programCode,
          version.versionNumber!,
        ),
      },
    });
  return missing.length;
}
