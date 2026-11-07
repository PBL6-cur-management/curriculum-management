import {
  ProgramVersionStatus,
  type Prisma,
} from '../../generated/prisma/client.js';
import type { ScopeTarget } from '../authz/access-context.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { programTarget } from './program-target.js';

type Db = PrismaService | Prisma.TransactionClient;

const IN_FORCE_STATUSES = [
  ProgramVersionStatus.ACTIVE,
  ProgramVersionStatus.PENDING,
];

// The programme's own scope plus the subject groups of the courses its in-force versions list, so the lecturers
// who edit those rows (R4, R5) can open a curriculum or PLO/CLO request on the programme.
export async function programContentTarget(
  db: Db,
  program: { id: string; facultyId: string },
): Promise<ScopeTarget> {
  const items = await db.curriculumItem.findMany({
    where: {
      version: {
        programId: program.id,
        sourceRequestId: null,
        status: { in: IN_FORCE_STATUSES },
      },
      course: { ownerGroupId: { not: null } },
    },
    select: { course: { select: { ownerGroupId: true } } },
    distinct: ['courseId'],
  });
  const groupIds = new Set<string>();
  for (const item of items) {
    if (item.course.ownerGroupId) groupIds.add(item.course.ownerGroupId);
  }
  return { ...programTarget(program), subjectGroupIds: [...groupIds] };
}
