import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { COURSE_FIELD_LIMITS } from '../../../../src/features/courses/create-course.dto.js';
import { PROGRAM_LIMITS } from '../../../../src/features/programs/create-program.dto.js';
import {
  DEFAULT_LEGACY_ROOT,
  DUT_DATA_FILES,
  type DutCatalogFile,
  type DutProgramsFile,
  type DutReportFile,
} from '../dut-data.js';
import { extractCatalog } from './extract-catalog.js';
import { extractFrames } from './extract-frames.js';
import { extractRelations } from './extract-relations.js';
import { legacyDecimal, requisiteTypeFor } from '../legacy-mapping.js';
import {
  LEGACY_SNAPSHOTS,
  LEGACY_TABLES,
  mergeSnapshots,
  readTable,
  type LegacyRow,
  type LegacyTable,
} from './legacy-tables.js';
import {
  DUT_PROGRAMS,
  LEGACY_FRAME_PREFIX,
  LEGACY_MAJOR_HEADER,
} from './program-map.js';

const root = resolve(process.argv[2] ?? DEFAULT_LEGACY_ROOT);
const keys: Record<LegacyTable, (row: LegacyRow) => string> = {
  TmNganh: (row) => row.MaNganh,
  tmKhungCT: (row) => `${row.MaKhung}:${row.MaHP}`,
  tmHocPhan: (row) => row.MaHP,
  tmHocphanDK: (row) =>
    `${row.MaKhung}:${row.MaHP}:${row.MaHPdk}:${row.LoaiDK}`,
  tmKehoach: (row) => row.IDCode,
  DonVi: (row) => row.MaDV,
};
const tables = new Map<LegacyTable, Map<string, LegacyRow>>();
const malformedLines: Record<string, number> = {};
for (const table of Object.values(LEGACY_TABLES)) {
  tables.set(table, mergeSnapshots(root, table, keys[table]).rows);
  for (const snapshot of Object.values(LEGACY_SNAPSHOTS)) {
    malformedLines[`${snapshot}/${table}`] = readTable(
      root,
      snapshot,
      table,
    ).malformedLines;
  }
}
assert.equal(
  Object.values(malformedLines).reduce((sum, count) => sum + count, 0),
  0,
  'Malformed legacy table lines',
);
const majors = tables.get(LEGACY_TABLES.MAJORS)!;
const frameCodes = new Set(
  [...majors.keys()].filter(
    (code) =>
      code.startsWith(LEGACY_FRAME_PREFIX) && code !== LEGACY_MAJOR_HEADER,
  ),
);
const mapped = DUT_PROGRAMS.flatMap((program) => [...program.frames]);
assert.equal(
  mapped.length,
  new Set(mapped).size,
  'Frame appears in multiple programs',
);
assert.deepEqual(
  [...new Set(mapped)].sort(),
  [...frameCodes].sort(),
  'Program mapping must cover every frame exactly once',
);
assert.equal(
  new Set(DUT_PROGRAMS.map((program) => program.programCode)).size,
  DUT_PROGRAMS.length,
  'Duplicate program codes',
);
const frameRows = new Map(
  [...tables.get(LEGACY_TABLES.FRAME_ROWS)!].filter(([, row]) =>
    frameCodes.has(row.MaKhung),
  ),
);
const requisites = new Map(
  [...tables.get(LEGACY_TABLES.REQUISITES)!].filter(([, row]) =>
    frameCodes.has(row.MaKhung),
  ),
);
for (const row of requisites.values()) requisiteTypeFor(row.LoaiDK);
const courses = tables.get(LEGACY_TABLES.COURSES)!;
const usedCourseCodes = new Set([...frameRows.values()].map((row) => row.MaHP));
const startTermCodes = new Set(
  [...frameCodes].map((code) => majors.get(code)!.KyBDau).filter(Boolean),
);
const catalog = extractCatalog({
  courses,
  units: tables.get(LEGACY_TABLES.UNITS)!,
  terms: tables.get(LEGACY_TABLES.TERMS)!,
  usedCourseCodes,
  startTermCodes,
});
const preferredCourses = new Map(
  readTable(root, LEGACY_SNAPSHOTS.DHBK, LEGACY_TABLES.COURSES).rows.map(
    (row) => [row.MaHP, row],
  ),
);
const otherCourses = new Map(
  readTable(root, LEGACY_SNAPSHOTS.SV1, LEGACY_TABLES.COURSES).rows.map(
    (row) => [row.MaHP, row],
  ),
);
for (const code of usedCourseCodes) {
  const preferred = preferredCourses.get(code);
  const other = otherCourses.get(code);
  if (!preferred || !other) continue;
  for (const column of Object.keys(
    catalog.snapshotConflicts,
  ) as (keyof typeof catalog.snapshotConflicts)[]) {
    if (preferred[column] !== other[column])
      catalog.snapshotConflicts[column]++;
  }
}
const frames = extractFrames({
  majors,
  frameRows,
  requisites,
  catalogCodes: new Set(catalog.courses.map((course) => course.courseCode)),
  courseCredits: new Map(
    catalog.courses.map((course) => [
      course.courseCode,
      legacyDecimal(course.credits),
    ]),
  ),
});
const relations = extractRelations(frames.programs);
const rawRelationPairs = new Set(
  [...requisites.values()].map((row) => `${row.MaHPdk}:${row.MaHP}`),
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
for (const program of frames.programs) {
  assert.ok(
    program.programCode.length <= PROGRAM_LIMITS.CODE_MAX,
    `Program code too long: ${program.programCode}`,
  );
  for (const version of program.versions) {
    assert.ok(
      version.programName.length <= PROGRAM_LIMITS.NAME_MAX,
      `Program name too long: ${version.frameCode}`,
    );
    assert.ok(
      version.majorName.length <= PROGRAM_LIMITS.NAME_MAX,
      `Major name too long: ${version.frameCode}`,
    );
    assert.ok(
      version.majorCode.length <= PROGRAM_LIMITS.MAJOR_CODE_MAX,
      `Major code too long: ${version.frameCode}`,
    );
    assert.ok(
      version.semesterCount >= PROGRAM_LIMITS.SEMESTERS_MIN &&
        version.semesterCount <= PROGRAM_LIMITS.SEMESTERS_MAX,
      `Invalid semesters: ${version.frameCode}`,
    );
  }
}
for (const course of catalog.courses) {
  assert.ok(
    course.courseCode.length <= COURSE_FIELD_LIMITS.CODE_MAX,
    `Course code too long: ${course.courseCode}`,
  );
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
const versions = frames.programs.flatMap((program) => program.versions);
const items = versions.reduce((sum, version) => sum + version.items.length, 0);
const rowRequisites = versions.reduce(
  (sum, version) => sum + version.requisites.length,
  0,
);
const groups = versions.reduce(
  (sum, version) => sum + version.groups.length,
  0,
);
assert.equal(frameCodes.size, 46, 'Unexpected frame count');
assert.equal(frames.programs.length, 24, 'Unexpected program count');
assert.equal(
  versions.filter((version) => version.startSemesterCode).length,
  41,
  'Unexpected released count',
);
assert.equal(catalog.courses.length, 173, 'Unexpected course count');
assert.equal(
  catalog.missingCourseCodes.length,
  8,
  'Unexpected missing course count',
);
assert.equal(catalog.units.length, 9, 'Unexpected unit count');
assert.equal(frameRows.size, 3316, 'Unexpected merged frame rows');
assert.equal(items, 3295, 'Unexpected item count');
assert.equal(requisites.size, 3389, 'Unexpected requisite input count');
assert.equal(
  frames.reports.reduce(
    (sum, report) => sum + report.rowsSkippedMissingCourse,
    0,
  ),
  21,
  'Unexpected missing course rows',
);
assert.equal(
  frames.reports.reduce(
    (sum, report) => sum + report.requisitesSkippedTargetOutside,
    0,
  ),
  253,
  'Unexpected requisite target skips',
);
assert.equal(rowRequisites, 3135, 'Unexpected kept requisite count');
assert.equal(
  relations.relations.length + relations.cycleSkipped.length,
  224,
  'Unexpected relation pair count',
);
assert.equal(relations.conflictingPairs, 2, 'Unexpected conflicting pairs');
assert.equal(excludedRelationPairs, 12, 'Unexpected excluded relation pairs');
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
  missingCourseCodes: catalog.missingCourseCodes,
  snapshotConflicts: catalog.snapshotConflicts,
  conflictingRelationPairs: relations.conflictingPairs,
  excludedRelationPairs,
  cycleSkippedRelations: relations.cycleSkipped,
  frames: frames.reports,
};
for (const [file, value] of [
  [DUT_DATA_FILES.CATALOG, catalogFile],
  [DUT_DATA_FILES.PROGRAMS, programsFile],
  [DUT_DATA_FILES.REPORT, reportFile],
] as const) {
  writeFileSync(
    new URL(`../data/${file}`, import.meta.url),
    `${JSON.stringify(value, null, 2)}\n`,
    'utf8',
  );
}
console.log(
  `frames ${frameCodes.size}; programs ${frames.programs.length}; versions ${versions.length}; released 41; drafts ${versions.length - 41}`,
);
console.log(
  `used course codes ${usedCourseCodes.size}; courses ${catalog.courses.length}; missing ${catalog.missingCourseCodes.length}; units ${catalog.units.length}; semesters ${catalog.semesters.length}; cohorts ${catalog.cohorts.length}`,
);
console.log(
  `merged rows ${frameRows.size}; items ${items}; skipped missing-course rows ${frameRows.size - items}; groups ${groups}`,
);
console.log(
  `requisite input ${requisites.size}; skipped target outside 253; kept ${rowRequisites}; source outside ${frames.reports.reduce((sum, report) => sum + report.requisitesSourceOutside, 0)}`,
);
console.log(
  `catalog pairs ${relations.relations.length + relations.cycleSkipped.length}; conflicting ${relations.conflictingPairs}; excluded pairs ${excludedRelationPairs}; accepted ${relations.relations.length}; cycle skipped ${relations.cycleSkipped.length}`,
);
console.log(
  `credit mismatches ${frames.reports.filter((report) => report.declaredCompulsory !== report.summedCompulsory).length}; elective rows without group ${frames.reports.reduce((sum, report) => sum + report.electiveRowsWithoutGroup, 0)}; group count mismatches ${frames.reports.reduce((sum, report) => sum + report.groupsCountMismatch, 0)}; malformed lines 0`,
);
console.log(`snapshot conflicts ${JSON.stringify(catalog.snapshotConflicts)}`);
console.log(
  `owners ${JSON.stringify(Object.fromEntries([...new Set(catalog.courses.map((course) => course.ownerUnitCode))].sort().map((code) => [code, catalog.courses.filter((course) => course.ownerUnitCode === code).length])))}`,
);
