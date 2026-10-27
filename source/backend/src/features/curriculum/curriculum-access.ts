import {
  ProgramVersionStatus,
  type Prisma,
} from '../../generated/prisma/client.js';
import type {
  AccessContext,
  ScopeTarget,
} from '../../shared/authz/access-context.js';
import { PERMISSIONS } from '../../shared/authz/permission-codes.js';
import { REQUEST_DRAFT_SELECT } from '../../shared/change-requests/request-draft.js';
import { assertVersionWritePath } from '../../shared/releases/correction-access.js';
import { AppException } from '../../shared/exception/app.exception.js';
import type { PrismaService } from '../../shared/prisma/prisma.service.js';
import { programEditState } from '../../shared/programs/program-target.js';
import { isSemesterInRange } from '../../shared/curriculum/curriculum-row-rules.js';
import {
  CURRICULUM_CONSTRAINT,
  CURRICULUM_ERRORS,
} from './curriculum.errors.js';

// Everything a write needs to decide on the version, plus what the read screen prints about it.
export const VERSION_SELECT = {
  id: true,
  status: true,
  semesterCount: true,
  programId: true,
  programName: true,
  versionNumber: true,
  correctionOfId: true,
  totalCredits: true,
  compulsoryCredits: true,
  electiveCredits: true,
  program: { select: { id: true, facultyId: true, programCode: true } },
  ...REQUEST_DRAFT_SELECT,
} as const satisfies Prisma.ProgramVersionSelect;
export type VersionRow = Prisma.ProgramVersionGetPayload<{
  select: typeof VERSION_SELECT;
}>;

export function assertDraft(version: Pick<VersionRow, 'status'>): void {
  if (version.status !== ProgramVersionStatus.DRAFT) {
    throw new AppException(CURRICULUM_ERRORS.VERSION_NOT_EDITABLE);
  }
}

// Draft check first: a Pending version of a never-released program is still frozen.
// A request's working copy is written by the request's creator only (F-13); the program's own data keeps the old rule.
export async function assertCurriculumWrite(
  prisma: PrismaService | Prisma.TransactionClient,
  access: AccessContext,
  version: VersionRow,
  target: ScopeTarget,
): Promise<void> {
  assertDraft(version);
  await assertVersionWritePath(
    access,
    PERMISSIONS.CURRICULUM_EDIT,
    target,
    version,
    () => programEditState(prisma, version.programId),
  );
}

export function assertSemesterInRange(
  version: Pick<VersionRow, 'semesterCount'>,
  semester: number,
): void {
  if (isSemesterInRange(version.semesterCount, semester)) {
    return;
  }
  const base = CURRICULUM_ERRORS.SEMESTER_OUT_OF_RANGE;
  throw new AppException(
    { ...base, message: `${base.message} (${version.semesterCount} học kỳ).` },
    [
      {
        field: 'plannedSemester',
        constraints: [CURRICULUM_CONSTRAINT.SEMESTER_RANGE],
      },
    ],
  );
}

// R4/R5 hold curriculum.edit scoped to subject groups; whether a given course matches is decided per row.
export function holdsGroupScope(access: AccessContext): boolean {
  const scope = access.scopeFor(PERMISSIONS.CURRICULUM_EDIT);
  return scope.all || scope.subjectGroupIds.size > 0;
}
