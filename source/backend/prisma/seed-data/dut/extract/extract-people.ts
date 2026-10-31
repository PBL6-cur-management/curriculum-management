import {
  admissionTermFromStudentCode,
  HOME_FACULTY_LEGACY_CODE,
  LEGACY_FLAG_ON,
  semesterFromLegacyCode,
} from '../legacy-mapping.js';
import type {
  DutLecturer,
  DutPeopleReport,
  DutResult,
  DutStudent,
} from '../people-data.js';
import type { MIRROR_TABLES, MirrorRow } from './mirror-tables.js';

const STUDENT_CODE = /^\d{9}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TERM_CODE = /^\d{4}$/;

type Rows<Key extends keyof typeof MIRROR_TABLES> = readonly MirrorRow<
  (typeof MIRROR_TABLES)[Key]
>[];

const count = (values: Iterable<string>) => {
  const counts: Record<string, number> = {};
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  return Object.fromEntries(
    Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)),
  );
};

export interface PeopleExtract {
  lecturers: DutLecturer[];
  students: DutStudent[];
  results: DutResult[];
  report: Omit<DutPeopleReport, 'malformedLines'>;
  // Every term a student enters in or has a result in: each becomes a dated semester in the catalog.
  termCodes: Set<string>;
  admissionTermCodes: Set<string>;
}

export function extractPeople(input: {
  frameCodes: ReadonlySet<string>;
  excludedFrameLevels: ReadonlyMap<string, string>;
  students: Rows<'STUDENTS'>;
  standing: Rows<'ACADEMIC_STANDING'>;
  results: Rows<'RESULTS'>;
  exemptions: Rows<'EXEMPTIONS'>;
  lecturers: Rows<'LECTURERS'>;
  sections: Rows<'SECTIONS'>;
}): PeopleExtract {
  const students = new Map<string, DutStudent>();
  const excludedByLevel: string[] = [];
  let flaggedTinhtrang1 = 0;
  for (const row of input.students) {
    if (!STUDENT_CODE.test(row.MaHS)) continue;
    const level = input.excludedFrameLevels.get(row.MaNganh);
    if (level) excludedByLevel.push(level);
    if (!input.frameCodes.has(row.MaNganh)) continue;
    const inferred = !row.IDCodeVao;
    const admissionTermCode =
      row.IDCodeVao || admissionTermFromStudentCode(row.MaHS);
    semesterFromLegacyCode(admissionTermCode);
    if (row.Tinhtrang1 === LEGACY_FLAG_ON) flaggedTinhtrang1++;
    students.set(row.MaHS, {
      studentCode: row.MaHS,
      fullName: row.Hoten,
      frameCode: row.MaNganh,
      admissionTermCode,
      admissionTermInferred: inferred,
      onLeave: false,
    });
  }
  // The latest tmHocvu row says whether the student is suspended (ngừng học) now.
  const latest = new Map<
    string,
    MirrorRow<typeof MIRROR_TABLES.ACADEMIC_STANDING>
  >();
  for (const row of input.standing) {
    if (!students.has(row.MaHS)) continue;
    const previous = latest.get(row.MaHS);
    if (!previous || Number(row.IDCode) > Number(previous.IDCode))
      latest.set(row.MaHS, row);
  }
  for (const [code, row] of latest)
    if (row.ngunghoc === LEGACY_FLAG_ON) students.get(code)!.onLeave = true;

  // Results: the best attempt per (student, course, term); unscored rows are resolved at load time
  // (open term → in progress, past term → skipped).
  const best = new Map<string, DutResult>();
  const sectionCodes = new Set<string>();
  let resultRowsRead = 0;
  for (const row of input.results) {
    if (!students.has(row.MaHS) || !TERM_CODE.test(row.IDCode)) continue;
    resultRowsRead++;
    if (row.MalopHP) sectionCodes.add(row.MalopHP);
    const result: DutResult = {
      studentCode: row.MaHS,
      courseCode: row.MaHP,
      termCode: row.IDCode,
      score10: row.Diem || null,
      score4: row.Diem4 || null,
      letterGrade: row.DiemC || null,
      exempt: false,
    };
    const key = `${result.studentCode}:${result.courseCode}:${result.termCode}`;
    const previous = best.get(key);
    if (
      !previous ||
      Number(result.score4 ?? -1) > Number(previous.score4 ?? -1)
    )
      best.set(key, result);
  }
  let exemptionsKept = 0;
  let exemptionsShadowed = 0;
  for (const row of input.exemptions) {
    if (!students.has(row.MaHS) || !TERM_CODE.test(row.IDCode)) continue;
    const key = `${row.MaHS}:${row.MaHP}:${row.IDCode}`;
    if (best.has(key)) {
      exemptionsShadowed++;
      continue;
    }
    best.set(key, {
      studentCode: row.MaHS,
      courseCode: row.MaHP,
      termCode: row.IDCode,
      score10: row.Diem || null,
      score4: row.Diem4 || null,
      letterGrade: row.DiemC || null,
      exempt: true,
    });
    exemptionsKept++;
  }
  const results = [...best.values()];
  for (const result of results) semesterFromLegacyCode(result.termCode);

  // Lecturers: the faculty's own staff plus everyone who taught a section these students sat in.
  const teachers = new Set<string>();
  for (const row of input.sections)
    if (sectionCodes.has(row.MalopHP))
      for (const code of [row.MaGV, row.MaGV1]) if (code) teachers.add(code);
  const lecturers: DutLecturer[] = [];
  let fromFaculty = 0;
  for (const row of input.lecturers) {
    const ownStaff = row.KhoaPC === HOME_FACULTY_LEGACY_CODE;
    if (!row.MaHS || !(ownStaff || teachers.has(row.MaHS))) continue;
    if (ownStaff) fromFaculty++;
    lecturers.push({
      staffCode: row.MaHS,
      fullName: row.Hoten,
      unitCode: row.MaBP,
      email: EMAIL.test(row.Email) ? row.Email.toLowerCase() : null,
    });
  }
  lecturers.sort((left, right) =>
    left.staffCode.localeCompare(right.staffCode),
  );

  const studentList = [...students.values()].sort((left, right) =>
    left.studentCode.localeCompare(right.studentCode),
  );
  const resultTerms = [
    ...new Set(results.map((result) => result.termCode)),
  ].sort();
  const admissionTermCodes = new Set(
    studentList.map((student) => student.admissionTermCode),
  );
  return {
    lecturers,
    students: studentList,
    results,
    termCodes: new Set([...resultTerms, ...admissionTermCodes]),
    admissionTermCodes,
    report: {
      lecturers: lecturers.length,
      lecturersFromFaculty: fromFaculty,
      lecturersTeachingOnly: lecturers.length - fromFaculty,
      lecturersByUnit: count(lecturers.map((lecturer) => lecturer.unitCode)),
      lecturersWithEmail: lecturers.filter((lecturer) => lecturer.email).length,
      students: studentList.length,
      studentsByAdmissionTerm: count(
        studentList.map((student) => student.admissionTermCode),
      ),
      studentsAdmissionInferred: studentList.filter(
        (student) => student.admissionTermInferred,
      ).length,
      studentsOnLeave: studentList.filter((student) => student.onLeave).length,
      studentsFlaggedTinhtrang1: flaggedTinhtrang1,
      studentsExcludedByLevel: count(excludedByLevel),
      resultRowsRead,
      resultsKept: results.filter((result) => !result.exempt).length,
      resultsWithoutScore: results.filter(
        (result) => !result.score10 && !result.score4 && !result.letterGrade,
      ).length,
      resultsByLetter: count(
        results
          .filter((result) => !result.exempt)
          .map((result) => result.letterGrade ?? '(trống)'),
      ),
      exemptionsKept,
      exemptionsShadowedByResult: exemptionsShadowed,
      resultTerms,
      openTermCode: resultTerms.at(-1) ?? '',
    },
  };
}
