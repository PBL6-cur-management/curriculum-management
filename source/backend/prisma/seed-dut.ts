import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, ScopeType } from '../src/generated/prisma/client.js';
import { ORG_UNIT_CODES } from './seed-data/org-units.js';
import { ROLE_CODES } from './seed-data/roles.js';
import { readDutData } from './seed-data/dut/load/read-dut-data.js';
import { seedDutCatalog } from './seed-data/dut/load/seed-catalog.js';
import { seedDutPrograms } from './seed-data/dut/load/seed-programs.js';
import { seedDutPeople } from './seed-data/dut/load/seed-people.js';
import { readDutPeople } from './seed-data/dut/people-data.js';
import peopleReport from './seed-data/dut/data/people-report.json' with { type: 'json' };

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const BASE_SEED_REQUIRED =
  'The base seed has not run: run `pnpm prisma:seed` first, then `pnpm prisma:seed:dut`';

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

try {
  const [university, faculty] = await Promise.all([
    prisma.orgUnit.findUnique({
      where: { unitCode: ORG_UNIT_CODES.UNIVERSITY },
      select: { id: true },
    }),
    prisma.orgUnit.findUnique({
      where: { unitCode: ORG_UNIT_CODES.FACULTY_IT },
      select: { id: true },
    }),
  ]);
  if (!university || !faculty) throw new Error(BASE_SEED_REQUIRED);
  const publisherId = await findPublisherId();
  const data = readDutData();
  const catalog = await seedDutCatalog(prisma, data.catalog, {
    universityId: university.id,
    facultyId: faculty.id,
  });
  const programs = await seedDutPrograms(prisma, data.programs, {
    facultyId: faculty.id,
    publisherId,
    catalog,
  });
  for (const kind of [
    'units',
    'courses',
    'relations',
    'semesters',
    'cohorts',
  ] as const) {
    const counts = catalog.counts[kind];
    console.log(
      `${kind}: created ${counts.created}; skipped ${counts.skipped}${kind === 'relations' ? `; cycle skipped ${catalog.relationsSkippedCycle}` : ''}`,
    );
  }
  console.log(
    `programs: created ${programs.created.length}; skipped ${programs.skippedExisting.length}`,
  );
  for (const difference of catalog.semesterDateDifferences) {
    console.log(
      `${difference.semesterCode}: ${difference.existing ?? 'null'} → ${difference.legacy}`,
    );
  }
  const people = readDutPeople();
  if (!people)
    console.log(
      'people: skipped (run `pnpm dut:extract` with the school dump first)',
    );
  else {
    const seeded = await seedDutPeople(prisma, {
      people,
      programs: data.programs,
      // The latest term with results is the open one (tmKehoach.Hientai is set on several terms).
      openTermCode: peopleReport.resultTerms.at(-1)!,
      facultyId: faculty.id,
    });
    console.log(
      `lecturers: created ${seeded.lecturers.created}; skipped ${seeded.lecturers.skipped}`,
    );
    console.log(
      `students: created ${seeded.students.created}; skipped ${seeded.students.skipped}`,
    );
    console.log(
      `results: created ${seeded.results.created}; past term without score ${seeded.results.skippedPastWithoutScore}; unknown course ${seeded.results.skippedUnknownCourse}`,
    );
    if (seeded.credentialsFile)
      console.log(`lecturer temporary passwords: ${seeded.credentialsFile}`);
  }
  console.log('DUT seed done.');
} finally {
  await prisma.$disconnect();
}
