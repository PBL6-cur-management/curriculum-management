import {
  CourseRelationType,
  DegreeLevel,
  Prisma,
  ProgramVersionStatus,
  type PrismaClient,
} from '../../src/generated/prisma/client.js';
import { ORG_UNIT_CODES } from '../seed-data/org-units.js';
import { SEED_PROGRAM_CODES } from '../seed-data/programs.js';
import { DEMO_COURSES, DEMO_RELATIONS } from './catalog.js';

export const DEMO_PROGRAM_CODES = {
  MAIN: SEED_PROGRAM_CODES.COMPUTER_ENGINEERING,
  SECOND: '1024035',
} as const;

interface DemoRow {
  course: string;
  semester: number;
  order: number;
  block: string;
  group?: string;
}

interface DemoProgram {
  programCode: string;
  semesterCount: number;
  group: { groupCode: string; groupName: string; minCredits: string };
  rows: readonly DemoRow[];
}

// Reduced frames: enough rows to walk every screen, not the Khoa's real 150-credit frame (Q-11).
// Every course of the frame has a Draft syllabus (see syllabi.ts), so the consistency check finds no Error.
export const MAIN_PROGRAM: DemoProgram = {
  programCode: DEMO_PROGRAM_CODES.MAIN,
  semesterCount: 10,
  group: {
    groupCode: 'TC1',
    groupName: 'Tự chọn chuyên ngành 1',
    minCredits: '6',
  },
  rows: [
    { course: 'MAT101', semester: 1, order: 1, block: 'DC' },
    { course: 'ITS100', semester: 1, order: 2, block: 'DC' },
    { course: 'PRG101', semester: 1, order: 3, block: 'CSN' },
    { course: 'DMA101', semester: 2, order: 1, block: 'DC' },
    { course: 'OOP201', semester: 2, order: 2, block: 'CSN' },
    { course: 'DSA201', semester: 3, order: 1, block: 'CSN' },
    { course: 'DBS201', semester: 3, order: 2, block: 'CSN' },
    { course: 'DBS202', semester: 3, order: 3, block: 'CSN' },
    { course: 'NET201', semester: 3, order: 4, block: 'CSN' },
    { course: 'OSY201', semester: 4, order: 1, block: 'CSN' },
    { course: 'SWE301', semester: 4, order: 2, block: 'CN' },
    { course: 'AIT301', semester: 5, order: 1, block: 'CN', group: 'TC1' },
    { course: 'NET301', semester: 5, order: 2, block: 'CN', group: 'TC1' },
    { course: 'WEB301', semester: 5, order: 3, block: 'CN', group: 'TC1' },
    { course: 'DBS301', semester: 5, order: 4, block: 'CN', group: 'TC1' },
    { course: 'SWE302', semester: 6, order: 1, block: 'CN', group: 'TC1' },
  ],
};

export const SECOND_PROGRAM: DemoProgram & {
  programName: string;
  majorCode: string;
  majorName: string;
} = {
  programCode: DEMO_PROGRAM_CODES.SECOND,
  programName: 'Công nghệ thông tin',
  majorCode: '7480201',
  majorName: 'Công nghệ thông tin',
  semesterCount: 8,
  group: {
    groupCode: 'TC1',
    groupName: 'Tự chọn bổ trợ',
    minCredits: '3',
  },
  rows: [
    { course: 'PRG101', semester: 1, order: 1, block: 'CSN' },
    { course: 'DMA101', semester: 1, order: 2, block: 'DC' },
    { course: 'OOP201', semester: 2, order: 1, block: 'CSN' },
    { course: 'DBS201', semester: 3, order: 1, block: 'CSN' },
    { course: 'WEB301', semester: 4, order: 1, block: 'CN', group: 'TC1' },
    { course: 'SWE302', semester: 4, order: 2, block: 'CN', group: 'TC1' },
  ],
};

const DEMO_PLACEHOLDER_PREFIX = 'DEMO';
const ORDER_TYPES: readonly CourseRelationType[] = [
  CourseRelationType.PRIOR,
  CourseRelationType.PREREQUISITE,
  CourseRelationType.COREQUISITE,
];
const credits = new Map(DEMO_COURSES.map((c) => [c.courseCode, c.credits]));

// Compulsory credits and the group's required credits (its minimum), the way the consistency check computes them.
export function declaredCredits(program: DemoProgram): {
  total: string;
  compulsory: string;
  elective: string;
} {
  const compulsory = program.rows
    .filter((row) => !row.group)
    .reduce(
      (sum, row) => sum.plus(credits.get(row.course)!),
      new Prisma.Decimal(0),
    );
  const elective = new Prisma.Decimal(program.group.minCredits);
  return {
    total: compulsory.plus(elective).toString(),
    compulsory: compulsory.toString(),
    elective: elective.toString(),
  };
}

// The Draft of a program (not a request's working copy, not a correction).
const draftWhere = (programId: string) => ({
  programId,
  status: ProgramVersionStatus.DRAFT,
  sourceRequestId: null,
  correctionOfId: null,
});

// The base seed's placeholder frame (DEMO* courses only) is replaced; a frame anyone has edited is left alone.
async function dropPlaceholderFrame(
  prisma: PrismaClient,
  versionId: string,
): Promise<boolean> {
  const items = await prisma.curriculumItem.findMany({
    where: { versionId },
    select: { course: { select: { courseCode: true } } },
  });
  if (
    items.length === 0 ||
    !items.every((i) => i.course.courseCode.startsWith(DEMO_PLACEHOLDER_PREFIX))
  ) {
    return false;
  }
  const placeholder = {
    courseCode: { startsWith: DEMO_PLACEHOLDER_PREFIX },
  } as const;
  const used = await prisma.course.count({
    where: {
      ...placeholder,
      OR: [{ syllabi: { some: {} } }, { changeRequests: { some: {} } }],
    },
  });
  await prisma.$transaction([
    prisma.curriculumItem.deleteMany({ where: { versionId } }),
    prisma.electiveGroup.deleteMany({ where: { versionId } }),
    ...(used === 0
      ? [
          prisma.courseRelation.deleteMany({
            where: {
              OR: [
                { sourceCourse: placeholder },
                { targetCourse: placeholder },
              ],
            },
          }),
          prisma.course.deleteMany({
            where: {
              ...placeholder,
              curriculumItems: { none: {} },
              curriculumRequisites: { none: {} },
            },
          }),
        ]
      : []),
  ]);
  return true;
}

async function writeFrame(
  prisma: PrismaClient,
  versionId: string,
  program: DemoProgram,
): Promise<void> {
  const group = await prisma.electiveGroup.upsert({
    where: {
      versionId_groupCode: { versionId, groupCode: program.group.groupCode },
    },
    create: { versionId, ...program.group },
    update: {},
  });
  const courses = await prisma.course.findMany({
    where: { courseCode: { in: program.rows.map((row) => row.course) } },
    select: { id: true, courseCode: true },
  });
  const courseId = new Map(courses.map((c) => [c.courseCode, c.id]));
  const itemId = new Map<string, string>();
  for (const row of program.rows) {
    const item = await prisma.curriculumItem.upsert({
      where: {
        versionId_courseId: { versionId, courseId: courseId.get(row.course)! },
      },
      create: {
        versionId,
        courseId: courseId.get(row.course)!,
        plannedSemester: row.semester,
        sortOrder: row.order,
        blockSymbol: row.block,
        isElective: row.group !== undefined,
        electiveGroupId: row.group ? group.id : null,
      },
      update: {},
    });
    itemId.set(row.course, item.id);
  }
  // The row copy of each catalog relation whose source course is in the same frame.
  for (const relation of DEMO_RELATIONS) {
    if (!ORDER_TYPES.includes(relation.relationType)) continue;
    const target = itemId.get(relation.target);
    const source = courseId.get(relation.source);
    if (!target || !source || !itemId.has(relation.source)) continue;
    await prisma.curriculumRequisite.upsert({
      where: {
        itemId_sourceCourseId_relationType: {
          itemId: target,
          sourceCourseId: source,
          relationType: relation.relationType,
        },
      },
      create: {
        itemId: target,
        sourceCourseId: source,
        relationType: relation.relationType,
        minScore: relation.minScore ?? null,
      },
      update: {},
    });
  }
}

// Returns the ids of the two Draft versions, for the outcome step.
export async function seedDemoPrograms(
  prisma: PrismaClient,
): Promise<{ mainVersionId: string; secondVersionId: string }> {
  const faculty = await prisma.orgUnit.findUniqueOrThrow({
    where: { unitCode: ORG_UNIT_CODES.FACULTY_IT },
  });
  const main = await prisma.program.findUniqueOrThrow({
    where: { programCode: MAIN_PROGRAM.programCode },
  });
  const mainDraft = await prisma.programVersion.findFirst({
    where: draftWhere(main.id),
  });
  if (!mainDraft) {
    throw new Error(
      `Program ${MAIN_PROGRAM.programCode} has no Draft; the demo frame is written only into a Draft`,
    );
  }
  const replaced = await dropPlaceholderFrame(prisma, mainDraft.id);
  const hadFrame =
    (await prisma.curriculumItem.count({
      where: { versionId: mainDraft.id },
    })) > 0;
  await writeFrame(prisma, mainDraft.id, MAIN_PROGRAM);
  if (replaced || !hadFrame) {
    const declared = declaredCredits(MAIN_PROGRAM);
    await prisma.programVersion.update({
      where: { id: mainDraft.id },
      data: {
        semesterCount: MAIN_PROGRAM.semesterCount,
        totalCredits: declared.total,
        compulsoryCredits: declared.compulsory,
        electiveCredits: declared.elective,
      },
    });
  }

  const second = await prisma.program.upsert({
    where: { programCode: SECOND_PROGRAM.programCode },
    create: {
      programCode: SECOND_PROGRAM.programCode,
      facultyId: faculty.id,
      degreeLevel: DegreeLevel.BACHELOR,
    },
    update: {},
  });
  let secondDraft = await prisma.programVersion.findFirst({
    where: draftWhere(second.id),
  });
  if (!secondDraft) {
    const hasVersion = await prisma.programVersion.findFirst({
      where: { programId: second.id },
    });
    if (hasVersion) {
      throw new Error(
        `Program ${SECOND_PROGRAM.programCode} has versions but no Draft; the demo frame is written only into a Draft`,
      );
    }
    const declared = declaredCredits(SECOND_PROGRAM);
    secondDraft = await prisma.programVersion.create({
      data: {
        programId: second.id,
        programName: SECOND_PROGRAM.programName,
        majorCode: SECOND_PROGRAM.majorCode,
        majorName: SECOND_PROGRAM.majorName,
        semesterCount: SECOND_PROGRAM.semesterCount,
        totalCredits: declared.total,
        compulsoryCredits: declared.compulsory,
        electiveCredits: declared.elective,
      },
    });
  }
  await writeFrame(prisma, secondDraft.id, SECOND_PROGRAM);
  return { mainVersionId: mainDraft.id, secondVersionId: secondDraft.id };
}
