import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  CourseStatus,
  PrismaClient,
  ProgramStatus,
  ProgramVersionStatus,
  ScopeType,
  SyllabusStatus,
  type Prisma,
} from '../src/generated/prisma/client.js';
import { normalizeUsername } from '../src/shared/auth/username.js';
import { HOME_FACULTY_CODE } from '../src/shared/org-units/home-faculty.js';
import { todayDate } from '../src/shared/time/today.js';
import { seedMajors } from './seed-data/majors.js';
import { ORG_UNIT_CODES } from './seed-data/org-units.js';
import { ROLE_CODES } from './seed-data/roles.js';
import type {
  DutGroup,
  DutItem,
  DutRequisite,
  DutVersion,
} from './seed-data/dut/dut-data.js';
import type {
  ExtraFacultiesFile,
  ExtraProgram,
} from './seed-data/dut/extract/extract-extra.js';
import type { TrackShowcaseProgram } from './seed-data/dut/extract/extra-program-map.js';
import { releasedStatuses } from './seed-data/dut/legacy-mapping.js';
import {
  seedDutCatalog,
  type CatalogSeedResult,
} from './seed-data/dut/load/seed-catalog.js';
import { DUT_PROGRAM_TX_TIMEOUT_MS } from './seed-data/dut/load/seed-programs.js';

const BASE_SEED_REQUIRED =
  'The base seed has not run: run `pnpm prisma:seed` first, then `pnpm db:seed:extra`';

const PLACEHOLDER_SYLLABUS =
  '<p><em>Đề cương mẫu cho bản demo.</em> Nội dung chính thức của học phần chưa được nhập vào hệ thống.</p>';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

function requiredValue<Value>(
  values: ReadonlyMap<string, Value>,
  code: string,
  kind: string,
): Value {
  const value = values.get(code);
  if (value === undefined) throw new Error(`Missing ${kind} code: ${code}`);
  return value;
}

async function findPublisherId(): Promise<string> {
  const assignment = await prisma.roleAssignment.findFirst({
    where: {
      role: { roleCode: ROLE_CODES.R1 },
      scopeType: ScopeType.SYSTEM,
      revokedAt: null,
    },
    orderBy: [{ user: { createdAt: 'asc' } }, { userId: 'asc' }],
    select: { userId: true },
  });
  if (!assignment) throw new Error(BASE_SEED_REQUIRED);
  return assignment.userId;
}

async function writeItemsAndRequisites(
  tx: Prisma.TransactionClient,
  params: {
    versionId: string;
    trackId: string | null;
    groups: readonly DutGroup[];
    items: readonly DutItem[];
    requisites: readonly DutRequisite[];
    catalog: Pick<CatalogSeedResult, 'courseIds' | 'courses'>;
    released: boolean;
  },
): Promise<void> {
  const { versionId, trackId, groups, items, requisites, catalog, released } =
    params;
  const createdGroups = groups.length
    ? await tx.electiveGroup.createManyAndReturn({
        data: groups.map((group) => ({ versionId, trackId, ...group })),
        select: { id: true, groupCode: true },
      })
    : [];
  const groupIds = new Map(
    createdGroups.map((group) => [group.groupCode, group.id]),
  );
  const createdItems = items.length
    ? await tx.curriculumItem.createManyAndReturn({
        data: items.map((item) => ({
          versionId,
          trackId,
          courseId: requiredValue(catalog.courseIds, item.courseCode, 'course'),
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
          ...(released
            ? {
                courseNameSnapshot: requiredValue(
                  catalog.courses,
                  item.courseCode,
                  'course',
                ).courseName,
                creditsSnapshot: requiredValue(
                  catalog.courses,
                  item.courseCode,
                  'course',
                ).credits,
              }
            : {}),
        })),
        select: { id: true, courseId: true },
      })
    : [];
  const itemIds = new Map(createdItems.map((item) => [item.courseId, item.id]));
  if (requisites.length) {
    await tx.curriculumRequisite.createMany({
      data: requisites.map((req) => ({
        itemId: requiredValue(
          itemIds,
          requiredValue(catalog.courseIds, req.targetCourseCode, 'target course'),
          'curriculum item',
        ),
        sourceCourseId: requiredValue(
          catalog.courseIds,
          req.sourceCourseCode,
          'source course',
        ),
        relationType: req.relationType,
      })),
    });
  }
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

async function writeExtraProgram(
  tx: Prisma.TransactionClient,
  program: ExtraProgram,
  ctx: {
    facultyId: string;
    majorId: string | null;
    publisherId: string;
    catalog: CatalogSeedResult;
    today: Date;
  },
): Promise<void> {
  const row = await tx.program.create({
    data: {
      programCode: program.programCode,
      facultyId: ctx.facultyId,
      majorId: ctx.majorId,
      degreeLevel: program.degreeLevel,
    },
  });
  const released = program.versions
    .filter((v) => v.startSemesterCode !== null)
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
      select: { id: true },
    });
    await writeItemsAndRequisites(tx, {
      versionId: version.id,
      trackId: null,
      groups: entry.version.groups,
      items: entry.version.items,
      requisites: entry.version.requisites,
      catalog: ctx.catalog,
      released: true,
    });
    if (entry.version.cohortCode) {
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
    }
    previousVersionId = version.id;
  }
  for (const draft of program.versions.filter(
    (v) => v.startSemesterCode === null,
  )) {
    const version = await tx.programVersion.create({
      data: { programId: row.id, ...versionDescription(draft) },
      select: { id: true },
    });
    await writeItemsAndRequisites(tx, {
      versionId: version.id,
      trackId: null,
      groups: draft.groups,
      items: draft.items,
      requisites: draft.requisites,
      catalog: ctx.catalog,
      released: false,
    });
  }
}

async function seedTrackShowcase(
  showcase: TrackShowcaseProgram,
  ctx: {
    facultyId: string;
    majorId: string | null;
    publisherId: string;
    catalog: CatalogSeedResult;
  },
): Promise<{ created: boolean; trackCount: number }> {
  const existing = await prisma.program.findUnique({
    where: { programCode: showcase.programCode },
    select: { id: true },
  });
  if (existing) {
    return { created: false, trackCount: showcase.tracks.length };
  }
  const semester = requiredValue(
    ctx.catalog.semesterIds,
    showcase.startSemesterCode,
    'semester',
  );
  if (!semester.startDate) {
    throw new Error(
      `Missing start date for showcase semester ${showcase.startSemesterCode}`,
    );
  }
  const publishedAt = semester.startDate;

  await prisma.$transaction(
    async (tx) => {
      const program = await tx.program.create({
        data: {
          programCode: showcase.programCode,
          facultyId: ctx.facultyId,
          majorId: ctx.majorId,
          degreeLevel: showcase.degreeLevel,
        },
        select: { id: true },
      });
      const version = await tx.programVersion.create({
        data: {
          programId: program.id,
          versionNumber: '1.0',
          status: ProgramVersionStatus.ACTIVE,
          programName: showcase.programName,
          majorCode: showcase.majorCode,
          majorName: showcase.majorName,
          semesterCount: showcase.semesterCount,
          totalCredits: showcase.totalCredits,
          compulsoryCredits: showcase.compulsoryCredits,
          electiveCredits: showcase.electiveCredits,
          effectiveSemesterId: semester.id,
          publishedById: ctx.publisherId,
          publishedAt,
          createdAt: publishedAt,
        },
        select: { id: true },
      });

      // Common core (trackId = null)
      await writeItemsAndRequisites(tx, {
        versionId: version.id,
        trackId: null,
        groups: showcase.commonGroups,
        items: showcase.commonItems,
        requisites: showcase.commonRequisites,
        catalog: ctx.catalog,
        released: true,
      });

      // 4 ProgramTracks + track-specific items/groups/requisites
      for (const track of showcase.tracks) {
        const trackRow = await tx.programTrack.create({
          data: {
            versionId: version.id,
            trackCode: track.trackCode,
            trackName: track.trackName,
            englishName: track.englishName,
            description: track.description,
            sortOrder: track.sortOrder,
            compulsoryCredits: track.compulsoryCredits,
            electiveCredits: track.electiveCredits,
          },
          select: { id: true },
        });
        await writeItemsAndRequisites(tx, {
          versionId: version.id,
          trackId: trackRow.id,
          groups: track.groups,
          items: track.items,
          requisites: track.requisites,
          catalog: ctx.catalog,
          released: true,
        });
      }

      if (showcase.cohortCode) {
        const cohortId = ctx.catalog.cohortIds.get(showcase.cohortCode);
        if (cohortId) {
          await tx.cohortVersion.create({
            data: {
              cohortId,
              programVersionId: version.id,
              fromSemesterId: semester.id,
            },
          });
        }
      }
    },
    { timeout: DUT_PROGRAM_TX_TIMEOUT_MS },
  );

  return { created: true, trackCount: showcase.tracks.length };
}

async function main() {
  const dataPath = new URL(
    './seed-data/dut/data/extra-faculties.json',
    import.meta.url,
  );
  const data = JSON.parse(readFileSync(dataPath, 'utf8')) as ExtraFacultiesFile;

  const [university, homeFaculty] = await Promise.all([
    prisma.orgUnit.findUnique({
      where: { unitCode: ORG_UNIT_CODES.UNIVERSITY },
      select: { id: true },
    }),
    prisma.orgUnit.findUnique({
      where: { unitCode: ORG_UNIT_CODES.FACULTY_IT },
      select: { id: true },
    }),
  ]);
  if (!university || !homeFaculty) throw new Error(BASE_SEED_REQUIRED);
  const publisherId = await findPublisherId();

  // 1. Upsert all OrgUnits from extra-faculties.json under DHBK with standardized names and isExternal.
  let unitsUpdatedOrCreated = 0;
  for (const unit of data.catalog.units) {
    await prisma.orgUnit.upsert({
      where: { unitCode: unit.unitCode },
      create: {
        unitCode: unit.unitCode,
        unitName: unit.unitName,
        unitType: unit.unitType,
        isExternal: unit.isExternal ?? false,
        parentUnitId: university.id,
      },
      update: {
        unitName: unit.unitName,
        isExternal: unit.isExternal ?? false,
      },
    });
    unitsUpdatedOrCreated++;
  }

  // 2. Seed/update national majors (adds 7480106 and links DUT-106 / DUT-121 faculties).
  await seedMajors(prisma);

  // 3. Seed missing semesters, cohorts, courses, and course relations idempotently.
  const catalog = await seedDutCatalog(prisma, data.catalog, {
    universityId: university.id,
    facultyId: homeFaculty.id,
  });

  // Resolve OrgUnits and Majors for program creation.
  const [allUnits, allMajors] = await Promise.all([
    prisma.orgUnit.findMany({ select: { id: true, unitCode: true } }),
    prisma.major.findMany({ select: { id: true, majorCode: true } }),
  ]);
  const unitByCode = new Map(allUnits.map((u) => [u.unitCode, u.id]));
  const majorByCode = new Map(allMajors.map((m) => [m.majorCode, m.id]));

  // 4. Seed all missing extra programs + versions + curriculum items + requisites + cohort versions.
  const today = todayDate();
  const createdPrograms: string[] = [];
  const skippedPrograms: string[] = [];
  for (const program of data.programs) {
    const existing = await prisma.program.findUnique({
      where: { programCode: program.programCode },
      select: { id: true },
    });
    if (existing) {
      skippedPrograms.push(program.programCode);
      continue;
    }
    const facultyId = requiredValue(
      unitByCode,
      program.facultyUnitCode,
      'faculty unit',
    );
    const majorId = majorByCode.get(program.majorCode) ?? null;
    await prisma.$transaction(
      (tx) =>
        writeExtraProgram(tx, program, {
          facultyId,
          majorId,
          publisherId,
          catalog,
          today,
        }),
      { timeout: DUT_PROGRAM_TX_TIMEOUT_MS },
    );
    createdPrograms.push(program.programCode);
  }

  // 5. Seed CNTT-CN-DH ProgramTrack showcase.
  const showcaseFacultyId = requiredValue(
    unitByCode,
    data.trackShowcase.facultyUnitCode || HOME_FACULTY_CODE,
    'showcase faculty unit',
  );
  const showcaseMajorId =
    majorByCode.get(data.trackShowcase.majorCode.replace(/[^0-9].*$/, '')) ??
    null;
  const showcaseResult = await seedTrackShowcase(data.trackShowcase, {
    facultyId: showcaseFacultyId,
    majorId: showcaseMajorId,
    publisherId,
    catalog,
  });

  // 6. Mark legacy discontinued pre-2020 CNTT programs (*-CU-*) as ProgramStatus.INACTIVE.
  const inactivated = await prisma.program.updateMany({
    where: {
      programCode: { startsWith: 'CNTT-', contains: '-CU-' },
      status: { not: ProgramStatus.INACTIVE },
    },
    data: { status: ProgramStatus.INACTIVE },
  });

  // 7. Give newly created courses without a syllabus a placeholder DRAFT syllabus,
  //    and assign demo as director for ACTIVE programs without an active director (if demo exists).
  const coursesWithoutSyllabus = await prisma.course.findMany({
    where: {
      status: { not: CourseStatus.CANCELLED },
      syllabi: { none: { sourceRequestId: null } },
    },
    select: { id: true },
  });
  if (coursesWithoutSyllabus.length > 0) {
    await prisma.syllabus.createMany({
      data: coursesWithoutSyllabus.map((course) => ({
        courseId: course.id,
        revisionNumber: 1,
        status: SyllabusStatus.DRAFT,
        courseDescription: PLACEHOLDER_SYLLABUS,
      })),
    });
  }

  const demoUsername = normalizeUsername(process.env.DEMO_USERNAME ?? 'demo');
  const demo = await prisma.user.findUnique({
    where: { username: demoUsername },
    select: { id: true },
  });
  let demoDirectorsAdded = 0;
  if (demo) {
    const activeWindow = {
      revokedAt: null,
      validFrom: { lte: today },
      OR: [{ validTo: null }, { validTo: { gte: today } }],
    };
    const programsNeedingDirector = await prisma.program.findMany({
      where: {
        status: ProgramStatus.ACTIVE,
        directors: { none: activeWindow },
      },
      select: { id: true },
    });
    if (programsNeedingDirector.length > 0) {
      await prisma.programDirectorAssignment.createMany({
        data: programsNeedingDirector.map((program) => ({
          programId: program.id,
          directorId: demo.id,
          validFrom: today,
          assignedById: demo.id,
        })),
      });
      demoDirectorsAdded = programsNeedingDirector.length;
    }
  }

  console.log(
    `Extra faculties seed done: units upserted=${unitsUpdatedOrCreated}, courses created=${catalog.counts.courses.created} (skipped ${catalog.counts.courses.skipped}), relations created=${catalog.counts.relations.created} (cycle skipped ${catalog.relationsSkippedCycle}), semesters created=${catalog.counts.semesters.created}, cohorts created=${catalog.counts.cohorts.created}`,
  );
  console.log(
    `Programs: created=${createdPrograms.length}, skipped=${skippedPrograms.length}; track showcase ${data.trackShowcase.programCode}: ${showcaseResult.created ? `created (${showcaseResult.trackCount} tracks)` : 'skipped (already exists)'}`,
  );
  console.log(
    `Legacy CNTT *-CU-* marked INACTIVE: ${inactivated.count}; placeholder syllabi added: ${coursesWithoutSyllabus.length}; demo directors assigned: ${demoDirectorsAdded}`,
  );
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
