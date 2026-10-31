import assert from 'node:assert/strict';
import { createWriteStream, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { COURSE_FIELD_LIMITS } from '../../../../src/features/courses/create-course.dto.js';
import { PROGRAM_LIMITS } from '../../../../src/features/programs/create-program.dto.js';
import {
  DUT_DATA_FILES,
  type DutCatalogFile,
  type DutProgramsFile,
  type DutReportFile,
} from '../dut-data.js';
import {
  legacyDecimal,
  nextTermCode,
  requisiteTypeFor,
  semesterFromLegacyCode,
} from '../legacy-mapping.js';
import { PEOPLE_DATA_FILES, type DutPeopleReport } from '../people-data.js';
import { extractCatalog } from './extract-catalog.js';
import { extractFrames } from './extract-frames.js';
import { extractPeople } from './extract-people.js';
import { extractRelations } from './extract-relations.js';
import {
  MIRROR_TABLES,
  mirrorRoot,
  readMirrorTable,
  type MirrorRow,
  type MirrorTable,
} from './mirror-tables.js';
import { groupFramesIntoPrograms, selectFrameScope } from './program-map.js';

// Mirror CSV → data/catalog.json, programs.json, report.json (committed: no personal data) and
// data/private/people.json, results.jsonl (gitignored). Usage: pnpm dut:extract [mirror root].
const root = resolve(mirrorRoot(process.argv[2]));
const malformedLines: Record<string, number> = {};
async function load<Table extends MirrorTable>(
  table: Table,
): Promise<MirrorRow<Table>[]> {
  const { rows, malformedLines: malformed } = await readMirrorTable(
    root,
    table,
  );
  malformedLines[`${table.database}/${table.name}`] = malformed;
  return rows;
}

const allMajors = await load(MIRROR_TABLES.MAJORS);
const studentRows = await load(MIRROR_TABLES.STUDENTS);
const studentsByFrame = new Map<string, number>();
for (const row of studentRows)
  studentsByFrame.set(row.MaNganh, (studentsByFrame.get(row.MaNganh) ?? 0) + 1);
const scope = selectFrameScope(allMajors, studentsByFrame);
const frameCodes = new Set(scope.frameCodes);
const majors = allMajors.filter((row) => frameCodes.has(row.MaNganh));
const frameRows = (await load(MIRROR_TABLES.FRAME_ROWS)).filter((row) =>
  frameCodes.has(row.MaKhung),
);
const budgets = (await load(MIRROR_TABLES.FRAME_SEMESTER_CREDITS)).filter(
  (row) => frameCodes.has(row.MaKhung),
);
const requisites = (await load(MIRROR_TABLES.REQUISITES)).filter((row) =>
  frameCodes.has(row.MaKhung),
);
for (const row of requisites) requisiteTypeFor(row.LoaiDK);
const courseRows = await load(MIRROR_TABLES.COURSES);
const unitRows = await load(MIRROR_TABLES.UNITS);
const termRows = await load(MIRROR_TABLES.TERMS);
const nationalMajors = new Map(
  (await load(MIRROR_TABLES.NATIONAL_MAJORS)).map((row) => [
    row.MaNganhQG,
    row.TenNganhQG,
  ]),
);

const people = extractPeople({
  frameCodes,
  excludedFrameLevels: new Map(
    scope.excluded.map((frame) => [frame.frameCode, frame.level]),
  ),
  students: studentRows,
  standing: await load(MIRROR_TABLES.ACADEMIC_STANDING),
  results: await load(MIRROR_TABLES.RESULTS),
  exemptions: await load(MIRROR_TABLES.EXEMPTIONS),
  lecturers: await load(MIRROR_TABLES.LECTURERS),
  sections: await load(MIRROR_TABLES.SECTIONS),
});
assert.equal(
  Object.values(malformedLines).reduce((sum, value) => sum + value, 0),
  0,
  'Malformed mirror CSV records',
);
assert.ok(people.report.openTermCode, 'No result terms in the mirror');

// Semesters: every frame start, admission and result term, plus the term after the open one (the next release).
const startTermCodes = new Set(majors.map((row) => row.KyBDau).filter(Boolean));
const nextTerm = nextTermCode(people.report.openTermCode);
const termCodes = new Set([...startTermCodes, ...people.termCodes, nextTerm]);
const cohortTermCodes = new Set([
  ...majors
    .filter((row) => row.KyBDau && row.InUse === '1')
    .map((row) => row.KyBDau),
  ...people.admissionTermCodes,
]);
// Frame courses, plus courses the in-scope students took outside their frame (free electives, retakes of retired
// codes) when the school catalog has them, so their results are not dropped.
const knownCourseCodes = new Set(courseRows.map((row) => row.MaHP));
const usedCourseCodes = new Set([
  ...frameRows.map((row) => row.MaHP),
  ...people.results
    .map((result) => result.courseCode)
    .filter((code) => knownCourseCodes.has(code)),
]);
const catalog = extractCatalog({
  courses: courseRows,
  units: unitRows,
  terms: termRows,
  usedCourseCodes,
  termCodes,
  cohortTermCodes,
});
const catalogCodes = new Set(
  catalog.courses.map((course) => course.courseCode),
);
const frames = extractFrames({
  majors,
  frameRows,
  budgets,
  requisites,
  catalogCodes,
  courseCredits: new Map(
    catalog.courses.map((course) => [
      course.courseCode,
      legacyDecimal(course.credits),
    ]),
  ),
  majorNames: nationalMajors,
  studentsByFrame,
});
const relations = extractRelations(frames.programs);
const rawRelationPairs = new Set(
  requisites.map((row) => `${row.MaHPdk}:${row.MaHP}`),
);
const retainedRelationPairs = new Set(
  frames.programs.flatMap((program) =>
    program.versions.flatMap((version) =>
      version.requisites.map(
        (row) => `${row.sourceCourseCode}:${row.targetCourseCode}`,
      ),
    ),
  ),
);
const excludedRelationPairs = [...rawRelationPairs].filter(
  (pair) => !retainedRelationPairs.has(pair),
).length;

// Invariants (instead of fixed counts: the mirror moves with the school).
const versions = frames.programs.flatMap((program) => program.versions);
assert.deepEqual(
  versions.map((version) => version.frameCode).sort(),
  [...frameCodes].sort(),
  'Every frame in scope must become exactly one version',
);
const semesterCodes = new Set(catalog.semesters.map((row) => row.semesterCode));
for (const program of frames.programs) {
  assert.ok(
    program.programCode.length <= PROGRAM_LIMITS.CODE_MAX,
    `Program code too long: ${program.programCode}`,
  );
  const starts = program.versions.map((version) => version.startSemesterCode);
  assert.equal(
    new Set(starts).size,
    starts.length,
    `Two versions of ${program.programCode} start in the same semester`,
  );
  for (const version of program.versions) {
    assert.ok(version.programName.length <= PROGRAM_LIMITS.NAME_MAX);
    assert.ok(version.majorName.length <= PROGRAM_LIMITS.NAME_MAX);
    assert.ok(
      version.majorCode.length <= PROGRAM_LIMITS.MAJOR_CODE_MAX,
      `Major code too long: ${version.frameCode}`,
    );
    assert.ok(
      version.semesterCount >= PROGRAM_LIMITS.SEMESTERS_MIN &&
        version.semesterCount <= PROGRAM_LIMITS.SEMESTERS_MAX,
      `Invalid semesters: ${version.frameCode}`,
    );
    assert.ok(
      !version.startSemesterCode ||
        semesterCodes.has(version.startSemesterCode),
      `Start semester missing: ${version.frameCode}`,
    );
    const codes = version.items.map((item) => item.courseCode);
    assert.equal(
      new Set(codes).size,
      codes.length,
      `Duplicate course in ${version.frameCode}`,
    );
    assert.ok(
      version.items.every(
        (item) => item.isElective === (item.groupCode !== null),
      ),
      `Elective row without group in ${version.frameCode}`,
    );
  }
}
for (const course of catalog.courses) {
  assert.ok(course.courseCode.length <= COURSE_FIELD_LIMITS.CODE_MAX);
  assert.ok(
    course.courseName.length <= COURSE_FIELD_LIMITS.NAME_MAX,
    `Course name too long: ${course.courseCode}`,
  );
  assert.ok(
    !course.englishName ||
      course.englishName.length <= COURSE_FIELD_LIMITS.NAME_MAX,
    `English name too long: ${course.courseCode}`,
  );
}
for (const code of [...termCodes])
  assert.ok(
    semesterCodes.has(semesterFromLegacyCode(code).semesterCode),
    `Semester missing for term ${code}`,
  );

const write = (file: URL, value: unknown) =>
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
const catalogFile: DutCatalogFile = {
  units: catalog.units,
  courses: catalog.courses,
  semesters: catalog.semesters,
  cohorts: catalog.cohorts,
  relations: relations.relations,
};
const programsFile: DutProgramsFile = { programs: frames.programs };
const reportFile: DutReportFile = {
  malformedLines,
  scope: {
    frames: scope.frameCodes.length,
    excludedFramesWithStudents: scope.excluded,
  },
  programs: groupFramesIntoPrograms(majors),
  missingCourseCodes: catalog.missingCourseCodes,
  ownersInferredFromCode: catalog.ownersInferredFromCode,
  estimatedSemesters: catalog.estimatedSemesters,
  nextTermCode: nextTerm,
  conflictingRelationPairs: relations.conflictingPairs,
  excludedRelationPairs,
  cycleSkippedRelations: relations.cycleSkipped,
  frames: frames.reports,
};
write(
  new URL(`../data/${DUT_DATA_FILES.CATALOG}`, import.meta.url),
  catalogFile,
);
write(
  new URL(`../data/${DUT_DATA_FILES.PROGRAMS}`, import.meta.url),
  programsFile,
);
write(new URL(`../data/${DUT_DATA_FILES.REPORT}`, import.meta.url), reportFile);

const privateDir = new URL('../data/private/', import.meta.url);
mkdirSync(privateDir, { recursive: true });
write(new URL(PEOPLE_DATA_FILES.PEOPLE, privateDir), {
  lecturers: people.lecturers,
  students: people.students,
});
const resultsOut = createWriteStream(
  new URL(PEOPLE_DATA_FILES.RESULTS, privateDir),
);
for (const result of people.results)
  resultsOut.write(`${JSON.stringify(result)}\n`);
await new Promise<void>((done) => resultsOut.end(done));
const peopleReport: DutPeopleReport = { malformedLines: {}, ...people.report };
write(
  new URL(`../data/${PEOPLE_DATA_FILES.REPORT}`, import.meta.url),
  peopleReport,
);

const items = versions.reduce((sum, version) => sum + version.items.length, 0);
const groups = versions.reduce(
  (sum, version) => sum + version.groups.length,
  0,
);
console.log(
  `mirror ${root}: frames ${frameCodes.size} (excluded with students: ${scope.excluded.length}); programs ${frames.programs.length}; versions ${versions.length}`,
);
console.log(
  `courses ${catalog.courses.length} (missing ${catalog.missingCourseCodes.length}, owner from code ${catalog.ownersInferredFromCode}); units ${catalog.units.length}; semesters ${catalog.semesters.length} (estimated ${catalog.estimatedSemesters.join(' ') || 'none'}); cohorts ${catalog.cohorts.length}; next term ${nextTerm}`,
);
console.log(
  `items ${items}; groups ${groups}; balanced frames ${frames.reports.filter((report) => report.balanced).length}/${frames.reports.length}; direction rows made elective ${frames.reports.reduce((sum, report) => sum + report.directionRowsMadeElective, 0)}`,
);
console.log(
  `relations ${relations.relations.length}; cycle skipped ${relations.cycleSkipped.length}; conflicting ${relations.conflictingPairs}; excluded pairs ${excludedRelationPairs}`,
);
console.log(
  `lecturers ${people.report.lecturers}; students ${people.report.students} (on leave ${people.report.studentsOnLeave}, admission inferred ${people.report.studentsAdmissionInferred}); results ${people.report.resultsKept}; exemptions ${people.report.exemptionsKept}; open term ${people.report.openTermCode}`,
);
