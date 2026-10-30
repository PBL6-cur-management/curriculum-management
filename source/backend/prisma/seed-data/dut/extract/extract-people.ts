import { createWriteStream, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DEFAULT_LEGACY_ROOT } from '../dut-data.js';
import { HOME_FACULTY_LEGACY_CODE } from '../legacy-mapping.js';
import { LEGACY_SNAPSHOTS } from './legacy-tables.js';
import { LEGACY_MAJOR_HEADER } from './program-map.js';
import { PEOPLE_TABLES, streamTable } from './people-tables.js';
import {
  PEOPLE_DATA_FILES,
  type DutLecturer,
  type DutPeopleReport,
  type DutResult,
  type DutStudent,
} from '../people-data.js';

// Dump → private JSON for lecturers, students and their results. Output goes to data/private/ (gitignored);
// only counts go to data/people-report.json.
const root = resolve(process.argv[2] ?? DEFAULT_LEGACY_ROOT);
const privateDir = new URL('../data/private/', import.meta.url);
mkdirSync(privateDir, { recursive: true });
const malformedLines: Record<string, number> = {};
const track = (key: string, result: { malformedLines: number }) => {
  malformedLines[key] = result.malformedLines;
};

const lecturers = new Map<string, DutLecturer>();
for (const snapshot of [LEGACY_SNAPSHOTS.DHBK, LEGACY_SNAPSHOTS.SV1]) {
  track(
    `${snapshot}/${PEOPLE_TABLES.LECTURERS.name}`,
    await streamTable(root, snapshot, PEOPLE_TABLES.LECTURERS, (row) => {
      if (row.KhoaPC !== HOME_FACULTY_LEGACY_CODE || !row.MaHS) return;
      lecturers.set(row.MaHS, {
        staffCode: row.MaHS,
        fullName: row.Hoten,
        unitCode: row.MaBP,
        emailLocalPart: /^[a-z0-9._-]+$/i.test(row.Email)
          ? row.Email.toLowerCase()
          : null,
      });
    }),
  );
}

// Data_SV1 is read last, so its record wins when a student appears in both snapshots.
const students = new Map<string, DutStudent>();
for (const snapshot of [LEGACY_SNAPSHOTS.DHBK, LEGACY_SNAPSHOTS.SV1]) {
  track(
    `${snapshot}/${PEOPLE_TABLES.STUDENTS.name}`,
    await streamTable(root, snapshot, PEOPLE_TABLES.STUDENTS, (row) => {
      if (
        !row.MaNganh.startsWith(LEGACY_MAJOR_HEADER) ||
        !/^\d{9}$/.test(row.MaHS)
      )
        return;
      students.set(row.MaHS, {
        studentCode: row.MaHS,
        fullName: row.Hoten,
        frameCode: row.MaNganh,
        // The newest intake has no IDCodeVao yet; digits 4–5 of the student ID are the intake year.
        admissionTermCode: row.IDCodeVao || `${row.MaHS.slice(3, 5)}10`,
        onLeave: false,
      });
    }),
  );
}
track(
  `${LEGACY_SNAPSHOTS.DHBK}/${PEOPLE_TABLES.ACADEMIC_STANDING.name}`,
  await streamTable(
    root,
    LEGACY_SNAPSHOTS.DHBK,
    PEOPLE_TABLES.ACADEMIC_STANDING,
    (row) => {
      const student = students.get(row.MaHS);
      if (student && row.ngunghoc === '1') student.onLeave = true;
    },
  ),
);

// Results: keep the best attempt per (student, course, term); rows without any score are kept and
// resolved at load time (open term → in progress, past term → skipped).
const best = new Map<string, DutResult>();
let resultRowsRead = 0;
track(
  `${LEGACY_SNAPSHOTS.DHBK}/${PEOPLE_TABLES.RESULTS.name}`,
  await streamTable(
    root,
    LEGACY_SNAPSHOTS.DHBK,
    PEOPLE_TABLES.RESULTS,
    (row) => {
      if (!students.has(row.MaHS) || !/^\d{4}$/.test(row.IDCode)) return;
      resultRowsRead++;
      const result: DutResult = {
        studentCode: row.MaHS,
        courseCode: row.MaHP,
        termCode: row.IDCode,
        score10: row.Diem || null,
        score4: row.Diem4 || null,
        letterGrade: row.DiemC || null,
      };
      const key = `${result.studentCode}:${result.courseCode}:${result.termCode}`;
      const previous = best.get(key);
      if (
        !previous ||
        Number(result.score4 ?? -1) > Number(previous.score4 ?? -1)
      )
        best.set(key, result);
    },
  ),
);
const resultsOut = createWriteStream(
  new URL(PEOPLE_DATA_FILES.RESULTS, privateDir),
);
for (const result of best.values())
  resultsOut.write(`${JSON.stringify(result)}\n`);
await new Promise<void>((done) => resultsOut.end(done));

writeFileSync(
  new URL(PEOPLE_DATA_FILES.PEOPLE, privateDir),
  `${JSON.stringify({ lecturers: [...lecturers.values()], students: [...students.values()] }, null, 2)}\n`,
);
const terms = [
  ...new Set([...best.values()].map((result) => result.termCode)),
].sort();
const report: DutPeopleReport = {
  malformedLines,
  lecturers: lecturers.size,
  lecturersByUnit: Object.fromEntries(
    [...lecturers.values()].reduce(
      (counts, lecturer) =>
        counts.set(lecturer.unitCode, (counts.get(lecturer.unitCode) ?? 0) + 1),
      new Map<string, number>(),
    ),
  ),
  lecturersWithEmail: [...lecturers.values()].filter(
    (lecturer) => lecturer.emailLocalPart,
  ).length,
  students: students.size,
  studentsOnLeave: [...students.values()].filter((student) => student.onLeave)
    .length,
  resultRowsRead,
  resultsKept: best.size,
  resultsWithoutScore: [...best.values()].filter(
    (result) => !result.score10 && !result.score4 && !result.letterGrade,
  ).length,
  resultTerms: terms,
};
writeFileSync(
  new URL(`../data/${PEOPLE_DATA_FILES.REPORT}`, import.meta.url),
  `${JSON.stringify(report, null, 2)}\n`,
);
console.log(
  `lecturers ${report.lecturers}; students ${report.students}; results kept ${report.resultsKept} of ${resultRowsRead}`,
);
