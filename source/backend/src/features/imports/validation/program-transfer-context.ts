import {
  EnrollmentStatus,
  ProgramVersionStatus,
  type EnrollmentType,
  type Prisma,
  type StudentStatus,
} from '../../../generated/prisma/client.js';
import { normalizeStudentCode } from '../../../shared/students/student-identity.js';
import type { ProgramTransferColumn } from '../sheets/program-transfer.sheet.js';
import type { SheetRow } from '../sheets/sheet-reader.js';

export interface TransferStudentFact {
  id: string;
  studentCode: string;
  status: StudentStatus;
  updatedAt: Date;
  // Every ACTIVE enrollment; the PRIMARY one is the transfer source.
  activeEnrollments: {
    id: string;
    programId: string;
    appliedVersionId: string;
    trackId: string | null;
    enrollmentType: EnrollmentType;
    updatedAt: Date;
    fromSemesterStart: Date | null;
  }[];
}
export interface TransferVersionFact {
  id: string;
  programId: string;
  versionNumber: string;
  publishedAt: Date;
  effectiveStart: Date | null;
  tracks: Map<string, string>;
}
export interface ProgramTransferContext {
  studentsByCode: Map<string, TransferStudentFact>;
  programsByCode: Map<string, { id: string }>;
  versionsByProgram: Map<string, TransferVersionFact[]>;
  semestersByCode: Map<string, { id: string; startDate: Date | null }>;
}

const distinct = (values: Iterable<string>) =>
  [...new Set(values)].filter(Boolean);

export async function loadProgramTransferContext(
  db: Prisma.TransactionClient,
  rows: readonly SheetRow<ProgramTransferColumn>[],
): Promise<ProgramTransferContext> {
  const cell = (key: ProgramTransferColumn) =>
    rows.map((row) => row.cells[key].trim());
  const [students, programs, semesters] = await Promise.all([
    db.student.findMany({
      where: {
        studentCode: {
          in: distinct(cell('studentCode').map(normalizeStudentCode)),
        },
      },
      select: {
        id: true,
        studentCode: true,
        status: true,
        updatedAt: true,
        enrollments: {
          where: { status: EnrollmentStatus.ACTIVE },
          select: {
            id: true,
            programId: true,
            appliedVersionId: true,
            trackId: true,
            enrollmentType: true,
            updatedAt: true,
            fromSemester: { select: { startDate: true } },
          },
        },
      },
    }),
    db.program.findMany({
      where: { programCode: { in: distinct(cell('programCode')) } },
      select: { id: true, programCode: true },
    }),
    db.semester.findMany({
      where: { semesterCode: { in: distinct(cell('semesterCode')) } },
      select: { id: true, semesterCode: true, startDate: true },
    }),
  ]);
  const versions = await db.programVersion.findMany({
    where: {
      programId: { in: programs.map((program) => program.id) },
      status: { not: ProgramVersionStatus.DRAFT },
      sourceRequestId: null,
      versionNumber: { not: null },
      publishedAt: { not: null },
    },
    select: {
      id: true,
      programId: true,
      versionNumber: true,
      publishedAt: true,
      effectiveSemester: { select: { startDate: true } },
      tracks: { select: { id: true, trackCode: true } },
    },
  });
  const versionsByProgram = new Map<string, TransferVersionFact[]>();
  for (const version of versions) {
    const list = versionsByProgram.get(version.programId) ?? [];
    list.push({
      id: version.id,
      programId: version.programId,
      versionNumber: version.versionNumber!,
      publishedAt: version.publishedAt!,
      effectiveStart: version.effectiveSemester?.startDate ?? null,
      tracks: new Map(version.tracks.map((t) => [t.trackCode, t.id])),
    });
    versionsByProgram.set(version.programId, list);
  }
  return {
    studentsByCode: new Map(
      students.map((student) => [
        student.studentCode,
        {
          id: student.id,
          studentCode: student.studentCode,
          status: student.status,
          updatedAt: student.updatedAt,
          activeEnrollments: student.enrollments.map((row) => ({
            id: row.id,
            programId: row.programId,
            appliedVersionId: row.appliedVersionId,
            trackId: row.trackId,
            enrollmentType: row.enrollmentType,
            updatedAt: row.updatedAt,
            fromSemesterStart: row.fromSemester.startDate,
          })),
        },
      ]),
    ),
    programsByCode: new Map(
      programs.map((program) => [program.programCode, { id: program.id }]),
    ),
    versionsByProgram,
    semestersByCode: new Map(
      semesters.map((row) => [
        row.semesterCode,
        { id: row.id, startDate: row.startDate },
      ]),
    ),
  };
}
