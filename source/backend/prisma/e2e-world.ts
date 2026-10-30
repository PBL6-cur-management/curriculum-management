import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import {
  PASSWORD_MIN_LENGTH,
  PASSWORD_PATTERN,
} from '../src/shared/password/password-policy.js';
import { ORG_UNIT_CODES } from './seed-data/org-units.js';
import { seedPrograms } from './seed-data/programs.js';
import { ROLE_CODES } from './seed-data/roles.js';
import { seedDemoAccounts, seedDemoAssignments } from './e2e-world/accounts.js';
import { seedDemoCatalog } from './e2e-world/catalog.js';
import { seedDemoOutcomes } from './e2e-world/outcomes.js';
import { seedDemoPrograms } from './e2e-world/programs.js';
import { seedDemoCloLinks, seedDemoSyllabi } from './e2e-world/syllabi.js';

// The world the Playwright suite runs in, written into the real database before a run and removed after it by
// `pnpm e2e:purge`. Accounts are `e2e.*`, groups and units `E2E-*`; course and program codes are listed in
// e2e-world/ so the purge can find them. Safe to run again: every row is keyed on its natural code.
const password = process.env.E2E_PASSWORD;
if (
  !password ||
  password.length < PASSWORD_MIN_LENGTH ||
  !PASSWORD_PATTERN.test(password)
) {
  throw new Error(
    'E2E_PASSWORD must be set, at least 8 characters, with a letter and a digit',
  );
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

try {
  const [faculty, roles] = await Promise.all([
    prisma.orgUnit.findUnique({
      where: { unitCode: ORG_UNIT_CODES.FACULTY_IT },
    }),
    prisma.role.count({
      where: { roleCode: { in: Object.values(ROLE_CODES) } },
    }),
  ]);
  if (!faculty || roles < Object.values(ROLE_CODES).length)
    throw new Error('The base seed has not run: run `pnpm prisma:seed` first');
  await seedPrograms(prisma);
  await seedDemoAccounts(prisma, password);
  await seedDemoCatalog(prisma);
  const { mainVersionId } = await seedDemoPrograms(prisma);
  await seedDemoAssignments(prisma);
  await seedDemoSyllabi(prisma);
  await seedDemoOutcomes(prisma, mainVersionId);
  await seedDemoCloLinks(prisma, mainVersionId);
  console.log('E2E world ready.');
} finally {
  await prisma.$disconnect();
}
