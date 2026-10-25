import type {
  Prisma,
  PrismaClient,
} from '../../../../src/generated/prisma/client.js';
import { todayDate } from '../../../../src/shared/time/today.js';
import type { DutProgram, DutProgramsFile, DutVersion } from '../dut-data.js';
import { releasedStatuses } from '../legacy-mapping.js';
import type { CatalogSeedResult } from './seed-catalog.js';

export const DUT_PROGRAM_TX_TIMEOUT_MS = 60_000;
export interface ProgramsSeedResult {
  created: string[];
  skippedExisting: string[];
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
  const result: ProgramsSeedResult = { created: [], skippedExisting: [] };
  const today = todayDate();
  for (const program of file.programs) {
    const existing = await prisma.program.findUnique({
      where: { programCode: program.programCode },
      select: { id: true },
    });
    if (existing) {
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
