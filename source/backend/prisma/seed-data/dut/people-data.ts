import { createReadStream, existsSync, readFileSync } from 'node:fs';
import { createInterface } from 'node:readline';

// Personal data extracted from the school dump. People and results live in data/private/ (gitignored);
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
  emailLocalPart: string | null;
}
export interface DutStudent {
  studentCode: string;
  fullName: string;
  frameCode: string;
  admissionTermCode: string;
  onLeave: boolean;
}
export interface DutResult {
  studentCode: string;
  courseCode: string;
  termCode: string;
  score10: string | null;
  score4: string | null;
  letterGrade: string | null;
}
export interface DutPeopleReport {
  malformedLines: Record<string, number>;
  lecturers: number;
  lecturersByUnit: Record<string, number>;
  lecturersWithEmail: number;
  students: number;
  studentsOnLeave: number;
  resultRowsRead: number;
  resultsKept: number;
  resultsWithoutScore: number;
  resultTerms: string[];
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
