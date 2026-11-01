// Public demo only: creates or refreshes the account `demo` that lecturers use on the demo link.
//   DATABASE_URL=... pnpm db:demo-account        (DEMO_USERNAME / DEMO_PASSWORD override "demo"/"demo")
// Deliberately outside the password policy (a short, public password) and holding R1–R5 over the whole
// faculty, with canSelfApprove so one visitor can walk a request through every approval level.
// Never run it against a database real users depend on.
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  PrismaClient,
  ScopeType,
  UserStatus,
} from '../src/generated/prisma/client.js';
import { normalizeUsername } from '../src/shared/auth/username.js';
import { PasswordService } from '../src/shared/password/password.service.js';
import { todayDate } from '../src/shared/time/today.js';
import { ORG_UNIT_CODES } from './seed-data/org-units.js';
import { ROLE_CODES } from './seed-data/roles.js';

const username = normalizeUsername(process.env.DEMO_USERNAME ?? 'demo');
const password = process.env.DEMO_PASSWORD ?? 'demo';
const DEMO_USER_CODE = 'DEMO';
const DEMO_FULL_NAME = 'Tài khoản demo';
// R6 (student) is left out: its scope is always the holder's own enrolment, and it changes the menus.
const DEMO_ROLES = [
  ROLE_CODES.R1,
  ROLE_CODES.R2,
  ROLE_CODES.R3,
  ROLE_CODES.R4,
  ROLE_CODES.R5,
];

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

try {
  const academicOffice = await prisma.orgUnit.findUniqueOrThrow({
    where: { unitCode: ORG_UNIT_CODES.ACADEMIC_OFFICE },
  });
  const account = {
    fullName: DEMO_FULL_NAME,
    passwordHash: await new PasswordService().hash(password),
    mustChangePassword: false,
    canSelfApprove: true,
    status: UserStatus.ACTIVE,
    orgUnitId: academicOffice.id,
  };
  const user = await prisma.user.upsert({
    where: { username },
    create: { username, userCode: DEMO_USER_CODE, ...account },
    update: account,
  });

  const today = todayDate();
  for (const roleCode of DEMO_ROLES) {
    const role = await prisma.role.findUniqueOrThrow({ where: { roleCode } });
    const held = await prisma.roleAssignment.findFirst({
      where: {
        userId: user.id,
        roleId: role.id,
        scopeType: ScopeType.SYSTEM,
        revokedAt: null,
        OR: [{ validTo: null }, { validTo: { gte: today } }],
      },
    });
    if (!held) {
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
  console.log(
    `Tài khoản demo "${username}": vai trò ${DEMO_ROLES.join(', ')} toàn Khoa, được tự duyệt.`,
  );
} finally {
  await prisma.$disconnect();
}
