import type {
  Prisma,
  StudentDataSource,
  StudentStatus,
} from '../../../generated/prisma/client.js';
import type { AppliedProgramVersionReader } from '../../../shared/releases/applied-program-version.reader.js';
import type { CohortAssignmentFact } from '../../../shared/releases/applied-version.types.js';
import { normalizeStudentCode } from '../../../shared/students/student-identity.js';
import type { SheetRow } from '../sheets/sheet-reader.js';
import type { StudentColumn } from '../sheets/student-list.sheet.js';

export interface SemesterFact {
  id: string;
  startDate: Date | null;
}
export interface ExistingStudentFact {
  id: string;
  fullName: string;
  cohortId: string;
  major: string;
  admissionSemesterId: string;
  statusSemesterId: string;
  status: StudentStatus;
  dataSource: StudentDataSource;
  userId: string | null;
  updatedAt: Date;
  primaryProgramId: string | null;
}
export interface StudentImportContext {
  cohortsByCode: Map<string, { id: string }>;
  programsByCode: Map<string, { id: string }>;
  semestersByCode: Map<string, SemesterFact>;
  semestersById: Map<string, SemesterFact>;
  studentsByCode: Map<string, ExistingStudentFact>;
  // Canonical student codes whose username or user code belongs to an account not linked to that student.
  accountConflicts: ReadonlySet<string>;
  // Keyed by assignmentKey(); null when the cohort has no version scheduled for that semester.
  assignments: Map<string, CohortAssignmentFact | null>;
  majorByVersionId: Map<string, string>;
}

export function assignmentKey(
  programId: string,
  cohortId: string,
  semesterId: string,
): string {
  return `${programId}|${cohortId}|${semesterId}`;
}

const distinct = (values: Iterable<string>) => [...new Set(values)].filter(Boolean);

export async function loadStudentContext(
  db: Prisma.TransactionClient,
  rows: readonly SheetRow<StudentColumn>[],
  appliedVersions: AppliedProgramVersionReader,
): Promise<StudentImportContext> {
  const cell = (key: StudentColumn) =>
    rows.map((row) => row.cells[key].trim());
  const studentCodes = distinct(
    cell('studentCode').map(normalizeStudentCode),
  );
  const semesterCodes = distinct([
    ...cell('admissionSemesterCode'),
    ...cell('statusSemesterCode'),
  ]);
  const [cohorts, programs, semesters, students, accounts] = await Promise.all([
    db.cohort.findMany({
      where: { cohortCode: { in: distinct(cell('cohortCode')) } },
      select: { id: true, cohortCode: true },
    }),
    db.program.findMany({
      where: { programCode: { in: distinct(cell('programCode')) } },
      select: { id: true, programCode: true },
    }),
    db.semester.findMany({
      where: { semesterCode: { in: semesterCodes } },
      select: { id: true, semesterCode: true, startDate: true },
    }),
    db.student.findMany({
      where: { studentCode: { in: studentCodes } },
      include: {
        enrollments: {
          where: { enrollmentType: 'PRIMARY' },
          select: { programId: true },
          take: 1,
        },
      },
    }),
    db.user.findMany({
      where: {
        OR: [
          { userCode: { in: studentCodes } },
          { username: { in: studentCodes.map((code) => code.toLowerCase()) } },
        ],
      },
      select: { id: true, userCode: true, username: true },
    }),
  ]);

  const studentsByCode = new Map<string, ExistingStudentFact>();
  const linkedUserByCode = new Map<string, string | null>();
  for (const student of students) {
    linkedUserByCode.set(student.studentCode, student.userId);
    studentsByCode.set(student.studentCode, {
      id: student.id,
      fullName: student.fullName,
      cohortId: student.cohortId,
      major: student.major,
      admissionSemesterId: student.admissionSemesterId,
      statusSemesterId: student.statusSemesterId,
      status: student.status,
      dataSource: student.dataSource,
      userId: student.userId,
      updatedAt: student.updatedAt,
      primaryProgramId: student.enrollments[0]?.programId ?? null,
    });
  }
  const accountConflicts = new Set<string>();
  for (const account of accounts) {
    for (const code of studentCodes) {
      const matches =
        account.userCode === code || account.username === code.toLowerCase();
      if (matches && linkedUserByCode.get(code) !== account.id) {
        accountConflicts.add(code);
      }
    }
  }

  const semestersByCode = new Map<string, SemesterFact>(
    semesters.map((row) => [row.semesterCode, { id: row.id, startDate: row.startDate }]),
  );
  const programsByCode = new Map(programs.map((row) => [row.programCode, { id: row.id }]));
  const cohortsByCode = new Map(cohorts.map((row) => [row.cohortCode, { id: row.id }]));
  const semestersById = new Map<string, SemesterFact>(
    [...semestersByCode.values()].map((row) => [row.id, row]),
  );

  // The chronology check also needs the stored semesters of existing students, which the file may not name.
  const missingIds = distinct(
    [...studentsByCode.values()].flatMap((row) => [
      row.admissionSemesterId,
      row.statusSemesterId,
    ]),
  ).filter((id) => !semestersById.has(id));
  if (missingIds.length > 0) {
    const stored = await db.semester.findMany({
      where: { id: { in: missingIds } },
      select: { id: true, startDate: true },
    });
    for (const row of stored) semestersById.set(row.id, row);
  }

  // New or not-yet-enrolled students are admitted under the version scheduled for their cohort at admission; one forCohorts call per (program, semester).
  const groups = new Map<string, { programId: string; semesterId: string; cohortIds: Set<string> }>();
  for (const row of rows) {
    const cohort = cohortsByCode.get(row.cells.cohortCode.trim());
    const program = programsByCode.get(row.cells.programCode.trim());
    const semester = semestersByCode.get(row.cells.admissionSemesterCode.trim());
    if (!cohort || !program || !semester?.startDate) continue;
    const key = `${program.id}|${semester.id}`;
    const group = groups.get(key) ?? {
      programId: program.id,
      semesterId: semester.id,
      cohortIds: new Set<string>(),
    };
    group.cohortIds.add(cohort.id);
    groups.set(key, group);
  }
  const assignments = new Map<string, CohortAssignmentFact | null>();
  for (const group of groups.values()) {
    const resolutions = await appliedVersions.forCohorts(
      {
        programId: group.programId,
        cohortIds: [...group.cohortIds],
        semesterId: group.semesterId,
      },
      db,
    );
    for (const resolution of resolutions) {
      assignments.set(
        assignmentKey(group.programId, resolution.cohort.id, group.semesterId),
        resolution.assignment,
      );
    }
  }
  const versionIds = distinct(
    [...assignments.values()].flatMap((item) => (item ? [item.version.id] : [])),
  );
  const versions = await db.programVersion.findMany({
    where: { id: { in: versionIds } },
    select: { id: true, majorCode: true },
  });
  return {
    cohortsByCode,
    programsByCode,
    semestersByCode,
    semestersById,
    studentsByCode,
    accountConflicts,
    assignments,
    majorByVersionId: new Map(versions.map((row) => [row.id, row.majorCode])),
  };
}
