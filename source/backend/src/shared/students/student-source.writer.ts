import {
  ScopeType,
  StudentStatus,
  UserStatus,
  type Prisma,
} from '../../generated/prisma/client.js';
import { AppException } from '../exception/app.exception.js';
import { lockPrograms } from '../releases/release-locks.js';
import { todayDate } from '../time/today.js';
import {
  createAdmissionEnrollment,
  endStudentEnrollments,
} from './enrollment.writer.js';
import type { PreparedStudentAccount } from './student-account.provisioner.js';
import { lockStudents } from './student-locks.js';
import type {
  SourceWriteContext,
  StudentImportPlan,
  StudentImportPlanRow,
} from './student-import.types.js';
import { STUDENT_ROLES } from './student.constants.js';
import { STUDENT_ERRORS } from './student.errors.js';

const TERMINAL_STATUSES: readonly StudentStatus[] = [
  StudentStatus.WITHDRAWN,
  StudentStatus.GRADUATED,
];

export function assertWriteContext(context: SourceWriteContext): void {
  if (context.source === 'EXCEL' && context.actorId === null) {
    throw new Error('An Excel write needs the performing actor.');
  }
}

export interface StudentSourceWriteOutcome {
  studentIds: string[];
  createdAccountCodes: string[];
}

// One transaction for the whole file: any conflict throws and the caller rolls everything back. Provenance is judged from the rows read under lock, not from the plan.
export async function writeStudentSource(
  tx: Prisma.TransactionClient,
  plan: StudentImportPlan,
  context: SourceWriteContext,
  accounts: readonly PreparedStudentAccount[],
): Promise<StudentSourceWriteOutcome> {
  assertWriteContext(context);
  const rows = [...plan.rows].sort((a, b) => a.rowNumber - b.rowNumber);
  await lockPrograms(
    tx,
    rows.map((row) => row.programId),
  );
  await lockStudents(
    tx,
    rows.flatMap((row) => (row.existingId ? [row.existingId] : [])),
  );

  const accountByCode = new Map(
    accounts.map((account) => [account.studentCode, account]),
  );
  const studentIds: string[] = [];
  const createdAccountCodes: string[] = [];
  const studentRole =
    context.source === 'EXCEL'
      ? await tx.role.findUnique({
          where: { roleCode: STUDENT_ROLES.SELF },
          select: { id: true },
        })
      : null;

  for (const row of rows) {
    if (row.action === 'PRESERVE_SOURCE') continue;
    const studentId = await writeRow(tx, row, context, {
      account: accountByCode.get(row.profile.studentCode),
      roleId: studentRole?.id,
      onAccountCreated: (code) => createdAccountCodes.push(code),
    });
    if (studentId) studentIds.push(studentId);
  }
  return { studentIds, createdAccountCodes };
}

interface RowAccountInput {
  account: PreparedStudentAccount | undefined;
  roleId: string | undefined;
  onAccountCreated: (studentCode: string) => void;
}

async function writeRow(
  tx: Prisma.TransactionClient,
  row: StudentImportPlanRow,
  context: SourceWriteContext,
  accountInput: RowAccountInput,
): Promise<string | null> {
  const { profile } = row;
  const changed = () =>
    new AppException(STUDENT_ERRORS.ENROLLMENT_STATE_CHANGED);
  const current = await tx.student.findUnique({
    where: { studentCode: profile.studentCode },
    select: { id: true, dataSource: true, updatedAt: true },
  });

  if (row.existingId === null) {
    if (current) throw changed();
  } else {
    if (!current || current.id !== row.existingId) throw changed();
    // An official record is never replaced by a spreadsheet, even if it became official after validation.
    if (current.dataSource === 'SCHOOL_DB' && context.source === 'EXCEL') {
      return null;
    }
    if (current.updatedAt.toISOString() !== row.expectedUpdatedAt) {
      throw changed();
    }
  }

  let studentId = current?.id ?? '';
  if (!current) {
    const account = await createAccount(tx, row, context, accountInput);
    const created = await tx.student.create({
      data: {
        ...profile,
        dataSource: context.source,
        userId: account,
      },
      select: { id: true },
    });
    studentId = created.id;
  } else if (
    row.action === 'UPDATE' ||
    row.action === 'CREATE' ||
    current.dataSource !== context.source
  ) {
    await tx.student.update({
      where: { id: current.id },
      data: {
        fullName: profile.fullName,
        cohortId: profile.cohortId,
        major: profile.major,
        admissionSemesterId: profile.admissionSemesterId,
        statusSemesterId: profile.statusSemesterId,
        status: profile.status,
        dataSource: context.source,
      },
    });
  }

  const anyEnrollment = current
    ? await tx.programEnrollment.count({ where: { studentId } })
    : 0;
  if (row.admissionAssignment && anyEnrollment === 0) {
    await createAdmissionEnrollment(tx, {
      studentId,
      programId: row.programId,
      cohortId: profile.cohortId,
      admissionSemesterId: profile.admissionSemesterId,
      assignment: row.admissionAssignment,
      actorId: context.actorId,
      source: context.source,
    });
  }
  if (TERMINAL_STATUSES.includes(profile.status)) {
    await endStudentEnrollments(tx, studentId, profile.statusSemesterId);
  }
  return studentId;
}

// Only a brand-new Excel student gets an account; a synchronized or existing profile never does.
async function createAccount(
  tx: Prisma.TransactionClient,
  row: StudentImportPlanRow,
  context: SourceWriteContext,
  input: RowAccountInput,
): Promise<string | null> {
  const { account, roleId } = input;
  if (context.source !== 'EXCEL' || !account) return null;
  if (!roleId) throw new Error('The student role is not seeded.');
  const clash = await tx.user.findFirst({
    where: {
      OR: [{ userCode: account.studentCode }, { username: account.username }],
    },
    select: { id: true },
  });
  if (clash) throw new AppException(STUDENT_ERRORS.ACCOUNT_IDENTITY_CONFLICT);
  const user = await tx.user.create({
    data: {
      userCode: account.studentCode,
      username: account.username,
      fullName: row.profile.fullName,
      passwordHash: account.passwordHash,
      mustChangePassword: true,
      status: UserStatus.ACTIVE,
      roleAssignments: {
        create: {
          roleId,
          scopeType: ScopeType.SYSTEM,
          validFrom: todayDate(),
          assignedById: context.actorId,
        },
      },
    },
    select: { id: true },
  });
  input.onAccountCreated(account.studentCode);
  return user.id;
}
