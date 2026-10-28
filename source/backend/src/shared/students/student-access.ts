import type { Prisma } from '../../generated/prisma/client.js';
import type {
  AccessContext,
  ActiveAssignment,
} from '../authz/access-context.js';
import { PERMISSIONS, type PermissionCode } from '../authz/permission-codes.js';
import { AppException } from '../exception/app.exception.js';
import { COMMON_ERRORS } from '../exception/error-codes.js';
import type { StartedSemester } from '../releases/semester-start.js';
import { enrollmentCoversWhere } from './enrollment-period.js';
import { STUDENT_ROLES } from './student.constants.js';
import { STUDENT_ERRORS } from './student.errors.js';

export type StudentReadPurpose = 'PROGRESS' | 'ELIGIBILITY' | 'GRADUATION';

const PURPOSE_PERMISSIONS: Record<StudentReadPurpose, PermissionCode[]> = {
  PROGRESS: [PERMISSIONS.STUDENT_VIEW_PROGRESS],
  ELIGIBILITY: [PERMISSIONS.STUDENT_VIEW_REGISTRATION_ELIGIBILITY],
  GRADUATION: [PERMISSIONS.GRADUATION_VIEW, PERMISSIONS.GRADUATION_AUDIT],
};

// The role and the unrestricted direct grant must sit in one assignment; a broad grant held through another role does not lend itself to R1.
function officeHolds(access: AccessContext, code: PermissionCode): boolean {
  return access.assignments.some((assignment) => {
    const grant = assignment.permissions.get(code);
    return (
      assignment.roleCode === STUDENT_ROLES.OFFICE &&
      grant?.mode === 'DIRECT' &&
      grant.scope === 'ALL'
    );
  });
}

function assertOffice(access: AccessContext, code: PermissionCode): void {
  if (officeHolds(access, code)) return;
  throw new AppException(
    access.has(code)
      ? COMMON_ERRORS.OUT_OF_SCOPE
      : COMMON_ERRORS.PERMISSION_DENIED,
  );
}

export function assertStudentImport(access: AccessContext): void {
  assertOffice(access, PERMISSIONS.DATA_IMPORT_EXCEL);
}

export function assertStudentEnrollmentWrite(access: AccessContext): void {
  assertOffice(access, PERMISSIONS.VERSION_ASSIGN_COHORT);
}

export function holdsStudentEnrollmentWrite(access: AccessContext): boolean {
  return officeHolds(access, PERMISSIONS.VERSION_ASSIGN_COHORT);
}

export function holdsStudentImport(access: AccessContext): boolean {
  return officeHolds(access, PERMISSIONS.DATA_IMPORT_EXCEL);
}

function holdsPurpose(
  assignment: ActiveAssignment,
  purpose: StudentReadPurpose,
): boolean {
  return PURPOSE_PERMISSIONS[purpose].some((code) =>
    assignment.permissions.has(code),
  );
}

// R1 and the owning student may read a transcript before any enrollment resolves; a program director needs an enrollment in a directed program.
export function readsWithoutEnrollment(
  access: AccessContext,
  purpose: StudentReadPurpose,
  student: { id: string; userId: string | null },
): boolean {
  return access.assignments.some(
    (assignment) =>
      holdsPurpose(assignment, purpose) &&
      (assignment.roleCode === STUDENT_ROLES.OFFICE ||
        (assignment.roleCode === STUDENT_ROLES.SELF &&
          student.userId !== null &&
          student.userId === access.userId &&
          (assignment.scope.all ||
            assignment.scope.studentIds.has(student.id)))),
  );
}

const NOBODY: Prisma.StudentWhereInput = { id: { in: [] } };

// OR of what each assignment allows; an empty filter means one assignment reaches every student.
export function studentReadWhere(
  access: AccessContext,
  purpose: StudentReadPurpose,
  programId: string | undefined,
  semester?: StartedSemester,
): Prisma.StudentWhereInput {
  const enrolledIn = (
    programIds?: readonly string[],
  ): Prisma.StudentWhereInput => ({
    enrollments: {
      some: {
        ...(programIds ? { programId: { in: [...programIds] } } : {}),
        ...(programId ? { programId } : {}),
        ...(semester ? enrollmentCoversWhere(semester) : {}),
      },
    },
  });
  const clauses: Prisma.StudentWhereInput[] = [];
  for (const assignment of access.assignments) {
    if (!holdsPurpose(assignment, purpose)) continue;
    if (assignment.roleCode === STUDENT_ROLES.OFFICE) {
      if (!programId && !semester) return {};
      clauses.push(enrolledIn());
    } else if (assignment.roleCode === STUDENT_ROLES.DIRECTOR) {
      clauses.push(
        enrolledIn(
          assignment.scope.all ? undefined : [...assignment.scope.programIds],
        ),
      );
    } else if (assignment.roleCode === STUDENT_ROLES.SELF) {
      const own: Prisma.StudentWhereInput = { userId: access.userId };
      clauses.push(programId || semester ? { AND: [own, enrolledIn()] } : own);
    }
  }
  return clauses.length ? { OR: clauses } : NOBODY;
}

export function assertStudentProgramRead(
  access: AccessContext,
  purpose: StudentReadPurpose,
  student: { id: string; userId: string | null },
  programId: string,
): void {
  for (const assignment of access.assignments) {
    if (!holdsPurpose(assignment, purpose)) continue;
    if (assignment.roleCode === STUDENT_ROLES.OFFICE) return;
    if (
      assignment.roleCode === STUDENT_ROLES.DIRECTOR &&
      (assignment.scope.all || assignment.scope.programIds.has(programId))
    )
      return;
    if (
      assignment.roleCode === STUDENT_ROLES.SELF &&
      student.userId !== null &&
      student.userId === access.userId &&
      (assignment.scope.all || assignment.scope.studentIds.has(student.id))
    )
      return;
  }
  // A personal object outside the caller's scope must not reveal that it exists.
  throw new AppException(STUDENT_ERRORS.STUDENT_NOT_FOUND);
}

export type StaffStudentScope =
  { all: true } | { all: false; programIds: ReadonlySet<string> };

// Staff surfaces never serve a student's own record: an R6-only caller is refused here, before any query.
export function staffStudentScope(
  access: AccessContext,
  purpose: StudentReadPurpose = 'PROGRESS',
): StaffStudentScope {
  const programIds = new Set<string>();
  let held = false;
  for (const assignment of access.assignments) {
    if (!holdsPurpose(assignment, purpose)) continue;
    if (assignment.roleCode === STUDENT_ROLES.OFFICE) return { all: true };
    if (assignment.roleCode === STUDENT_ROLES.DIRECTOR) {
      if (assignment.scope.all) return { all: true };
      held = true;
      assignment.scope.programIds.forEach((id) => programIds.add(id));
    }
  }
  if (!held) throw new AppException(COMMON_ERRORS.PERMISSION_DENIED);
  return { all: false, programIds };
}
