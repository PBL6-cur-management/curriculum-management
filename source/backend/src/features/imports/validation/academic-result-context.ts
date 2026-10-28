import type {
  AcademicResultStatus,
  Prisma,
  StudentDataSource,
} from '../../../generated/prisma/client.js';
import { normalizeStudentCode } from '../../../shared/students/student-identity.js';
import type { ResultColumn } from '../sheets/academic-result.sheet.js';
import type { SheetRow } from '../sheets/sheet-reader.js';

export interface ExistingResultFact {
  id: string;
  score10: string | null;
  score4: string | null;
  letterGrade: string | null;
  status: AcademicResultStatus;
  dataSource: StudentDataSource;
  revision: number;
}
export interface AcademicResultImportContext {
  studentsByCode: Map<string, { id: string }>;
  coursesByCode: Map<string, { id: string }>;
  semestersByCode: Map<string, { id: string; startDate: Date | null }>;
  existing: Map<string, ExistingResultFact>;
}

export function resultKey(
  studentId: string,
  courseId: string,
  semesterId: string,
): string {
  return `${studentId}|${courseId}|${semesterId}`;
}

const distinct = (values: Iterable<string>) => [...new Set(values)].filter(Boolean);

export async function loadAcademicResultContext(
  db: Prisma.TransactionClient,
  rows: readonly SheetRow<ResultColumn>[],
): Promise<AcademicResultImportContext> {
  const cell = (key: ResultColumn) => rows.map((row) => row.cells[key].trim());
  const [students, courses, semesters] = await Promise.all([
    db.student.findMany({
      where: { studentCode: { in: distinct(cell('studentCode').map(normalizeStudentCode)) } },
      select: { id: true, studentCode: true },
    }),
    db.course.findMany({
      where: { courseCode: { in: distinct(cell('courseCode').map((code) => code.toUpperCase())) } },
      select: { id: true, courseCode: true },
    }),
    db.semester.findMany({
      where: { semesterCode: { in: distinct(cell('semesterCode')) } },
      select: { id: true, semesterCode: true, startDate: true },
    }),
  ]);
  const existing = await db.academicResult.findMany({
    where: {
      studentId: { in: students.map((row) => row.id) },
      courseId: { in: courses.map((row) => row.id) },
      semesterId: { in: semesters.map((row) => row.id) },
    },
  });
  return {
    studentsByCode: new Map(students.map((row) => [row.studentCode, { id: row.id }])),
    coursesByCode: new Map(courses.map((row) => [row.courseCode, { id: row.id }])),
    semestersByCode: new Map(
      semesters.map((row) => [row.semesterCode, { id: row.id, startDate: row.startDate }]),
    ),
    existing: new Map(
      existing.map((row) => [
        resultKey(row.studentId, row.courseId, row.semesterId),
        {
          id: row.id,
          score10: row.score10?.toString() ?? null,
          score4: row.score4?.toString() ?? null,
          letterGrade: row.letterGrade,
          status: row.status,
          dataSource: row.dataSource,
          revision: row.revision,
        },
      ]),
    ),
  };
}
