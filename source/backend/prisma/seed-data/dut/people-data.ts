import { createReadStream, existsSync, readFileSync } from 'node:fs';
import { createInterface } from 'node:readline';

// Personal data extracted from the mirror. People and results live in data/private/ (gitignored);
// the report holds counts only and is committed.
export const PEOPLE_DATA_FILES = {
  PEOPLE: 'people.json',
  RESULTS: 'results.jsonl',
  CREDENTIALS: 'lecturer-credentials.csv',
  REPORT: 'people-report.json',
} as const;

export interface DutLecturer {
  staffCode: string;
  fullName: string;
  // MaBP: 102 = Khoa CNTT, 999/998 = thỉnh giảng, 990 = lưu trữ, others = another unit.
  unitCode: string;
  // The school's own value, only when it is a full address; never built from a guessed domain.
  email: string | null;
}
export interface DutStudent {
  studentCode: string;
  fullName: string;
  frameCode: string;
  admissionTermCode: string;
  // IDCodeVao was empty: the term comes from the student code (admissionTermFromStudentCode).
  admissionTermInferred: boolean;
  onLeave: boolean;
}
export interface DutResult {
  studentCode: string;
  courseCode: string;
  termCode: string;
  score10: string | null;
  score4: string | null;
  letterGrade: string | null;
  // tmDiemMien: the course was exempted (miễn học), not taken.
  exempt: boolean;
}
export interface DutPeopleReport {
  malformedLines: Record<string, number>;
  lecturers: number;
  lecturersFromFaculty: number;
  lecturersTeachingOnly: number;
  lecturersByUnit: Record<string, number>;
  lecturersWithEmail: number;
  students: number;
  studentsByAdmissionTerm: Record<string, number>;
  studentsAdmissionInferred: number;
  studentsOnLeave: number;
  // tmHoSoSV.Tinhtrang1 = 1: meaning not confirmed (graduated or left); the seed keeps these students STUDYING.
  studentsFlaggedTinhtrang1: number;
  studentsExcludedByLevel: Record<string, number>;
  resultRowsRead: number;
  resultsKept: number;
  resultsWithoutScore: number;
  resultsByLetter: Record<string, number>;
  exemptionsKept: number;
  exemptionsShadowedByResult: number;
  resultTerms: string[];
  openTermCode: string;
}

export const privateDataUrl = (file: string) =>
  new URL(`./data/private/${file}`, import.meta.url);

export function readDutPeople(): {
  lecturers: DutLecturer[];
  students: DutStudent[];
} | null {
  const url = privateDataUrl(PEOPLE_DATA_FILES.PEOPLE);
  if (!existsSync(url)) return null;
  return JSON.parse(readFileSync(url, 'utf8')) as {
    lecturers: DutLecturer[];
    students: DutStudent[];
  };
}

export async function* readDutResults(): AsyncGenerator<DutResult> {
  const url = privateDataUrl(PEOPLE_DATA_FILES.RESULTS);
  if (!existsSync(url)) return;
  for await (const line of createInterface({
    input: createReadStream(url, 'utf8'),
    crlfDelay: Infinity,
  }))
    if (line.trim()) yield JSON.parse(line) as DutResult;
}
