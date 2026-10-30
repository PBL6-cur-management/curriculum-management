import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { normalizeUsername } from '../src/shared/auth/username.js';
import {
  PASSWORD_MIN_LENGTH,
  PASSWORD_PATTERN,
} from '../src/shared/password/password-policy.js';
import { PasswordService } from '../src/shared/password/password.service.js';
import { ScopeType } from '../src/generated/prisma/client.js';
import { todayDate } from '../src/shared/time/today.js';
import { ORG_UNIT_CODES } from './seed-data/org-units.js';
import { seedApprovalLevels } from './seed-data/approval-levels.js';
import { seedKnowledgeBlocks } from './seed-data/knowledge-blocks.js';
import { seedSemesters } from './seed-data/semesters.js';
import { seedAccessControl } from './seed-data/seed-access-control.js';
import { ROLE_CODES } from './seed-data/roles.js';

const DEFAULT_ADMIN_USERNAME = 'admin';
const ADMIN_USER_CODE = 'ADMIN';
const ADMIN_FULL_NAME = 'Quản trị hệ thống';

const username = normalizeUsername(
  process.env.SEED_ADMIN_USERNAME ?? DEFAULT_ADMIN_USERNAME,
);
const password = process.env.SEED_ADMIN_PASSWORD;
if (
  !password ||
  password.length < PASSWORD_MIN_LENGTH ||
  !PASSWORD_PATTERN.test(password)
) {
  throw new Error(
    'SEED_ADMIN_PASSWORD must be set, at least 8 characters, with a letter and a digit',
  );
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

try {
  await prisma.user.upsert({
    where: { username },
    create: {
      username,
      userCode: ADMIN_USER_CODE,
      fullName: ADMIN_FULL_NAME,
      passwordHash: await new PasswordService().hash(password),
      mustChangePassword: true,
    },
    update: {},
  });
  await seedAccessControl(prisma);
  await seedApprovalLevels(prisma);
  await seedKnowledgeBlocks(prisma);
  await seedSemesters(prisma);
  const academicOffice = await prisma.orgUnit.findUniqueOrThrow({
    where: { unitCode: ORG_UNIT_CODES.ACADEMIC_OFFICE },
  });
  const r1 = await prisma.role.findUniqueOrThrow({
    where: { roleCode: ROLE_CODES.R1 },
  });
  const admin = await prisma.user.update({
    where: { username },
    data: { orgUnitId: academicOffice.id },
  });
  const hasR1 = await prisma.roleAssignment.findFirst({
    where: { userId: admin.id, roleId: r1.id, revokedAt: null },
  });
  if (!hasR1) {
    await prisma.roleAssignment.create({
      data: {
        userId: admin.id,
        roleId: r1.id,
        scopeType: ScopeType.SYSTEM,
        validFrom: todayDate(),
      },
    });
  }
} finally {
  await prisma.$disconnect();
}
