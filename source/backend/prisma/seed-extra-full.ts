import 'dotenv/config';
import { createReadStream, existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  AcademicResultStatus,
  CourseStatus,
  CourseType,
  EnrollmentStatus,
  EnrollmentType,
  Prisma,
  PrismaClient,
  ProgramStatus,
  ProgramVersionStatus,
  ScopeType,
  StudentDataSource,
  SubjectGroupMemberRole,
  SyllabusStatus,
  UserStatus,
} from '../src/generated/prisma/client.js';
import { PasswordService } from '../src/shared/password/password.service.js';
import { todayDate } from '../src/shared/time/today.js';
import { ROLE_CODES } from './seed-data/roles.js';
import type { ExtraFacultiesFile } from './seed-data/dut/extract/extract-extra.js';
import type {
  ExtraAssessmentComponentDef,
  ExtraCourseMetadata,
  ExtraPeopleFile,
  ExtraPloTemplate,
  ExtraSyllabiOutcomesFile,
} from './seed-data/dut/extract/extract-extra-full.js';
import { EXTRA_FACULTY_CODES } from './seed-data/dut/extract/extra-program-map.js';
import { cohortFromLegacyCode } from './seed-data/dut/legacy-mapping.js';
import type { DutResult } from './seed-data/dut/people-data.js';

const PLACEHOLDER_MARK = 'Đề cương mẫu cho bản demo';
const PASSING_LETTERS = new Set(['A+', 'A', 'B+', 'B', 'C+', 'C', 'D+', 'D']);
const FAILED_LETTER = 'F';
const RESULT_BATCH_SIZE = 1000;
const STUDENT_BATCH_SIZE = 500;

const SAMPLE_NOTE =
  '<p><em>(Ghi chú: Các mục đánh dấu “mẫu” là nội dung minh họa chuẩn học thuật, có thể cập nhật theo đề cương chính thức của Khoa.)</em></p>';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

interface DemoStaffSpec {
  username: string;
  userCode: string;
  fullName: string;
  facultyUnitCode: string;
  roles: { roleCode: string; scopeType: ScopeType; scopeUnitCode?: string }[];
  coordinatorGroups: string[];
  directorProgramPrefixes: string[];
}

const DEMO_GOVERNANCE_STAFF: readonly DemoStaffSpec[] = [
  {
    username: 'ldk.dtvt',
    userCode: 'LDK-DTVT',
    fullName: 'PGS.TS. Phạm Văn Điện',
    facultyUnitCode: EXTRA_FACULTY_CODES.DTVT,
    roles: [
      {
        roleCode: ROLE_CODES.R2,
        scopeType: ScopeType.UNIT,
        scopeUnitCode: EXTRA_FACULTY_CODES.DTVT,
      },
    ],
    coordinatorGroups: [],
    directorProgramPrefixes: [],
  },
  {
    username: 'ldk.ktr',
    userCode: 'LDK-KTR',
    fullName: 'TS.KTS. Trần Minh Kiến',
    facultyUnitCode: EXTRA_FACULTY_CODES.KTR,
    roles: [
      {
        roleCode: ROLE_CODES.R2,
        scopeType: ScopeType.UNIT,
        scopeUnitCode: EXTRA_FACULTY_CODES.KTR,
      },
    ],
    coordinatorGroups: [],
    directorProgramPrefixes: [],
  },
  {
    username: 'dp.dtvt.dt',
    userCode: 'DP-DTVT-DT',
    fullName: 'TS. Lê Hoàng Mạch',
    facultyUnitCode: EXTRA_FACULTY_CODES.DTVT,
    roles: [
      { roleCode: ROLE_CODES.R3, scopeType: ScopeType.SYSTEM },
      { roleCode: ROLE_CODES.R4, scopeType: ScopeType.SYSTEM },
      { roleCode: ROLE_CODES.R5, scopeType: ScopeType.SYSTEM },
    ],
    coordinatorGroups: ['DTVT-DT', 'DTVT-VT'],
    directorProgramPrefixes: ['DTVT-'],
  },
  {
    username: 'dp.dtvt.ktmt',
    userCode: 'DP-DTVT-KTMT',
    fullName: 'TS. Nguyễn Hữu Nhúng',
    facultyUnitCode: EXTRA_FACULTY_CODES.DTVT,
    roles: [
      { roleCode: ROLE_CODES.R3, scopeType: ScopeType.SYSTEM },
      { roleCode: ROLE_CODES.R4, scopeType: ScopeType.SYSTEM },
      { roleCode: ROLE_CODES.R5, scopeType: ScopeType.SYSTEM },
    ],
    coordinatorGroups: ['DTVT-KTMT'],
    directorProgramPrefixes: ['KTMT-'],
  },
  {
    username: 'dp.ktr.tk',
    userCode: 'DP-KTR-TK',
    fullName: 'ThS.KTS. Võ Thanh Không',
    facultyUnitCode: EXTRA_FACULTY_CODES.KTR,
    roles: [
      { roleCode: ROLE_CODES.R3, scopeType: ScopeType.SYSTEM },
      { roleCode: ROLE_CODES.R4, scopeType: ScopeType.SYSTEM },
      { roleCode: ROLE_CODES.R5, scopeType: ScopeType.SYSTEM },
    ],
    coordinatorGroups: ['KTR-TK', 'KTR-QH'],
    directorProgramPrefixes: ['KTR-'],
  },
];

const FALLBACK_PLO_TEMPLATE: readonly ExtraPloTemplate[] = [
  {
    ploCode: 'PLO1',
    description:
      'Vận dụng kiến thức toán học, khoa học tự nhiên và kiến thức cơ sở ngành để giải quyết các bài toán kỹ thuật.',
    englishDescription:
      'Apply mathematics, natural sciences, and core engineering knowledge to solve engineering problems.',
    competencyGroup: 'Kiến thức nền tảng',
  },
  {
    ploCode: 'PLO2',
    description:
      'Phân tích yêu cầu, thiết kế và phát triển giải pháp kỹ thuật đáp ứng các tiêu chuẩn chuyên ngành.',
    englishDescription:
      'Analyze requirements, design, and develop engineering solutions meeting domain standards.',
    competencyGroup: 'Kiến thức chuyên môn',
  },
  {
    ploCode: 'PLO3',
    description:
      'Tích hợp, triển khai và tối ưu hóa hệ thống kỹ thuật trong điều kiện ràng buộc thực tế.',
    englishDescription:
      'Integrate, deploy, and optimize engineering systems under realistic constraints.',
    competencyGroup: 'Kiến thức chuyên môn',
  },
  {
    ploCode: 'PLO4',
    description:
      'Thiết kế thực nghiệm, đo lường, thu thập và phân tích dữ liệu để đánh giá chất lượng giải pháp.',
    englishDescription:
      'Design experiments, measure, collect, and analyze data to evaluate solution quality.',
    competencyGroup: 'Kỹ năng chuyên môn',
  },
  {
    ploCode: 'PLO5',
    description:
      'Sử dụng thành thạo các công cụ kỹ thuật, phần mềm chuyên dụng và quy trình làm việc hiện đại.',
    englishDescription:
      'Proficiently use modern engineering tools, specialized software, and workflows.',
    competencyGroup: 'Kỹ năng chuyên môn',
  },
  {
    ploCode: 'PLO6',
    description:
      'Làm việc hiệu quả trong nhóm đa ngành và giao tiếp kỹ thuật rõ ràng bằng tiếng Việt và tiếng Anh.',
    englishDescription:
      'Work effectively in multidisciplinary teams and communicate clearly in Vietnamese and English.',
    competencyGroup: 'Kỹ năng mềm',
  },
  {
    ploCode: 'PLO7',
    description:
      'Đánh giá tác động xã hội, môi trường, an toàn và pháp lý của các giải pháp kỹ thuật.',
    englishDescription:
      'Evaluate societal, environmental, safety, and legal impacts of engineering solutions.',
    competencyGroup: 'Năng lực tự chủ & Trách nhiệm',
  },
  {
    ploCode: 'PLO8',
    description:
      'Tuân thủ đạo đức nghề nghiệp, có năng lực tự nghiên cứu và học tập suốt đời.',
    englishDescription:
      'Uphold professional ethics and demonstrate independent research and lifelong learning.',
    competencyGroup: 'Năng lực tự chủ & Trách nhiệm',
  },
];

function resolvePrivateDir(): string {
  const flagIndex = process.argv.indexOf('--private-dir');
  if (flagIndex >= 0 && process.argv[flagIndex + 1]) {
    return resolve(process.argv[flagIndex + 1]);
  }
  if (process.env.EXTRA_PRIVATE_DIR) {
    return resolve(process.env.EXTRA_PRIVATE_DIR);
  }
  return fileURLToPath(
    new URL('./seed-data/dut/data/private', import.meta.url),
  );
}

const escapeHtml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function toHtml(text: string): string {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-–•\t\s]+/, '').trim())
    .filter(Boolean);
  if (lines.length <= 1) return `<p>${escapeHtml(lines[0] ?? text)}</p>`;
  return `<ul>${lines.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>`;
}

function defaultFormulaForCourseType(
  courseType: CourseType,
): ExtraAssessmentComponentDef[] {
  if (courseType === CourseType.CAPSTONE || courseType === CourseType.PROJECT) {
    return [
      { componentCode: 'QT', componentName: 'Quá trình thực hiện', weight: '40' },
      { componentCode: 'BV', componentName: 'Bảo vệ đồ án / khóa luận', weight: '60' },
    ];
  }
  if (courseType === CourseType.INTERNSHIP) {
    return [
      { componentCode: 'QT', componentName: 'Quá trình thực tập tại cơ sở', weight: '50' },
      { componentCode: 'BC', componentName: 'Báo cáo & bảo vệ thực tập', weight: '50' },
    ];
  }
  if (courseType === CourseType.LAB || courseType === CourseType.PRACTICE) {
    return [
      { componentCode: 'CC', componentName: 'Chuyên cần & chuẩn bị', weight: '20' },
      { componentCode: 'TH', componentName: 'Thực hành / Thí nghiệm', weight: '40' },
      { componentCode: 'CK', componentName: 'Kiểm tra cuối kỳ', weight: '40' },
    ];
  }
  return [
    { componentCode: 'CC', componentName: 'Chuyên cần & bài tập', weight: '20' },
    { componentCode: 'GK', componentName: 'Kiểm tra giữa kỳ', weight: '30' },
    { componentCode: 'CK', componentName: 'Thi cuối kỳ', weight: '50' },
  ];
}

function defaultWeeksForCourse(
  courseName: string,
  courseType: CourseType,
): { weekLabel: string; content: string; teachingActivities: string }[] {
  if (
    courseType === CourseType.PROJECT ||
    courseType === CourseType.CAPSTONE ||
    courseType === CourseType.INTERNSHIP
  ) {
    return [
      {
        weekLabel: 'Tuần 1',
        content: `<p>Nhận đề tài / nhiệm vụ học phần ${escapeHtml(courseName)}, lập kế hoạch thực hiện và khảo sát yêu cầu.</p>`,
        teachingActivities: 'Hướng dẫn trực tiếp, thảo luận đề cương',
      },
      {
        weekLabel: 'Tuần 2–3',
        content:
          '<p>Tổng quan tài liệu, khảo sát hiện trạng và phân tích các giải pháp kỹ thuật liên quan.</p>',
        teachingActivities: 'Tự nghiên cứu, báo cáo tiến độ',
      },
      {
        weekLabel: 'Tuần 4–5',
        content:
          '<p>Phân tích yêu cầu chi tiết và xây dựng phương án thiết kế tổng thể.</p>',
        teachingActivities: 'Thảo luận nhóm, duyệt thiết kế',
      },
      {
        weekLabel: 'Tuần 6–7',
        content:
          '<p>Triển khai thiết kế chi tiết, xây dựng mô hình / sản phẩm thử nghiệm và kiểm chứng sơ bộ.</p>',
        teachingActivities: 'Thực hành tại phòng thí nghiệm / cơ sở',
      },
      {
        weekLabel: 'Tuần 8',
        content:
          '<p>Kiểm tra tiến độ giữa kỳ, đánh giá kết quả đạt được và hiệu chỉnh phương án.</p>',
        teachingActivities: 'Báo cáo giữa kỳ',
      },
      {
        weekLabel: 'Tuần 9',
        content:
          '<p>Hoàn thiện sản phẩm / bản vẽ / báo cáo kỹ thuật và kiểm thử toàn diện.</p>',
        teachingActivities: 'Hoàn thiện hồ sơ kỹ thuật',
      },
      {
        weekLabel: 'Tuần 10',
        content:
          '<p>Nộp báo cáo tổng kết và bảo vệ kết quả trước hội đồng đánh giá.</p>',
        teachingActivities: 'Thuyết trình và phản biện',
      },
    ];
  }
  const safeName = escapeHtml(courseName);
  return [
    {
      weekLabel: 'Tuần 1',
      content: `<p>Giới thiệu đề cương học phần ${safeName}, chuẩn đầu ra, tài liệu tham khảo và các khái niệm mở đầu.</p>`,
      teachingActivities: 'Giảng lý thuyết, giới thiệu học phần',
    },
    {
      weekLabel: 'Tuần 2',
      content: `<p>Cơ sở lý thuyết và nguyên lý nền tảng của ${safeName} (phần 1).</p>`,
      teachingActivities: 'Giảng lý thuyết, ví dụ minh họa',
    },
    {
      weekLabel: 'Tuần 3',
      content: `<p>Cơ sở lý thuyết và mô hình hóa các thành phần cơ bản trong ${safeName} (phần 2).</p>`,
      teachingActivities: 'Giảng lý thuyết, bài tập tại lớp',
    },
    {
      weekLabel: 'Tuần 4',
      content: '<p>Phương pháp phân tích bài toán cơ bản và bài tập vận dụng.</p>',
      teachingActivities: 'Thảo luận, sửa bài tập',
    },
    {
      weekLabel: 'Tuần 5',
      content: '<p>Nội dung cốt lõi chuyên môn 1: cấu trúc, đặc tính và tham số kỹ thuật.</p>',
      teachingActivities: 'Giảng lý thuyết, thực hành',
    },
    {
      weekLabel: 'Tuần 6',
      content: '<p>Nội dung cốt lõi chuyên môn 2: quy trình tính toán và thiết kế tiêu chuẩn.</p>',
      teachingActivities: 'Giảng lý thuyết, bài tập tình huống',
    },
    {
      weekLabel: 'Tuần 7',
      content: '<p>Thực hành ứng dụng công cụ chuyên ngành và ôn tập nửa đầu học kỳ.</p>',
      teachingActivities: 'Thực hành phòng máy / phòng thí nghiệm',
    },
    {
      weekLabel: 'Tuần 8',
      content: '<p>Kiểm tra đánh giá giữa kỳ và tổng kết phản hồi kết quả học tập.</p>',
      teachingActivities: 'Kiểm tra giữa kỳ',
    },
    {
      weekLabel: 'Tuần 9',
      content: '<p>Chuyên đề nâng cao 1: tối ưu hóa hiệu năng và độ tin cậy của giải pháp.</p>',
      teachingActivities: 'Giảng lý thuyết, thảo luận nhóm',
    },
    {
      weekLabel: 'Tuần 10',
      content: '<p>Chuyên đề nâng cao 2: tích hợp hệ thống và đánh giá tiêu chuẩn kỹ thuật.</p>',
      teachingActivities: 'Giảng lý thuyết, nghiên cứu tình huống',
    },
    {
      weekLabel: 'Tuần 11',
      content: '<p>Thực hành chuyên sâu và triển khai bài tập lớn theo nhóm.</p>',
      teachingActivities: 'Thực hành, hướng dẫn bài tập lớn',
    },
    {
      weekLabel: 'Tuần 12',
      content: '<p>Kiểm thử, phân tích sai số và đánh giá chất lượng kết quả thực nghiệm.</p>',
      teachingActivities: 'Thí nghiệm / thực hành nhóm',
    },
    {
      weekLabel: 'Tuần 13',
      content: '<p>Ứng dụng thực tế công nghiệp và xu hướng công nghệ mới liên quan đến học phần.</p>',
      teachingActivities: 'Seminar, thảo luận mở',
    },
    {
      weekLabel: 'Tuần 14',
      content: '<p>Báo cáo bài tập lớn / tiểu luận nhóm và phản biện kỹ thuật.</p>',
      teachingActivities: 'Thuyết trình nhóm, hỏi đáp',
    },
    {
      weekLabel: 'Tuần 15',
      content: `<p>Hệ thống hóa toàn bộ kiến thức học phần ${safeName}, giải đáp thắc mắc và hướng dẫn ôn thi cuối kỳ.</p>`,
      teachingActivities: 'Ôn tập tổng hợp',
    },
  ];
}

function buildCloTemplates(courseName: string) {
  return [
    {
      cloCode: 'CLO1',
      description: `Trình bày và phân tích được các khái niệm, nguyên lý và cơ sở lý thuyết cốt lõi của học phần ${courseName}.`,
      cognitiveLevel: 'Hiểu / Phân tích',
    },
    {
      cloCode: 'CLO2',
      description: `Áp dụng kiến thức và công cụ chuyên môn của học phần ${courseName} để thiết kế, tính toán và giải quyết bài toán kỹ thuật.`,
      cognitiveLevel: 'Áp dụng / Thiết kế',
    },
    {
      cloCode: 'CLO3',
      description: `Đánh giá hiệu quả giải pháp, thực hiện thí nghiệm/báo cáo kỹ thuật và phối hợp làm việc nhóm hiệu quả.`,
      cognitiveLevel: 'Đánh giá / Sáng tạo',
    },
  ];
}

function buildTeachingMethodsHtml(
  meta: ExtraCourseMetadata | undefined,
  courseType: CourseType,
  credits: Prisma.Decimal,
): string {
  const parts: string[] = [];
  if (meta && meta.theoryCredits > 0) {
    parts.push(
      `Lý thuyết (${meta.theoryCredits} tín chỉ): giảng giải trên lớp, thảo luận tình huống và bài tập minh họa.`,
    );
  }
  if (meta && meta.practiceCredits > 0) {
    parts.push(
      `Thực hành / Thí nghiệm (${meta.practiceCredits} tín chỉ): hướng dẫn trực tiếp tại phòng máy hoặc phòng thí nghiệm.`,
    );
  }
  if (parts.length > 0) {
    return toHtml(parts.join('\n'));
  }
  if (courseType === CourseType.PROJECT || courseType === CourseType.CAPSTONE) {
    return `<p>Hướng dẫn thực hiện đồ án theo tiến độ tuần (${credits.toString()} tín chỉ), kết hợp báo cáo định kỳ và bảo vệ trước hội đồng.</p>`;
  }
  if (courseType === CourseType.INTERNSHIP) {
    return `<p>Thực tập thực tế tại doanh nghiệp / đơn vị chuyên môn (${credits.toString()} tín chỉ), có giảng viên hướng dẫn và đánh giá báo cáo.</p>`;
  }
  return `<p>Kết hợp giảng dạy lý thuyết tương tác, thảo luận nhóm, bài tập ứng dụng và tự học có hướng dẫn (${credits.toString()} tín chỉ).</p>`;
}

function resultStatus(
  result: Pick<DutResult, 'letterGrade' | 'termCode' | 'exempt'>,
  openTermCode: string,
): AcademicResultStatus | null {
  if (result.exempt) return AcademicResultStatus.EXEMPT;
  const letter = result.letterGrade?.toUpperCase() ?? '';
  if (PASSING_LETTERS.has(letter)) return AcademicResultStatus.PASSED;
  if (letter === FAILED_LETTER) return AcademicResultStatus.FAILED;
  return result.termCode === openTermCode
    ? AcademicResultStatus.IN_PROGRESS
    : null;
}

function selectPloIndicesForItem(
  plannedSemester: number,
  courseType: CourseType,
  itemIndex: number,
  ploCount: number,
): { ploIndex: number; weight: string }[] {
  if (ploCount === 0) return [];
  if (
    courseType === CourseType.CAPSTONE ||
    courseType === CourseType.PROJECT ||
    courseType === CourseType.INTERNSHIP
  ) {
    const indices = [3, 4, 5, 6, 7].filter((i) => i < ploCount);
    const chosen = [
      indices[itemIndex % indices.length],
      indices[(itemIndex + 1) % indices.length],
      indices[(itemIndex + 2) % indices.length],
    ];
    const unique = [...new Set(chosen)];
    const weights = ['0.40', '0.35', '0.25'];
    return unique.map((ploIndex, idx) => ({
      ploIndex,
      weight: weights[idx] ?? '0.30',
    }));
  }

  let pool: number[];
  if (plannedSemester <= 3) {
    pool = [0, 1, 5, 7].filter((i) => i < ploCount);
  } else if (plannedSemester <= 6) {
    pool = [1, 2, 3, 4, 5].filter((i) => i < ploCount);
  } else {
    pool = [2, 3, 4, 5, 6, 7].filter((i) => i < ploCount);
  }
  if (pool.length === 0) pool = [0];

  const count = itemIndex % 2 === 0 ? 3 : 2;
  const chosen: number[] = [];
  for (let offset = 0; offset < count && offset < pool.length; offset++) {
    chosen.push(pool[(itemIndex + offset) % pool.length]);
  }
  const unique = [...new Set(chosen)];
  const weights = unique.length === 3 ? ['0.50', '0.30', '0.20'] : ['0.60', '0.40'];
  return unique.map((ploIndex, idx) => ({
    ploIndex,
    weight: weights[idx] ?? '0.30',
  }));
}

async function seedSubjectGroupsAndStaff(
  meta: ExtraSyllabiOutcomesFile,
  people: ExtraPeopleFile | null,
  today: Date,
) {
  const counts = {
    subjectGroupsCreated: 0,
    subjectGroupsSkipped: 0,
    coursesAssignedGroup: 0,
    demoStaffUpserted: 0,
    demoRolesGranted: 0,
    demoCoordinatorsAdded: 0,
    demoDirectorsAdded: 0,
    lecturersCreated: 0,
    lecturersSkipped: 0,
    lecturerMembershipsAdded: 0,
  };

  const [units, roles] = await Promise.all([
    prisma.orgUnit.findMany({ select: { id: true, unitCode: true } }),
    prisma.role.findMany({ select: { id: true, roleCode: true } }),
  ]);
  const unitIdByCode = new Map(units.map((u) => [u.unitCode, u.id]));
  const roleIdByCode = new Map(roles.map((r) => [r.roleCode, r.id]));

  // 1a. Upsert the 5 subject groups
  const existingGroups = await prisma.subjectGroup.findMany({
    select: { id: true, groupCode: true },
  });
  const groupIdByCode = new Map(existingGroups.map((g) => [g.groupCode, g.id]));

  for (const group of meta.subjectGroups) {
    const facultyId = unitIdByCode.get(group.facultyUnitCode);
    if (!facultyId) {
      console.warn(
        `Warning: faculty ${group.facultyUnitCode} not found, skipping group ${group.groupCode}`,
      );
      continue;
    }
    if (groupIdByCode.has(group.groupCode)) {
      counts.subjectGroupsSkipped++;
      continue;
    }
    const created = await prisma.subjectGroup.create({
      data: {
        groupCode: group.groupCode,
        groupName: group.groupName,
        facultyId,
      },
      select: { id: true },
    });
    groupIdByCode.set(group.groupCode, created.id);
    counts.subjectGroupsCreated++;
  }

  // 1b. Assign Course.ownerGroupId in bulk per target group
  const groupCodesByCourseCode = new Map<string, string>();
  for (const courseMeta of Object.values(meta.courses)) {
    if (courseMeta.ownerGroupCode) {
      groupCodesByCourseCode.set(courseMeta.courseCode, courseMeta.ownerGroupCode);
    }
  }
  const candidateCourses = await prisma.course.findMany({
    where: {
      courseCode: { in: [...groupCodesByCourseCode.keys()] },
    },
    select: {
      id: true,
      courseCode: true,
      ownerGroupId: true,
      ownerFaculty: { select: { unitCode: true } },
    },
  });
  const courseIdsByTargetGroup = new Map<string, string[]>();
  for (const course of candidateCourses) {
    const targetGroupCode = groupCodesByCourseCode.get(course.courseCode);
    if (!targetGroupCode) continue;
    const targetGroupId = groupIdByCode.get(targetGroupCode);
    if (!targetGroupId) continue;
    const shouldAssign =
      course.ownerGroupId === null ||
      course.ownerFaculty.unitCode === EXTRA_FACULTY_CODES.DTVT ||
      course.ownerFaculty.unitCode === EXTRA_FACULTY_CODES.KTR;
    if (shouldAssign && course.ownerGroupId !== targetGroupId) {
      const list = courseIdsByTargetGroup.get(targetGroupId) ?? [];
      list.push(course.id);
      courseIdsByTargetGroup.set(targetGroupId, list);
    }
  }
  for (const [groupId, courseIds] of courseIdsByTargetGroup) {
    const updated = await prisma.course.updateMany({
      where: { id: { in: courseIds } },
      data: { ownerGroupId: groupId },
    });
    counts.coursesAssignedGroup += updated.count;
  }

  // 1c. Upsert demo governance staff (R2, Coordinators, Directors)
  const passwordService = new PasswordService();
  const demoPassword = process.env.DEMO_STAFF_PASSWORD ?? 'Demo@1234';
  const demoPasswordHash = await passwordService.hash(demoPassword);

  const allPrograms = await prisma.program.findMany({
    where: { status: ProgramStatus.ACTIVE },
    select: { id: true, programCode: true },
  });

  for (const staff of DEMO_GOVERNANCE_STAFF) {
    const facultyId = unitIdByCode.get(staff.facultyUnitCode);
    if (!facultyId) continue;

    let user = await prisma.user.findUnique({
      where: { username: staff.username },
      select: { id: true },
    });
    if (!user) {
      user = await prisma.user.create({
        data: {
          username: staff.username,
          userCode: staff.userCode,
          fullName: staff.fullName,
          passwordHash: demoPasswordHash,
          mustChangePassword: false,
          status: UserStatus.ACTIVE,
          orgUnitId: facultyId,
        },
        select: { id: true },
      });
    } else {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          fullName: staff.fullName,
          orgUnitId: facultyId,
        },
      });
    }
    counts.demoStaffUpserted++;

    for (const roleSpec of staff.roles) {
      const roleId = roleIdByCode.get(roleSpec.roleCode);
      if (!roleId) continue;
      const scopeUnitId = roleSpec.scopeUnitCode
        ? (unitIdByCode.get(roleSpec.scopeUnitCode) ?? null)
        : null;
      const existingRole = await prisma.roleAssignment.findFirst({
        where: {
          userId: user.id,
          roleId,
          scopeType: roleSpec.scopeType,
          scopeUnitId,
          revokedAt: null,
        },
        select: { id: true },
      });
      if (!existingRole) {
        await prisma.roleAssignment.create({
          data: {
            userId: user.id,
            roleId,
            scopeType: roleSpec.scopeType,
            scopeUnitId,
            validFrom: today,
          },
        });
        counts.demoRolesGranted++;
      }
    }

    for (const groupCode of staff.coordinatorGroups) {
      const subjectGroupId = groupIdByCode.get(groupCode);
      if (!subjectGroupId) continue;
      const existingCoord = await prisma.subjectGroupMember.findFirst({
        where: {
          lecturerId: user.id,
          subjectGroupId,
          memberRole: SubjectGroupMemberRole.COORDINATOR,
          revokedAt: null,
        },
        select: { id: true },
      });
      if (!existingCoord) {
        await prisma.subjectGroupMember.create({
          data: {
            subjectGroupId,
            lecturerId: user.id,
            memberRole: SubjectGroupMemberRole.COORDINATOR,
            validFrom: today,
          },
        });
        counts.demoCoordinatorsAdded++;
      }
    }

    if (staff.directorProgramPrefixes.length > 0) {
      const matchingPrograms = allPrograms.filter((p) =>
        staff.directorProgramPrefixes.some((prefix) =>
          p.programCode.startsWith(prefix),
        ),
      );
      for (const program of matchingPrograms) {
        const existingDir = await prisma.programDirectorAssignment.findFirst({
          where: {
            programId: program.id,
            directorId: user.id,
            revokedAt: null,
          },
          select: { id: true },
        });
        if (!existingDir) {
          await prisma.programDirectorAssignment.create({
            data: {
              programId: program.id,
              directorId: user.id,
              validFrom: today,
            },
          });
          counts.demoDirectorsAdded++;
        }
      }
    }
  }

  // 1d. Seed real lecturers from private extra-people.json
  if (people && people.lecturers.length > 0) {
    const tempPassword =
      process.env.EXTRA_LECTURER_TEMP_PASSWORD ?? 'Dut@2026#Temp';
    const lecturerPasswordHash = await passwordService.hash(tempPassword);

    const existingUsers = await prisma.user.findMany({
      select: { id: true, userCode: true, username: true, email: true },
    });
    const existingUserCodes = new Set(existingUsers.map((u) => u.userCode));
    const existingUsernames = new Set(existingUsers.map((u) => u.username));
    const existingEmails = new Set(
      existingUsers
        .map((u) => u.email?.toLowerCase())
        .filter((e): e is string => Boolean(e)),
    );

    const newLecturersData: Prisma.UserCreateManyInput[] = [];
    for (const lecturer of people.lecturers) {
      if (
        existingUserCodes.has(lecturer.staffCode) ||
        existingUsernames.has(lecturer.staffCode)
      ) {
        counts.lecturersSkipped++;
        continue;
      }
      const facultyId = unitIdByCode.get(lecturer.facultyUnitCode) ?? null;
      let email = lecturer.email?.toLowerCase() ?? null;
      if (email && existingEmails.has(email)) {
        email = null;
      } else if (email) {
        existingEmails.add(email);
      }
      existingUserCodes.add(lecturer.staffCode);
      existingUsernames.add(lecturer.staffCode);
      newLecturersData.push({
        username: lecturer.staffCode,
        userCode: lecturer.staffCode,
        fullName: lecturer.fullName,
        email,
        passwordHash: lecturerPasswordHash,
        mustChangePassword: true,
        status: lecturer.archived ? UserStatus.DISABLED : UserStatus.ACTIVE,
        orgUnitId: facultyId,
      });
    }

    if (newLecturersData.length > 0) {
      const inserted = await prisma.user.createMany({
        data: newLecturersData,
        skipDuplicates: true,
      });
      counts.lecturersCreated = inserted.count;
    }

    // Add active lecturers to their suggested SubjectGroup & grant R5 if missing
    const activeLecturers = people.lecturers.filter((l) => !l.archived);
    const staffCodes = activeLecturers.map((l) => l.staffCode);
    const lecturerUsers = await prisma.user.findMany({
      where: { userCode: { in: staffCodes } },
      select: { id: true, userCode: true },
    });
    const userIdByStaffCode = new Map(
      lecturerUsers.map((u) => [u.userCode, u.id]),
    );

    const lecturerUserIds = lecturerUsers.map((u) => u.id);
    const existingMemberships = await prisma.subjectGroupMember.findMany({
      where: {
        lecturerId: { in: lecturerUserIds },
        revokedAt: null,
      },
      select: { lecturerId: true, subjectGroupId: true },
    });
    const membershipKey = (lecturerId: string, groupId: string) =>
      `${lecturerId}:${groupId}`;
    const existingMembershipSet = new Set(
      existingMemberships.map((m) =>
        membershipKey(m.lecturerId, m.subjectGroupId),
      ),
    );

    const newMemberships: Prisma.SubjectGroupMemberCreateManyInput[] = [];
    for (const lecturer of activeLecturers) {
      const userId = userIdByStaffCode.get(lecturer.staffCode);
      const groupId = groupIdByCode.get(lecturer.suggestedGroupCode);
      if (!userId || !groupId) continue;
      const key = membershipKey(userId, groupId);
      if (existingMembershipSet.has(key)) continue;
      existingMembershipSet.add(key);
      newMemberships.push({
        subjectGroupId: groupId,
        lecturerId: userId,
        memberRole: SubjectGroupMemberRole.MEMBER,
        validFrom: today,
      });
    }
    if (newMemberships.length > 0) {
      const inserted = await prisma.subjectGroupMember.createMany({
        data: newMemberships,
      });
      counts.lecturerMembershipsAdded = inserted.count;
    }

    const r5RoleId = roleIdByCode.get(ROLE_CODES.R5);
    if (r5RoleId && lecturerUserIds.length > 0) {
      const existingR5 = await prisma.roleAssignment.findMany({
        where: {
          userId: { in: lecturerUserIds },
          roleId: r5RoleId,
          revokedAt: null,
        },
        select: { userId: true },
      });
      const hasR5 = new Set(existingR5.map((r) => r.userId));
      const newR5 = lecturerUserIds
        .filter((id) => !hasR5.has(id))
        .map((userId) => ({
          userId,
          roleId: r5RoleId,
          scopeType: ScopeType.SYSTEM,
          scopeUnitId: null,
          validFrom: today,
        }));
      if (newR5.length > 0) {
        await prisma.roleAssignment.createMany({
          data: newR5,
          skipDuplicates: true,
        });
      }
    }
  }

  return counts;
}

async function seedPublishedSyllabi(
  meta: ExtraSyllabiOutcomesFile,
  today: Date,
) {
  const counts = {
    syllabiPublished: 0,
    syllabiSkippedAlreadyPublished: 0,
    closCreated: 0,
    assessmentsCreated: 0,
    weeklyContentsCreated: 0,
  };

  const courses = await prisma.course.findMany({
    where: {
      status: { not: CourseStatus.CANCELLED },
    },
    select: {
      id: true,
      courseCode: true,
      courseName: true,
      englishName: true,
      credits: true,
      courseType: true,
      syllabi: {
        where: { sourceRequestId: null },
        orderBy: { revisionNumber: 'desc' },
        select: {
          id: true,
          revisionNumber: true,
          status: true,
          courseDescription: true,
          _count: {
            select: {
              clos: true,
              assessmentComponents: true,
              weeklyContents: true,
            },
          },
        },
      },
    },
  });

  const targets = courses.filter((course) => {
    const hasPublished = course.syllabi.some(
      (s) => s.status === SyllabusStatus.PUBLISHED,
    );
    if (hasPublished) {
      counts.syllabiSkippedAlreadyPublished++;
      return false;
    }
    return true;
  });

  const CONCURRENCY = 10;
  for (let i = 0; i < targets.length; i += CONCURRENCY) {
    const chunk = targets.slice(i, i + CONCURRENCY);
    await Promise.all(
      chunk.map(async (course) => {
        const courseMeta = meta.courses[course.courseCode];
        const existingDraft =
          course.syllabi.find((s) => s.status === SyllabusStatus.DRAFT) ?? null;

        const isPlaceholderOrEmpty =
          !existingDraft?.courseDescription ||
          existingDraft.courseDescription.includes(PLACEHOLDER_MARK);

        const components =
          courseMeta?.formula ?? defaultFormulaForCourseType(course.courseType);
        const descriptionHtml = courseMeta?.description
          ? toHtml(courseMeta.description)
          : `<p><em>(Mẫu)</em> Học phần <strong>${escapeHtml(course.courseName)}</strong> (${course.credits.toString()} tín chỉ) trang bị cho sinh viên kiến thức nền tảng và kỹ năng chuyên môn thiết yếu trong chương trình đào tạo.</p>${SAMPLE_NOTE}`;

        const englishTitle = courseMeta?.englishName ?? course.englishName;
        const englishDescriptionHtml = englishTitle
          ? `<p>${escapeHtml(englishTitle)}</p>`
          : null;

        const objectivesHtml = courseMeta?.objectives
          ? toHtml(courseMeta.objectives)
          : `<ul><li>Nắm vững các khái niệm, nguyên lý và phương pháp cơ bản của học phần ${escapeHtml(course.courseName)}.</li><li>Vận dụng kiến thức vào phân tích, thiết kế và giải quyết các bài toán thực tiễn chuyên ngành.</li><li>Phát triển kỹ năng làm việc nhóm, viết báo cáo kỹ thuật và tự học suốt đời.</li></ul>`;

        const teachingMethodsHtml = buildTeachingMethodsHtml(
          courseMeta,
          course.courseType,
          course.credits,
        );

        const assessmentMethodsHtml = toHtml(
          components
            .map((c) => `${c.componentName} (${c.componentCode}): ${c.weight}%`)
            .join('\n'),
        );

        const referencesHtml = courseMeta?.references
          ? toHtml(courseMeta.references)
          : `<ul><li>Giáo trình chính: Bài giảng và tài liệu học tập học phần ${escapeHtml(course.courseName)} — Trường ĐH Bách khoa, ĐH Đà Nẵng.</li><li>Tài liệu tham khảo: Các giáo trình chuyên khảo, tiêu chuẩn kỹ thuật và tài liệu mở cập nhật theo chuyên ngành.</li></ul>`;

        await prisma.$transaction(async (tx) => {
          let syllabusId: string;
          if (existingDraft) {
            const updated = await tx.syllabus.update({
              where: { id: existingDraft.id },
              data: {
                status: SyllabusStatus.PUBLISHED,
                publishedAt: today,
                ...(isPlaceholderOrEmpty
                  ? {
                      courseDescription: descriptionHtml,
                      englishDescription: englishDescriptionHtml,
                      objectives: objectivesHtml,
                      teachingMethods: teachingMethodsHtml,
                      assessmentMethods: assessmentMethodsHtml,
                      references: referencesHtml,
                    }
                  : {}),
              },
              select: { id: true },
            });
            syllabusId = updated.id;
          } else {
            const created = await tx.syllabus.create({
              data: {
                courseId: course.id,
                revisionNumber: 1,
                status: SyllabusStatus.PUBLISHED,
                publishedAt: today,
                courseDescription: descriptionHtml,
                englishDescription: englishDescriptionHtml,
                objectives: objectivesHtml,
                teachingMethods: teachingMethodsHtml,
                assessmentMethods: assessmentMethodsHtml,
                references: referencesHtml,
              },
              select: { id: true },
            });
            syllabusId = created.id;
          }

          // CLOs
          let cloIds: string[];
          if (existingDraft && existingDraft._count.clos > 0) {
            const existingClos = await tx.cLO.findMany({
              where: { syllabusId },
              orderBy: { sortOrder: 'asc' },
              select: { id: true },
            });
            cloIds = existingClos.map((c) => c.id);
          } else {
            const cloTemplates = buildCloTemplates(course.courseName);
            const createdClos = await tx.cLO.createManyAndReturn({
              data: cloTemplates.map((clo, idx) => ({
                syllabusId,
                sortOrder: idx + 1,
                cloCode: clo.cloCode,
                description: clo.description,
                cognitiveLevel: clo.cognitiveLevel,
              })),
              select: { id: true },
            });
            cloIds = createdClos.map((c) => c.id);
            counts.closCreated += createdClos.length;
          }

          // Assessment Components + CLO mappings
          if (!existingDraft || existingDraft._count.assessmentComponents === 0) {
            const createdComponents =
              await tx.assessmentComponent.createManyAndReturn({
                data: components.map((c) => ({
                  syllabusId,
                  componentCode: c.componentCode,
                  componentName: c.componentName,
                  weight: new Prisma.Decimal(c.weight),
                })),
                select: { id: true, weight: true },
              });
            counts.assessmentsCreated += createdComponents.length;

            if (cloIds.length > 0 && createdComponents.length > 0) {
              const heaviest = createdComponents.reduce((best, cur) =>
                cur.weight.gt(best.weight) ? cur : best,
              );
              const mappingRows: Prisma.AssessmentCLOMappingCreateManyInput[] = [];
              for (const comp of createdComponents) {
                const targetClos =
                  comp.id === heaviest.id
                    ? cloIds
                    : cloIds.length > 1
                      ? cloIds.slice(0, 2)
                      : cloIds;
                for (const cloId of targetClos) {
                  mappingRows.push({
                    assessmentComponentId: comp.id,
                    cloId,
                  });
                }
              }
              await tx.assessmentCLOMapping.createMany({
                data: mappingRows,
                skipDuplicates: true,
              });
            }
          }

          // Weekly Contents + CLO mappings
          if (!existingDraft || existingDraft._count.weeklyContents === 0) {
            const weeks =
              courseMeta && courseMeta.weeklyContents.length > 0
                ? courseMeta.weeklyContents.map((w) => ({
                    weekLabel: w.weekLabel,
                    content: toHtml(w.content),
                    teachingActivities: w.teachingActivities,
                  }))
                : defaultWeeksForCourse(course.courseName, course.courseType);

            const createdWeeks = await tx.weeklyContent.createManyAndReturn({
              data: weeks.map((w, idx) => ({
                syllabusId,
                sortOrder: idx + 1,
                weekLabel: w.weekLabel,
                content: w.content,
                teachingActivities: w.teachingActivities,
              })),
              select: { id: true },
            });
            counts.weeklyContentsCreated += createdWeeks.length;

            if (cloIds.length > 0 && createdWeeks.length > 0) {
              const weekCloRows: Prisma.WeeklyContentCLOCreateManyInput[] =
                createdWeeks.map((week, idx) => {
                  const cloIndex = Math.min(
                    cloIds.length - 1,
                    Math.floor((idx * cloIds.length) / createdWeeks.length),
                  );
                  return {
                    weeklyContentId: week.id,
                    cloId: cloIds[cloIndex],
                  };
                });
              await tx.weeklyContentCLO.createMany({
                data: weekCloRows,
                skipDuplicates: true,
              });
            }
          }

          counts.syllabiPublished++;
        });
      }),
    );
  }

  return counts;
}

async function seedPlosAndMatrices(
  meta: ExtraSyllabiOutcomesFile,
  extraPrograms: ExtraFacultiesFile,
) {
  const counts = {
    versionsPopulated: 0,
    versionsSkipped: 0,
    plosCreated: 0,
    coursePloMappingsCreated: 0,
    cloPloMappingsCreated: 0,
  };

  const extraProgramCodes = new Set<string>([
    ...extraPrograms.programs.map((p) => p.programCode),
    extraPrograms.trackShowcase.programCode,
  ]);

  const programs = await prisma.program.findMany({
    where: {
      OR: [
        { programCode: { in: [...extraProgramCodes] } },
        { status: ProgramStatus.ACTIVE },
      ],
    },
    select: {
      id: true,
      programCode: true,
      versions: {
        where: { sourceRequestId: null },
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        select: {
          id: true,
          status: true,
          majorCode: true,
          _count: { select: { plos: true } },
        },
      },
    },
  });

  // Preload published CLOs per courseId once for fast CLO-PLO linking
  const publishedClos = await prisma.cLO.findMany({
    where: {
      syllabus: {
        status: SyllabusStatus.PUBLISHED,
        sourceRequestId: null,
      },
    },
    orderBy: { sortOrder: 'asc' },
    select: {
      id: true,
      syllabus: { select: { courseId: true } },
    },
  });
  const closByCourseId = new Map<string, string[]>();
  for (const clo of publishedClos) {
    const courseId = clo.syllabus.courseId;
    const list = closByCourseId.get(courseId) ?? [];
    list.push(clo.id);
    closByCourseId.set(courseId, list);
  }

  for (const program of programs) {
    const representative =
      program.versions.find((v) => v.status === ProgramVersionStatus.ACTIVE) ??
      program.versions.find(
        (v) =>
          v.status === ProgramVersionStatus.PENDING ||
          v.status === ProgramVersionStatus.HISTORICAL,
      ) ??
      program.versions[0];

    if (!representative) continue;
    if (representative._count.plos > 0) {
      counts.versionsSkipped++;
      continue;
    }

    const baseMajorCode = representative.majorCode.replace(/[^0-9].*$/, '');
    const templates =
      meta.ploTemplates[baseMajorCode] ?? FALLBACK_PLO_TEMPLATE;

    const items = await prisma.curriculumItem.findMany({
      where: { versionId: representative.id },
      orderBy: [{ plannedSemester: 'asc' }, { sortOrder: 'asc' }],
      select: {
        id: true,
        courseId: true,
        plannedSemester: true,
        course: { select: { courseType: true } },
      },
    });

    await prisma.$transaction(async (tx) => {
      const createdPlos = await tx.pLO.createManyAndReturn({
        data: templates.map((tpl, idx) => ({
          versionId: representative.id,
          ploCode: tpl.ploCode,
          description: tpl.description,
          englishDescription: tpl.englishDescription,
          competencyGroup: tpl.competencyGroup,
          sortOrder: idx + 1,
        })),
        select: { id: true },
      });
      counts.plosCreated += createdPlos.length;

      if (items.length === 0 || createdPlos.length === 0) {
        counts.versionsPopulated++;
        return;
      }

      const coursePloRows: Prisma.CoursePLOMappingCreateManyInput[] = [];
      const cloPloRows: Prisma.CLOPLOMappingCreateManyInput[] = [];

      items.forEach((item, itemIdx) => {
        const selections = selectPloIndicesForItem(
          item.plannedSemester,
          item.course.courseType,
          itemIdx,
          createdPlos.length,
        );
        const courseClos = closByCourseId.get(item.courseId) ?? [];

        selections.forEach((sel, selIdx) => {
          const ploId = createdPlos[sel.ploIndex].id;
          coursePloRows.push({
            curriculumItemId: item.id,
            ploId,
            weight: new Prisma.Decimal(sel.weight),
          });
          if (courseClos.length > 0) {
            const firstClo = courseClos[selIdx % courseClos.length];
            cloPloRows.push({
              curriculumItemId: item.id,
              ploId,
              cloId: firstClo,
            });
            if (courseClos.length > 1) {
              const secondClo = courseClos[(selIdx + 1) % courseClos.length];
              if (secondClo !== firstClo) {
                cloPloRows.push({
                  curriculumItemId: item.id,
                  ploId,
                  cloId: secondClo,
                });
              }
            }
          }
        });
      });

      if (coursePloRows.length > 0) {
        const insertedMappings = await tx.coursePLOMapping.createMany({
          data: coursePloRows,
          skipDuplicates: true,
        });
        counts.coursePloMappingsCreated += insertedMappings.count;
      }
      if (cloPloRows.length > 0) {
        const insertedCloLinks = await tx.cLOPLOMapping.createMany({
          data: cloPloRows,
          skipDuplicates: true,
        });
        counts.cloPloMappingsCreated += insertedCloLinks.count;
      }
      counts.versionsPopulated++;
    });
  }

  return counts;
}

async function seedStudentsAndResults(
  extraData: ExtraFacultiesFile,
  people: ExtraPeopleFile,
  resultsPath: string,
) {
  const counts = {
    semestersCreated: 0,
    cohortsCreated: 0,
    studentsCreated: 0,
    studentsSkipped: 0,
    enrollmentsCreated: 0,
    resultsCreated: 0,
    resultsExempt: 0,
    resultsSkippedNoOutcome: 0,
    resultsSkippedUnknownRef: 0,
  };

  // 4a. Ensure all referenced Semesters exist
  const existingSemesters = await prisma.semester.findMany({
    select: { id: true, semesterCode: true, academicYear: true, termInYear: true },
  });
  const semesterIdByCode = new Map(
    existingSemesters.map((s) => [s.semesterCode, s.id]),
  );
  const existingYearTerm = new Set(
    existingSemesters.map((s) => `${s.academicYear}:${s.termInYear}`),
  );

  for (const term of people.terms) {
    if (semesterIdByCode.has(term.semesterCode)) continue;
    const ytKey = `${term.academicYear}:${term.termInYear}`;
    if (existingYearTerm.has(ytKey)) {
      const match = existingSemesters.find(
        (s) =>
          s.academicYear === term.academicYear &&
          s.termInYear === term.termInYear,
      );
      if (match) semesterIdByCode.set(term.semesterCode, match.id);
      continue;
    }
    const created = await prisma.semester.create({
      data: {
        semesterCode: term.semesterCode,
        academicYear: term.academicYear,
        termInYear: term.termInYear,
        startDate: new Date(`${term.startDate}T00:00:00.000Z`),
        startDateEstimated: term.startDateEstimated,
      },
      select: { id: true },
    });
    semesterIdByCode.set(term.semesterCode, created.id);
    existingYearTerm.add(ytKey);
    counts.semestersCreated++;
  }

  // 4b. Ensure all referenced Cohorts exist
  const existingCohorts = await prisma.cohort.findMany({
    select: { id: true, cohortCode: true },
  });
  const cohortIdByCode = new Map(existingCohorts.map((c) => [c.cohortCode, c.id]));

  const missingCohorts = new Map<string, number>();
  for (const student of people.students) {
    if (!cohortIdByCode.has(student.cohortCode)) {
      const parsed = cohortFromLegacyCode(student.admissionTermCode);
      missingCohorts.set(parsed.cohortCode, parsed.intakeYear);
    }
  }
  if (missingCohorts.size > 0) {
    const createdCohorts = await prisma.cohort.createManyAndReturn({
      data: [...missingCohorts.entries()].map(([cohortCode, intakeYear]) => ({
        cohortCode,
        intakeYear,
      })),
      skipDuplicates: true,
      select: { id: true, cohortCode: true },
    });
    for (const c of createdCohorts) cohortIdByCode.set(c.cohortCode, c.id);
    counts.cohortsCreated = createdCohorts.length;
  }

  // 4c. Map frameCode -> (programId, versionId, majorName)
  const dbPrograms = await prisma.program.findMany({
    where: {
      programCode: { in: extraData.programs.map((p) => p.programCode) },
    },
    select: {
      id: true,
      programCode: true,
      versions: {
        where: { sourceRequestId: null },
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        select: {
          id: true,
          status: true,
          programName: true,
          majorName: true,
          effectiveSemester: { select: { semesterCode: true } },
        },
      },
    },
  });
  const dbProgramByCode = new Map(dbPrograms.map((p) => [p.programCode, p]));

  const frameTarget = new Map<
    string,
    { programId: string; versionId: string; majorName: string }
  >();
  for (const program of extraData.programs) {
    const dbProgram = dbProgramByCode.get(program.programCode);
    if (!dbProgram || dbProgram.versions.length === 0) continue;
    const fallbackVersion =
      dbProgram.versions.find((v) => v.status === ProgramVersionStatus.ACTIVE) ??
      dbProgram.versions[0];

    for (const version of program.versions) {
      const matched =
        dbProgram.versions.find(
          (v) =>
            version.startSemesterCode !== null &&
            v.effectiveSemester?.semesterCode === version.startSemesterCode,
        ) ??
        dbProgram.versions.find((v) => v.programName === version.programName) ??
        fallbackVersion;

      frameTarget.set(version.frameCode, {
        programId: dbProgram.id,
        versionId: matched.id,
        majorName: matched.majorName,
      });
    }
  }

  // 4d. Batch-insert missing Students
  const statusSemesterId = semesterIdByCode.get(people.openTermCode);
  if (!statusSemesterId) {
    throw new Error(`Missing semester for openTermCode ${people.openTermCode}`);
  }

  const existingStudents = await prisma.student.findMany({
    where: {
      studentCode: { in: people.students.map((s) => s.studentCode) },
    },
    select: { id: true, studentCode: true },
  });
  const studentIdByCode = new Map(
    existingStudents.map((s) => [s.studentCode, s.id]),
  );

  const newStudents: Prisma.StudentCreateManyInput[] = [];
  for (const student of people.students) {
    if (studentIdByCode.has(student.studentCode)) {
      counts.studentsSkipped++;
      continue;
    }
    const target = frameTarget.get(student.frameCode);
    const cohortId = cohortIdByCode.get(student.cohortCode);
    const admissionSemesterId = semesterIdByCode.get(student.admissionTermCode);
    if (!target || !cohortId || !admissionSemesterId) continue;

    newStudents.push({
      studentCode: student.studentCode,
      fullName: student.fullName,
      cohortId,
      admissionSemesterId,
      statusSemesterId,
      major: target.majorName,
      status: student.status,
      dataSource: StudentDataSource.SCHOOL_DB,
    });
  }

  for (let i = 0; i < newStudents.length; i += STUDENT_BATCH_SIZE) {
    const batch = newStudents.slice(i, i + STUDENT_BATCH_SIZE);
    const created = await prisma.student.createManyAndReturn({
      data: batch,
      skipDuplicates: true,
      select: { id: true, studentCode: true },
    });
    for (const row of created) studentIdByCode.set(row.studentCode, row.id);
    counts.studentsCreated += created.length;
  }

  // 4e. Batch-insert missing ProgramEnrollments
  const allStudentIds = [...studentIdByCode.values()];
  const existingEnrollments = await prisma.programEnrollment.findMany({
    where: { studentId: { in: allStudentIds } },
    select: { studentId: true, programId: true },
  });
  const enrolledKeys = new Set(
    existingEnrollments.map((e) => `${e.studentId}:${e.programId}`),
  );

  const newEnrollments: Prisma.ProgramEnrollmentCreateManyInput[] = [];
  for (const student of people.students) {
    const studentId = studentIdByCode.get(student.studentCode);
    const target = frameTarget.get(student.frameCode);
    const cohortId = cohortIdByCode.get(student.cohortCode);
    const admissionSemesterId = semesterIdByCode.get(student.admissionTermCode);
    if (!studentId || !target || !cohortId || !admissionSemesterId) continue;

    const key = `${studentId}:${target.programId}`;
    if (enrolledKeys.has(key)) continue;
    enrolledKeys.add(key);

    newEnrollments.push({
      studentId,
      programId: target.programId,
      cohortId,
      appliedVersionId: target.versionId,
      admissionVersionId: target.versionId,
      fromSemesterId: admissionSemesterId,
      enrollmentType: EnrollmentType.PRIMARY,
      status: EnrollmentStatus.ACTIVE,
    });
  }

  for (let i = 0; i < newEnrollments.length; i += STUDENT_BATCH_SIZE) {
    const batch = newEnrollments.slice(i, i + STUDENT_BATCH_SIZE);
    const inserted = await prisma.programEnrollment.createMany({
      data: batch,
    });
    counts.enrollmentsCreated += inserted.count;
  }

  // 4f. Stream extra-results.jsonl and batch-insert AcademicResult
  if (existsSync(resultsPath)) {
    const allCourses = await prisma.course.findMany({
      select: { id: true, courseCode: true },
    });
    const courseIdByCode = new Map(
      allCourses.map((c) => [c.courseCode, c.id]),
    );

    let batch: Prisma.AcademicResultCreateManyInput[] = [];
    const flush = async () => {
      if (batch.length === 0) return;
      const inserted = await prisma.academicResult.createMany({
        data: batch,
        skipDuplicates: true,
      });
      counts.resultsCreated += inserted.count;
      batch = [];
    };

    const rl = createInterface({
      input: createReadStream(resultsPath, 'utf8'),
      crlfDelay: Infinity,
    });
    for await (const line of rl) {
      if (!line.trim()) continue;
      const row = JSON.parse(line) as DutResult;
      const status = resultStatus(row, people.openTermCode);
      if (!status) {
        counts.resultsSkippedNoOutcome++;
        continue;
      }
      const studentId = studentIdByCode.get(row.studentCode);
      const courseId = courseIdByCode.get(row.courseCode);
      const semesterId = semesterIdByCode.get(row.termCode);
      if (!studentId || !courseId || !semesterId) {
        counts.resultsSkippedUnknownRef++;
        continue;
      }
      if (status === AcademicResultStatus.EXEMPT) counts.resultsExempt++;
      batch.push({
        studentId,
        courseId,
        semesterId,
        score10: row.score10,
        score4: row.score4,
        letterGrade: row.letterGrade,
        status,
        dataSource: StudentDataSource.SCHOOL_DB,
      });
      if (batch.length >= RESULT_BATCH_SIZE) {
        await flush();
      }
    }
    await flush();
  }

  return counts;
}

async function main() {
  const startedAt = Date.now();
  const extraFacultiesPath = new URL(
    './seed-data/dut/data/extra-faculties.json',
    import.meta.url,
  );
  const syllabiOutcomesPath = new URL(
    './seed-data/dut/data/extra-syllabi-outcomes.json',
    import.meta.url,
  );

  const extraData = JSON.parse(
    readFileSync(extraFacultiesPath, 'utf8'),
  ) as ExtraFacultiesFile;
  const syllabiOutcomes = JSON.parse(
    readFileSync(syllabiOutcomesPath, 'utf8'),
  ) as ExtraSyllabiOutcomesFile;

  const privateDir = resolvePrivateDir();
  const peoplePath = resolve(privateDir, 'extra-people.json');
  const resultsPath = resolve(privateDir, 'extra-results.jsonl');

  let people: ExtraPeopleFile | null = null;
  if (existsSync(peoplePath)) {
    people = JSON.parse(readFileSync(peoplePath, 'utf8')) as ExtraPeopleFile;
    console.log(
      `Loaded private PII data from ${privateDir}: ${people.lecturers.length} lecturers, ${people.students.length} students`,
    );
  } else {
    console.warn(
      `[WARN] Private PII file not found at ${peoplePath}. Proceeding to seed all non-PII data (subject groups, demo governance staff, syllabi/CLOs, PLOs/matrices) without real students/lecturers.`,
    );
  }

  const today = todayDate();

  // 1. Subject groups, staff, lecturers
  const orgCounts = await seedSubjectGroupsAndStaff(
    syllabiOutcomes,
    people,
    today,
  );

  // 2. Rich PUBLISHED syllabi + CLOs + formulas + weekly content
  const syllabusCounts = await seedPublishedSyllabi(syllabiOutcomes, today);

  // 3. PLOs + Course-PLO + CLO-PLO matrices
  const ploCounts = await seedPlosAndMatrices(syllabiOutcomes, extraData);

  // 4. Students, enrollments, and academic results (if private dir available)
  const studentCounts = people
    ? await seedStudentsAndResults(extraData, people, resultsPath)
    : null;

  const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`\n=== Extra Full Seed Summary (${elapsedSec}s) ===`);
  console.log(
    `Subject Groups: created=${orgCounts.subjectGroupsCreated}, skipped=${orgCounts.subjectGroupsSkipped}, coursesAssigned=${orgCounts.coursesAssignedGroup}`,
  );
  console.log(
    `Governance Staff: upserted=${orgCounts.demoStaffUpserted}, rolesGranted=${orgCounts.demoRolesGranted}, coordinatorsAdded=${orgCounts.demoCoordinatorsAdded}, directorsAdded=${orgCounts.demoDirectorsAdded}`,
  );
  console.log(
    `Real Lecturers: created=${orgCounts.lecturersCreated}, skipped=${orgCounts.lecturersSkipped}, groupMembershipsAdded=${orgCounts.lecturerMembershipsAdded}`,
  );
  console.log(
    `Syllabi: published=${syllabusCounts.syllabiPublished}, skippedAlreadyPublished=${syllabusCounts.syllabiSkippedAlreadyPublished}, closCreated=${syllabusCounts.closCreated}, assessmentsCreated=${syllabusCounts.assessmentsCreated}, weeklyContentsCreated=${syllabusCounts.weeklyContentsCreated}`,
  );
  console.log(
    `PLOs & Matrices: versionsPopulated=${ploCounts.versionsPopulated}, versionsSkipped=${ploCounts.versionsSkipped}, plosCreated=${ploCounts.plosCreated}, coursePloMappings=${ploCounts.coursePloMappingsCreated}, cloPloMappings=${ploCounts.cloPloMappingsCreated}`,
  );
  if (studentCounts) {
    console.log(
      `Students & Results: semestersCreated=${studentCounts.semestersCreated}, cohortsCreated=${studentCounts.cohortsCreated}, studentsCreated=${studentCounts.studentsCreated}, studentsSkipped=${studentCounts.studentsSkipped}, enrollmentsCreated=${studentCounts.enrollmentsCreated}, resultsCreated=${studentCounts.resultsCreated} (exempt=${studentCounts.resultsExempt}, skippedNoOutcome=${studentCounts.resultsSkippedNoOutcome}, skippedUnknownRef=${studentCounts.resultsSkippedUnknownRef})`,
    );
  } else {
    console.log('Students & Results: skipped (private directory not present)');
  }
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
