// Public demo only: gives the faculty the approval structure the school database does not hold, so level 1
// (subject-group coordinator) and level 2 (program director) route to real-looking people.
//   DATABASE_URL=... DEMO_STAFF_PASSWORD=... pnpm db:demo-org [mirrorRoot] [--dry-run]
//
// - Subject groups: five groups of Khoa CNTT; every home-faculty course goes to one by its name.
// - Members: each lecturer joins the group whose courses they teach most (tmHocphanGV of the school copy).
// - Coordinators and directors: the school keeps neither, so sample accounts stand in, named by role.
//   The demo account coordinates the CNPM group and directs the CNPM programs, so it has its own queue.
// Idempotent: a second run changes nothing. Never run it against a database real users depend on.
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  PrismaClient,
  ScopeType,
  SubjectGroupMemberRole,
  UserStatus,
} from '../src/generated/prisma/client.js';
import { HOME_FACULTY_CODE } from '../src/shared/org-units/home-faculty.js';
import { PasswordService } from '../src/shared/password/password.service.js';
import { todayDate } from '../src/shared/time/today.js';
import { readMirrorCsv } from './demo-mirror.js';
import { mirrorRoot } from './seed-data/dut/extract/mirror-tables.js';
import { ROLE_CODES } from './seed-data/roles.js';

const DEMO_USERNAME = 'demo';
const DRY_RUN = process.argv.includes('--dry-run');

// Course name → group, first match wins; anything else is software engineering (programming, projects, internships).
const GROUPS = [
  {
    code: 'CNTT-KTMT',
    name: 'Nhóm Kỹ thuật máy tính',
    match:
      /nhúng|vi điều khiển|vi xử lý|kiến trúc máy tính|cấu trúc máy tính|fpga|kỹ thuật số|tín hiệu|robot|thời gian thực|tiếng nói|kỹ thuật máy tính|ktmt|\bhtn\b/i,
  },
  {
    code: 'CNTT-KHMT',
    name: 'Nhóm Khoa học máy tính',
    match: /nơron|dữ liệu lớn|khoa học dữ liệu|khdl|trí tuệ/i,
  },
  {
    code: 'CNTT-MMT',
    name: 'Nhóm Mạng và An toàn thông tin',
    match:
      /mạng|truyền số liệu|chuyển mạch|an toàn|bảo mật|mật mã|mã hóa|mã độc|điều tra số|xâm nhập|iot|đám mây|linux|hệ điều hành|attt|blockchain|phân tán/i,
  },
  {
    code: 'CNTT-HTTT',
    name: 'Nhóm Hệ thống thông tin',
    match:
      /cơ sở dữ liệu|hệ thống thông tin|httt|thương mại điện tử|doanh nghiệp|ra quyết định|xử lý dữ liệu|tích hợp hệ thống|hướng dịch vụ|ngữ nghĩa/i,
  },
  {
    code: 'CNTT-KHMT',
    name: 'Nhóm Khoa học máy tính',
    match:
      /học máy|học sâu|khai phá|cấu trúc dữ liệu|giải thuật|toán|ngôn ngữ hình thức|chương trình dịch|xử lý ảnh|ngôn ngữ tự nhiên|nhận dạng|đồ họa|thị giác|logic|lý thuyết thông tin|python|tính toán|tri thức|thông minh|song song|trực quan hóa|mô hình hóa|đặc tả|lập trình hàm|phương pháp tính|quy hoạch/i,
  },
] as const;
const DEFAULT_GROUP = { code: 'CNTT-CNPM', name: 'Nhóm Công nghệ phần mềm' };
const GROUP_NAMES = new Map<string, string>([
  ...GROUPS.map((group) => [group.code, group.name] as const),
  [DEFAULT_GROUP.code, DEFAULT_GROUP.name],
]);
const SUPERVISED = /pbl|đồ án|thực tập|capstone|chuyên đề|dự án/i;
const groupOf = (courseName: string) =>
  GROUPS.find((group) => group.match.test(courseName))?.code ??
  DEFAULT_GROUP.code;

// Who coordinates each group. `demo` is the existing demo account; the others are sample accounts.
const COORDINATORS: Record<string, string> = {
  'CNTT-CNPM': DEMO_USERNAME,
  'CNTT-HTTT': 'dp.httt',
  'CNTT-KHMT': 'dp.khmt',
  'CNTT-MMT': 'dp.mmt',
  'CNTT-KTMT': 'dp.ktmt',
};

// Program tracks, by the suffix of the program code; each track has one director (SRS §6.1.3: every director
// of every program a change touches must agree).
const TRACKS = [
  { match: /-CNPM$/, director: DEMO_USERNAME },
  { match: /-HTTT$/, director: 'gd.httt' },
  { match: /-(ATTT|ATKGS)$/, director: 'gd.attt' },
  { match: /-KHDL$/, director: 'gd.khdl' },
  { match: /-(KTMT|MANG|HTN)$/, director: 'gd.ktmt' },
  { match: /-(NHAT|ANH)$/, director: 'gd.nn' },
] as const;
const DEFAULT_DIRECTOR = 'gd.cntt';
const directorOf = (programCode: string) =>
  TRACKS.find((track) => track.match.test(programCode))?.director ??
  DEFAULT_DIRECTOR;

const SAMPLE_PEOPLE: Record<string, { fullName: string; roles: string[] }> = {
  'dp.httt': {
    fullName: 'Điều phối nhóm Hệ thống thông tin',
    roles: [ROLE_CODES.R4, ROLE_CODES.R5],
  },
  'dp.khmt': {
    fullName: 'Điều phối nhóm Khoa học máy tính',
    roles: [ROLE_CODES.R4, ROLE_CODES.R5],
  },
  'dp.mmt': {
    fullName: 'Điều phối nhóm Mạng và An toàn thông tin',
    roles: [ROLE_CODES.R4, ROLE_CODES.R5],
  },
  'dp.ktmt': {
    fullName: 'Điều phối nhóm Kỹ thuật máy tính',
    roles: [ROLE_CODES.R4, ROLE_CODES.R5],
  },
  'gv.cnpm': {
    fullName: 'Giảng viên nhóm Công nghệ phần mềm',
    roles: [ROLE_CODES.R5],
  },
  'gd.httt': {
    fullName: 'Giám đốc CTĐT Hệ thống thông tin',
    roles: [ROLE_CODES.R3],
  },
  'gd.attt': {
    fullName: 'Giám đốc CTĐT An toàn thông tin',
    roles: [ROLE_CODES.R3],
  },
  'gd.khdl': {
    fullName: 'Giám đốc CTĐT Khoa học dữ liệu và Trí tuệ nhân tạo',
    roles: [ROLE_CODES.R3],
  },
  'gd.ktmt': {
    fullName: 'Giám đốc CTĐT Kỹ thuật máy tính và Mạng',
    roles: [ROLE_CODES.R3],
  },
  'gd.nn': {
    fullName: 'Giám đốc CTĐT Công nghệ thông tin ngoại ngữ',
    roles: [ROLE_CODES.R3],
  },
  'gd.cntt': {
    fullName: 'Giám đốc CTĐT Công nghệ thông tin',
    roles: [ROLE_CODES.R3],
  },
};
// The sample lecturer writes syllabus changes in the CNPM group, so the demo account coordinates them.
const SAMPLE_MEMBERS: Record<string, string> = { 'gv.cnpm': 'CNTT-CNPM' };

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const counts: Record<string, number> = {};
const tally = (key: string, by = 1) => (counts[key] = (counts[key] ?? 0) + by);

try {
  const password = process.env.DEMO_STAFF_PASSWORD;
  if (!password && !DRY_RUN)
    throw new Error('Đặt DEMO_STAFF_PASSWORD cho các tài khoản mẫu.');
  const today = todayDate();
  const faculty = await prisma.orgUnit.findUniqueOrThrow({
    where: { unitCode: HOME_FACULTY_CODE },
  });
  const demo = await prisma.user.findUniqueOrThrow({
    where: { username: DEMO_USERNAME },
  });

  // 1. Subject groups.
  const groupIds = new Map<string, string>();
  for (const [code, name] of GROUP_NAMES) {
    const existing = await prisma.subjectGroup.findUnique({
      where: { groupCode: code },
    });
    if (existing) groupIds.set(code, existing.id);
    else if (!DRY_RUN) {
      const row = await prisma.subjectGroup.create({
        data: { groupCode: code, groupName: name, facultyId: faculty.id },
      });
      groupIds.set(code, row.id);
      tally('nhóm mới');
    } else tally('nhóm mới');
  }

  // 2. Every home-faculty course into a group.
  const courses = await prisma.course.findMany({
    where: { ownerFacultyId: faculty.id },
    select: {
      id: true,
      courseCode: true,
      courseName: true,
      ownerGroupId: true,
    },
  });
  const courseGroup = new Map<string, string>();
  // Projects, internships and theses are supervised across groups, so they say nothing about a lecturer's group.
  const supervised = new Set<string>();
  for (const course of courses) {
    const code = groupOf(course.courseName);
    courseGroup.set(course.courseCode, code);
    if (SUPERVISED.test(course.courseName)) supervised.add(course.courseCode);
    tally(`học phần → ${code}`);
    const groupId = groupIds.get(code);
    if (!DRY_RUN && groupId && course.ownerGroupId !== groupId) {
      await prisma.course.update({
        where: { id: course.id },
        data: { ownerGroupId: groupId },
      });
    }
  }

  // 3. Sample accounts and their roles.
  const passwordHash = password
    ? await new PasswordService().hash(password)
    : '';
  const users = new Map<string, string>([[DEMO_USERNAME, demo.id]]);
  for (const [username, person] of Object.entries(SAMPLE_PEOPLE)) {
    if (DRY_RUN) {
      tally('tài khoản mẫu');
      continue;
    }
    const user = await prisma.user.upsert({
      where: { username },
      create: {
        username,
        userCode: `MAU-${username.toUpperCase()}`,
        fullName: person.fullName,
        passwordHash,
        mustChangePassword: false,
        status: UserStatus.ACTIVE,
        orgUnitId: faculty.id,
      },
      update: { fullName: person.fullName, passwordHash },
    });
    users.set(username, user.id);
    tally('tài khoản mẫu');
    for (const roleCode of person.roles) {
      const role = await prisma.role.findUniqueOrThrow({ where: { roleCode } });
      const held = await prisma.roleAssignment.findFirst({
        where: {
          userId: user.id,
          roleId: role.id,
          revokedAt: null,
          OR: [{ validTo: null }, { validTo: { gte: today } }],
        },
      });
      if (!held)
        await prisma.roleAssignment.create({
          data: {
            userId: user.id,
            roleId: role.id,
            scopeType: ScopeType.SYSTEM,
            validFrom: today,
          },
        });
    }
  }

  const activeMembership = (
    lecturerId: string,
    subjectGroupId: string,
    memberRole: SubjectGroupMemberRole,
  ) =>
    prisma.subjectGroupMember.findFirst({
      where: {
        lecturerId,
        subjectGroupId,
        memberRole,
        revokedAt: null,
        OR: [{ validTo: null }, { validTo: { gte: today } }],
      },
    });
  const join = async (
    lecturerId: string,
    groupCode: string,
    memberRole: SubjectGroupMemberRole,
  ) => {
    const subjectGroupId = groupIds.get(groupCode);
    if (!subjectGroupId) return;
    if (await activeMembership(lecturerId, subjectGroupId, memberRole)) return;
    await prisma.subjectGroupMember.create({
      data: {
        lecturerId,
        subjectGroupId,
        memberRole,
        validFrom: today,
        assignedById: demo.id,
      },
    });
    tally(
      memberRole === SubjectGroupMemberRole.COORDINATOR
        ? 'điều phối'
        : 'thành viên',
    );
  };

  // 4. Coordinators, and the sample lecturer.
  if (!DRY_RUN) {
    for (const [groupCode, username] of Object.entries(COORDINATORS))
      await join(
        users.get(username)!,
        groupCode,
        SubjectGroupMemberRole.COORDINATOR,
      );
    for (const [username, groupCode] of Object.entries(SAMPLE_MEMBERS))
      await join(
        users.get(username)!,
        groupCode,
        SubjectGroupMemberRole.MEMBER,
      );
  }

  // 5. Real lecturers join the group they teach most in (the school's lecturer–course table).
  const root = mirrorRoot(
    process.argv.slice(2).find((arg) => !arg.startsWith('--')),
  );
  const teaching = [
    ...(await readMirrorCsv(root, 'DATA_GVien1', 'tmHocphanGV')),
    ...(await readMirrorCsv(root, 'tmProxDUT', 'tmHocphanGV')),
  ];
  const taught = new Map<string, Map<string, number>>();
  for (const row of teaching) {
    const group = courseGroup.get(row.MaHP);
    if (!group || !row.MaHS || supervised.has(row.MaHP)) continue;
    const byGroup = taught.get(row.MaHS) ?? new Map<string, number>();
    byGroup.set(group, (byGroup.get(group) ?? 0) + 1);
    taught.set(row.MaHS, byGroup);
  }
  const lecturers = await prisma.user.findMany({
    where: { userCode: { in: [...taught.keys()] } },
    select: { id: true, userCode: true },
  });
  for (const lecturer of lecturers) {
    const [top] = [...taught.get(lecturer.userCode)!.entries()].sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
    );
    if (DRY_RUN) tally(`giảng viên → ${top[0]}`);
    else await join(lecturer.id, top[0], SubjectGroupMemberRole.MEMBER);
  }

  // 6. One director per program track; the demo account keeps only the CNPM programs.
  const programs = await prisma.program.findMany({
    select: { id: true, programCode: true },
  });
  for (const program of programs) {
    const username = directorOf(program.programCode);
    tally(`CTĐT → ${username}`);
    if (DRY_RUN) continue;
    const directorId = users.get(username)!;
    const active = await prisma.programDirectorAssignment.findMany({
      where: {
        programId: program.id,
        revokedAt: null,
        OR: [{ validTo: null }, { validTo: { gte: today } }],
      },
    });
    const others = active.filter((row) => row.directorId !== directorId);
    if (others.length > 0) {
      await prisma.programDirectorAssignment.updateMany({
        where: { id: { in: others.map((row) => row.id) } },
        data: { revokedAt: new Date(), revokedById: demo.id },
      });
      tally('phân công cũ thu hồi', others.length);
    }
    if (!active.some((row) => row.directorId === directorId)) {
      await prisma.programDirectorAssignment.create({
        data: {
          programId: program.id,
          directorId,
          validFrom: today,
          assignedById: demo.id,
        },
      });
      tally('phân công mới');
    }
  }

  console.log(DRY_RUN ? 'Chạy thử, chưa ghi gì:' : 'Đã ghi:');
  for (const [key, value] of Object.entries(counts).sort())
    console.log(`  ${key}: ${value}`);
} finally {
  await prisma.$disconnect();
}
