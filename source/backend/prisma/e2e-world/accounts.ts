import {
  ScopeType,
  SubjectGroupMemberRole,
  type PrismaClient,
} from '../../src/generated/prisma/client.js';
import { PasswordService } from '../../src/shared/password/password.service.js';
import { todayDate } from '../../src/shared/time/today.js';
import { ORG_UNIT_CODES } from '../seed-data/org-units.js';
import { ROLE_CODES, type RoleCode } from '../seed-data/roles.js';
import { DEMO_GROUP_CODES } from './catalog.js';
import { DEMO_PROGRAM_CODES } from './programs.js';

// One password for every demo account (E2E_PASSWORD). R3, R4 and R5 are derived roles: they exist only through
// the director or membership rows below. R2 and R6 are manual assignments. R6 is derived from enrolment in the final
// design (F-17) so the UI refuses to assign it; the seed writes the row directly, as the e2e tests do, with a UNIT scope
// on Phòng Đào tạo: a unit scope that covers the program's own faculty would still read its Drafts (F-06 D2).
export const DEMO_ACCOUNTS: readonly {
  username: string;
  userCode: string;
  fullName: string;
  manualRole?: RoleCode;
}[] = [
  {
    username: 'e2e.r2.lanhdao',
    userCode: 'E2EGV001',
    fullName: 'TS. Lê Văn Minh',
    manualRole: ROLE_CODES.R2,
  },
  {
    username: 'e2e.r3.giamdoc',
    userCode: 'E2EGV002',
    fullName: 'TS. Trần Thị Hương',
  },
  {
    username: 'e2e.r3.giamdoc2',
    userCode: 'E2EGV003',
    fullName: 'TS. Phạm Quốc Bảo',
  },
  {
    username: 'e2e.r4.dieuphoi',
    userCode: 'E2EGV004',
    fullName: 'ThS. Nguyễn Hoàng Anh',
  },
  {
    username: 'e2e.r4.dieuphoi2',
    userCode: 'E2EGV005',
    fullName: 'ThS. Võ Thanh Tùng',
  },
  {
    username: 'e2e.r5.giangvien',
    userCode: 'E2EGV006',
    fullName: 'ThS. Đặng Thị Lan',
  },
  {
    username: 'e2e.r5.giangvien2',
    userCode: 'E2EGV007',
    fullName: 'ThS. Hồ Minh Khôi',
  },
  {
    username: 'e2e.r6.sinhvien',
    userCode: '999240001',
    fullName: 'Nguyễn Minh Quân',
    manualRole: ROLE_CODES.R6,
  },
];

const MEMBERSHIPS: readonly {
  username: string;
  groupCode: string;
  memberRole: SubjectGroupMemberRole;
}[] = [
  {
    username: 'e2e.r4.dieuphoi',
    groupCode: DEMO_GROUP_CODES.KHMT,
    memberRole: SubjectGroupMemberRole.COORDINATOR,
  },
  {
    username: 'e2e.r4.dieuphoi2',
    groupCode: DEMO_GROUP_CODES.CNPM,
    memberRole: SubjectGroupMemberRole.COORDINATOR,
  },
  {
    username: 'e2e.r5.giangvien',
    groupCode: DEMO_GROUP_CODES.KHMT,
    memberRole: SubjectGroupMemberRole.MEMBER,
  },
  {
    username: 'e2e.r5.giangvien2',
    groupCode: DEMO_GROUP_CODES.CNPM,
    memberRole: SubjectGroupMemberRole.MEMBER,
  },
];

const DIRECTORS: readonly { username: string; programCode: string }[] = [
  { username: 'e2e.r3.giamdoc', programCode: DEMO_PROGRAM_CODES.MAIN },
  { username: 'e2e.r3.giamdoc2', programCode: DEMO_PROGRAM_CODES.SECOND },
];

// Users and manual role rows. Existing accounts are left as they are (password included).
export async function seedDemoAccounts(
  prisma: PrismaClient,
  password: string,
): Promise<void> {
  const faculty = await prisma.orgUnit.findUniqueOrThrow({
    where: { unitCode: ORG_UNIT_CODES.FACULTY_IT },
  });
  const studentScope = await prisma.orgUnit.findUniqueOrThrow({
    where: { unitCode: ORG_UNIT_CODES.ACADEMIC_OFFICE },
  });
  const today = todayDate();
  const admin = await prisma.user.findFirst({ where: { userCode: 'ADMIN' } });
  const hasher = new PasswordService();
  for (const account of DEMO_ACCOUNTS) {
    const existing = await prisma.user.findUnique({
      where: { username: account.username },
    });
    const user =
      existing ??
      (await prisma.user.create({
        data: {
          username: account.username,
          userCode: account.userCode,
          fullName: account.fullName,
          passwordHash: await hasher.hash(password),
          mustChangePassword: false,
          orgUnitId: faculty.id,
        },
      }));
    if (!account.manualRole) continue;
    const role = await prisma.role.findUniqueOrThrow({
      where: { roleCode: account.manualRole },
    });
    const isStudent = account.manualRole === ROLE_CODES.R6;
    const hasRow = await prisma.roleAssignment.findFirst({
      where: { userId: user.id, roleId: role.id, revokedAt: null },
    });
    if (!hasRow) {
      await prisma.roleAssignment.create({
        data: {
          userId: user.id,
          roleId: role.id,
          scopeType: isStudent ? ScopeType.UNIT : ScopeType.SYSTEM,
          scopeUnitId: isStudent ? studentScope.id : null,
          validFrom: today,
          assignedById: admin?.id ?? null,
        },
      });
    }
  }
}

// Needs the groups and programs of the catalog and program steps.
export async function seedDemoAssignments(prisma: PrismaClient): Promise<void> {
  const today = todayDate();
  const admin = await prisma.user.findFirst({ where: { userCode: 'ADMIN' } });
  for (const member of MEMBERSHIPS) {
    const lecturer = await prisma.user.findUniqueOrThrow({
      where: { username: member.username },
    });
    const group = await prisma.subjectGroup.findUniqueOrThrow({
      where: { groupCode: member.groupCode },
    });
    const exists = await prisma.subjectGroupMember.findFirst({
      where: {
        lecturerId: lecturer.id,
        subjectGroupId: group.id,
        memberRole: member.memberRole,
        revokedAt: null,
      },
    });
    if (!exists) {
      await prisma.subjectGroupMember.create({
        data: {
          lecturerId: lecturer.id,
          subjectGroupId: group.id,
          memberRole: member.memberRole,
          validFrom: today,
          assignedById: admin?.id ?? null,
        },
      });
    }
  }
  for (const director of DIRECTORS) {
    const user = await prisma.user.findUniqueOrThrow({
      where: { username: director.username },
    });
    const program = await prisma.program.findUniqueOrThrow({
      where: { programCode: director.programCode },
    });
    const exists = await prisma.programDirectorAssignment.findFirst({
      where: { directorId: user.id, programId: program.id, revokedAt: null },
    });
    if (!exists) {
      await prisma.programDirectorAssignment.create({
        data: {
          directorId: user.id,
          programId: program.id,
          validFrom: today,
          assignedById: admin?.id ?? null,
        },
      });
    }
  }
}
