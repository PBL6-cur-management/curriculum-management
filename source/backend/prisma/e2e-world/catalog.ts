import {
  CourseRelationType,
  CourseType,
  OrgUnitType,
  type PrismaClient,
} from '../../src/generated/prisma/client.js';
import { ORG_UNIT_CODES } from '../seed-data/org-units.js';

export const DEMO_GROUP_CODES = {
  KHMT: 'E2E-KHMT',
  CNPM: 'E2E-CNPM',
  HTTT: 'E2E-HTTT',
  MMT: 'E2E-MMT',
} as const;
type GroupCode = (typeof DEMO_GROUP_CODES)[keyof typeof DEMO_GROUP_CODES];

// A second faculty, only so one course can be "của khoa khác".
const OTHER_FACULTY = {
  unitCode: 'E2E-KHOA_KHCB',
  unitName: 'Khoa Khoa học cơ bản',
} as const;

const GROUPS: readonly { groupCode: GroupCode; groupName: string }[] = [
  { groupCode: DEMO_GROUP_CODES.KHMT, groupName: 'Khoa học máy tính' },
  { groupCode: DEMO_GROUP_CODES.CNPM, groupName: 'Công nghệ phần mềm' },
  { groupCode: DEMO_GROUP_CODES.HTTT, groupName: 'Hệ thống thông tin' },
  { groupCode: DEMO_GROUP_CODES.MMT, groupName: 'Mạng và truyền thông' },
];

interface DemoCourse {
  courseCode: string;
  courseName: string;
  englishName: string;
  credits: string;
  courseType: CourseType;
  // null = owned by the other faculty, no subject group.
  group: GroupCode | null;
}

export const DEMO_COURSES: readonly DemoCourse[] = [
  {
    courseCode: 'MAT101',
    courseName: 'Giải tích 1',
    englishName: 'Calculus 1',
    credits: '3',
    courseType: CourseType.THEORY,
    group: null,
  },
  {
    courseCode: 'ITS100',
    courseName: 'Định hướng ngành Công nghệ thông tin',
    englishName: 'Introduction to the IT Profession',
    credits: '0',
    courseType: CourseType.CONDITIONAL,
    group: DEMO_GROUP_CODES.KHMT,
  },
  {
    courseCode: 'PRG101',
    courseName: 'Nhập môn lập trình',
    englishName: 'Introduction to Programming',
    credits: '3',
    courseType: CourseType.THEORY,
    group: DEMO_GROUP_CODES.KHMT,
  },
  {
    courseCode: 'DMA101',
    courseName: 'Toán rời rạc',
    englishName: 'Discrete Mathematics',
    credits: '3',
    courseType: CourseType.THEORY,
    group: DEMO_GROUP_CODES.KHMT,
  },
  {
    courseCode: 'DSA201',
    courseName: 'Cấu trúc dữ liệu và giải thuật',
    englishName: 'Data Structures and Algorithms',
    credits: '3',
    courseType: CourseType.THEORY,
    group: DEMO_GROUP_CODES.KHMT,
  },
  {
    courseCode: 'AIT301',
    courseName: 'Trí tuệ nhân tạo',
    englishName: 'Artificial Intelligence',
    credits: '3',
    courseType: CourseType.THEORY,
    group: DEMO_GROUP_CODES.KHMT,
  },
  {
    courseCode: 'OOP201',
    courseName: 'Lập trình hướng đối tượng',
    englishName: 'Object-Oriented Programming',
    credits: '3',
    courseType: CourseType.THEORY,
    group: DEMO_GROUP_CODES.CNPM,
  },
  {
    courseCode: 'SWE301',
    courseName: 'Nhập môn công nghệ phần mềm',
    englishName: 'Introduction to Software Engineering',
    credits: '3',
    courseType: CourseType.THEORY,
    group: DEMO_GROUP_CODES.CNPM,
  },
  {
    courseCode: 'SWE302',
    courseName: 'Kiểm thử phần mềm',
    englishName: 'Software Testing',
    credits: '2',
    courseType: CourseType.THEORY,
    group: DEMO_GROUP_CODES.CNPM,
  },
  {
    courseCode: 'WEB301',
    courseName: 'Lập trình Web',
    englishName: 'Web Programming',
    credits: '3',
    courseType: CourseType.PRACTICE,
    group: DEMO_GROUP_CODES.CNPM,
  },
  {
    courseCode: 'DBS201',
    courseName: 'Cơ sở dữ liệu',
    englishName: 'Database Systems',
    credits: '3',
    courseType: CourseType.THEORY,
    group: DEMO_GROUP_CODES.HTTT,
  },
  {
    courseCode: 'DBS202',
    courseName: 'Thực hành cơ sở dữ liệu',
    englishName: 'Database Systems Laboratory',
    credits: '1',
    courseType: CourseType.LAB,
    group: DEMO_GROUP_CODES.HTTT,
  },
  {
    courseCode: 'DBS301',
    courseName: 'Hệ quản trị cơ sở dữ liệu',
    englishName: 'Database Management Systems',
    credits: '3',
    courseType: CourseType.THEORY,
    group: DEMO_GROUP_CODES.HTTT,
  },
  {
    courseCode: 'DBS200',
    courseName: 'Cơ sở dữ liệu (chương trình cũ)',
    englishName: 'Database Systems (legacy curriculum)',
    credits: '3',
    courseType: CourseType.THEORY,
    group: DEMO_GROUP_CODES.HTTT,
  },
  {
    courseCode: 'NET201',
    courseName: 'Mạng máy tính',
    englishName: 'Computer Networks',
    credits: '3',
    courseType: CourseType.THEORY,
    group: DEMO_GROUP_CODES.MMT,
  },
  {
    courseCode: 'OSY201',
    courseName: 'Hệ điều hành',
    englishName: 'Operating Systems',
    credits: '3',
    courseType: CourseType.THEORY,
    group: DEMO_GROUP_CODES.MMT,
  },
  {
    courseCode: 'NET301',
    courseName: 'An toàn thông tin',
    englishName: 'Information Security',
    credits: '3',
    courseType: CourseType.THEORY,
    group: DEMO_GROUP_CODES.MMT,
  },
];

// source = studied first, target = has the requirement. The graph is acyclic over PRIOR and PREREQUISITE.
// SWE301, SWE302 and WEB301 have no relation at all: try WEB301 -> SWE302 -> SWE301 -> WEB301 for the loop check.
export const DEMO_RELATIONS: readonly {
  source: string;
  target: string;
  relationType: CourseRelationType;
  minScore?: string;
}[] = [
  {
    source: 'PRG101',
    target: 'DSA201',
    relationType: CourseRelationType.PREREQUISITE,
    minScore: '2',
  },
  {
    source: 'PRG101',
    target: 'OOP201',
    relationType: CourseRelationType.PRIOR,
  },
  {
    source: 'DSA201',
    target: 'AIT301',
    relationType: CourseRelationType.PRIOR,
  },
  {
    source: 'DBS201',
    target: 'DBS301',
    relationType: CourseRelationType.PREREQUISITE,
  },
  {
    source: 'DBS201',
    target: 'DBS202',
    relationType: CourseRelationType.COREQUISITE,
  },
  {
    source: 'NET201',
    target: 'NET301',
    relationType: CourseRelationType.PRIOR,
  },
];

const EQUIVALENCE = {
  groupCode: 'E2E-TD-CSDL',
  note: 'Cơ sở dữ liệu tương đương bản của chương trình cũ',
  courseCodes: ['DBS201', 'DBS200'],
} as const;

export async function seedDemoCatalog(prisma: PrismaClient): Promise<void> {
  const university = await prisma.orgUnit.findUniqueOrThrow({
    where: { unitCode: ORG_UNIT_CODES.UNIVERSITY },
  });
  const homeFaculty = await prisma.orgUnit.findUniqueOrThrow({
    where: { unitCode: ORG_UNIT_CODES.FACULTY_IT },
  });
  const otherFaculty = await prisma.orgUnit.upsert({
    where: { unitCode: OTHER_FACULTY.unitCode },
    create: {
      ...OTHER_FACULTY,
      unitType: OrgUnitType.FACULTY,
      parentUnitId: university.id,
    },
    update: {},
  });
  const groupIds = new Map<string, string>();
  for (const group of GROUPS) {
    const row = await prisma.subjectGroup.upsert({
      where: { groupCode: group.groupCode },
      create: { ...group, facultyId: homeFaculty.id },
      update: {},
    });
    groupIds.set(group.groupCode, row.id);
  }
  const courseIds = new Map<string, string>();
  for (const { group, ...course } of DEMO_COURSES) {
    const row = await prisma.course.upsert({
      where: { courseCode: course.courseCode },
      create: {
        ...course,
        ownerFacultyId: group ? homeFaculty.id : otherFaculty.id,
        ownerGroupId: group ? groupIds.get(group)! : null,
      },
      update: {},
    });
    courseIds.set(course.courseCode, row.id);
  }
  for (const relation of DEMO_RELATIONS) {
    const key = {
      sourceCourseId: courseIds.get(relation.source)!,
      targetCourseId: courseIds.get(relation.target)!,
      relationType: relation.relationType,
    };
    await prisma.courseRelation.upsert({
      where: { sourceCourseId_targetCourseId_relationType: key },
      create: { ...key, minScore: relation.minScore ?? null },
      update: {},
    });
  }
  const equivalence = await prisma.equivalentCourseGroup.upsert({
    where: { groupCode: EQUIVALENCE.groupCode },
    create: { groupCode: EQUIVALENCE.groupCode, note: EQUIVALENCE.note },
    update: {},
  });
  await prisma.course.updateMany({
    where: {
      courseCode: { in: [...EQUIVALENCE.courseCodes] },
      equivalenceGroupId: null,
    },
    data: { equivalenceGroupId: equivalence.id },
  });
}
