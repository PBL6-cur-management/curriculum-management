import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  OrgUnitType,
  type DegreeLevel,
} from '../../../../src/generated/prisma/client.js';
import { COURSE_FIELD_LIMITS } from '../../../../src/features/courses/create-course.dto.js';
import { PROGRAM_LIMITS } from '../../../../src/features/programs/create-program.dto.js';
import { SEED_MAJORS } from '../../majors.js';
import type { DutCatalogFile } from '../dut-data.js';
import {
  cohortFromLegacyCode,
  LEGACY_FLAG_ON,
  LEGACY_OFFICE_GROUP,
  LEGACY_UNIT_CODE_PREFIX,
  legacyDecimal,
  requisiteTypeFor,
  semesterFromLegacyCode,
} from '../legacy-mapping.js';
import {
  extractCatalog,
  LEGACY_EXTERNAL_UNIT_GROUP,
  standardizeLegacyUnitName,
  type DutUnit,
} from './extract-catalog.js';
import {
  extractVersion,
  type DutProgram,
  type DutVersion,
} from './extract-frames.js';
import { extractRelations } from './extract-relations.js';
import {
  buildTrackShowcase,
  EXTRA_FACULTY_CODES,
  groupExtraFrames,
  type TrackShowcaseProgram,
} from './extra-program-map.js';
import {
  MIRROR_TABLES,
  mirrorRoot,
  readMirrorTable,
  type MirrorRow,
  type MirrorTable,
} from './mirror-tables.js';

export interface ExtraProgram extends DutProgram {
  facultyUnitCode: string;
  majorCode: string;
}

export interface ExtraFacultiesFile {
  catalog: DutCatalogFile;
  programs: ExtraProgram[];
  trackShowcase: TrackShowcaseProgram;
}

const SHOWCASE_FRAMES = [
  {
    frameCode: '1024034',
    trackCode: 'CNPM',
    trackName: 'Công nghệ phần mềm',
    englishName: 'Software Engineering',
    description:
      'Định hướng phát triển phần mềm chuyên nghiệp, kiến trúc hệ thống, kiểm thử và quản lý dự án phần mềm.',
    sortOrder: 1,
  },
  {
    frameCode: '1024035',
    trackCode: 'ATTT',
    trackName: 'An toàn thông tin',
    englishName: 'Information Security',
    description:
      'Định hướng bảo mật hệ thống, mật mã học ứng dụng, an toàn mạng và phòng chống tấn công mạng.',
    sortOrder: 2,
  },
  {
    frameCode: '1024036',
    trackCode: 'HTTT',
    trackName: 'Hệ thống thông tin',
    englishName: 'Information Systems',
    description:
      'Định hướng phân tích, thiết kế hệ thống thông tin doanh nghiệp, kho dữ liệu và trí tuệ kinh doanh.',
    sortOrder: 3,
  },
  {
    frameCode: '1024037',
    trackCode: 'KTMT',
    trackName: 'Kỹ thuật máy tính',
    englishName: 'Computer Engineering',
    description:
      'Định hướng hệ thống nhúng, IoT, kiến trúc phần cứng và lập trình hệ thống.',
    sortOrder: 4,
  },
] as const;

const groupBy = <Row>(rows: readonly Row[], key: (row: Row) => string) => {
  const map = new Map<string, Row[]>();
  for (const row of rows) {
    const list = map.get(key(row)) ?? [];
    list.push(row);
    map.set(key(row), list);
  }
  return map;
};

async function main() {
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
  const allFrameRows = await load(MIRROR_TABLES.FRAME_ROWS);
  const allBudgets = await load(MIRROR_TABLES.FRAME_SEMESTER_CREDITS);
  const allRequisites = await load(MIRROR_TABLES.REQUISITES);
  const courseRows = await load(MIRROR_TABLES.COURSES);
  const unitRows = await load(MIRROR_TABLES.UNITS);
  const termRows = await load(MIRROR_TABLES.TERMS);
  const nationalMajorRows = await load(MIRROR_TABLES.NATIONAL_MAJORS);

  assert.equal(
    Object.values(malformedLines).reduce((sum, value) => sum + value, 0),
    0,
    'Malformed mirror CSV records',
  );

  // Merge tmNganhQG with SEED_MAJORS fallback (e.g. 7480106 Kỹ thuật máy tính is not in tmNganhQG).
  const nationalMajors = new Map<string, string>();
  for (const seed of SEED_MAJORS)
    nationalMajors.set(seed.majorCode, seed.majorName);
  for (const row of nationalMajorRows)
    nationalMajors.set(row.MaNganhQG, row.TenNganhQG);

  const rowCounts = new Map<string, number>();
  for (const row of allFrameRows)
    rowCounts.set(row.MaKhung, (rowCounts.get(row.MaKhung) ?? 0) + 1);

  const { programs: groupedPrograms, deduplicatedFrames } = groupExtraFrames(
    allMajors,
    rowCounts,
  );
  const extraFrameCodes = new Set(
    groupedPrograms.flatMap((p) => p.frames.map((f) => f.frameCode)),
  );
  const showcaseFrameCodes = new Set<string>(
    SHOWCASE_FRAMES.map((f) => f.frameCode),
  );
  const allSelectedFrameCodes = new Set([
    ...extraFrameCodes,
    ...showcaseFrameCodes,
  ]);

  const majorByCode = new Map(allMajors.map((row) => [row.MaNganh, row]));
  const frameRows = allFrameRows.filter((row) =>
    allSelectedFrameCodes.has(row.MaKhung),
  );
  const budgets = allBudgets.filter((row) =>
    allSelectedFrameCodes.has(row.MaKhung),
  );
  const requisites = allRequisites.filter((row) =>
    allSelectedFrameCodes.has(row.MaKhung),
  );
  for (const row of requisites) requisiteTypeFor(row.LoaiDK);

  // Collect all semester codes and cohort term codes needed.
  const termCodes = new Set<string>();
  const cohortTermCodes = new Set<string>();
  for (const program of groupedPrograms) {
    for (const frame of program.frames) {
      if (frame.startSemesterCode) {
        termCodes.add(frame.startSemesterCode);
        const major = majorByCode.get(frame.frameCode)!;
        if (major.KyBDau && major.InUse === LEGACY_FLAG_ON) {
          cohortTermCodes.add(major.KyBDau);
        }
      }
    }
  }
  for (const f of SHOWCASE_FRAMES) {
    const major = majorByCode.get(f.frameCode);
    assert.ok(major, `Missing showcase frame ${f.frameCode}`);
    if (major.KyBDau) {
      termCodes.add(major.KyBDau);
      cohortTermCodes.add(major.KyBDau);
    }
  }

  const usedCourseCodes = new Set(frameRows.map((row) => row.MaHP));
  const catalog = extractCatalog({
    courses: courseRows,
    units: unitRows,
    terms: termRows,
    usedCourseCodes,
    termCodes,
    cohortTermCodes,
  });

  // Ensure DUT-106 and DUT-121 are always present in catalog.units even if not inferred from course codes.
  const unitByCode = new Map<string, DutUnit>(
    catalog.units.map((u) => [u.unitCode, u]),
  );
  const unitRowByLegacy = new Map(unitRows.map((u) => [u.MaDV, u]));
  for (const requiredCode of [
    EXTRA_FACULTY_CODES.DTVT,
    EXTRA_FACULTY_CODES.KTR,
  ]) {
    if (!unitByCode.has(requiredCode)) {
      const legacyCode = requiredCode.replace(LEGACY_UNIT_CODE_PREFIX, '');
      const row = unitRowByLegacy.get(legacyCode);
      assert.ok(row, `Missing unit ${legacyCode} in tmDonVi.csv`);
      unitByCode.set(requiredCode, {
        unitCode: requiredCode,
        unitName: standardizeLegacyUnitName(row.TenDV),
        unitType:
          row.MaBP === LEGACY_OFFICE_GROUP
            ? OrgUnitType.OFFICE
            : OrgUnitType.FACULTY,
        isExternal: row.MaBP === LEGACY_EXTERNAL_UNIT_GROUP,
      });
    }
  }
  const units = [...unitByCode.values()].sort((a, b) =>
    a.unitCode.localeCompare(b.unitCode),
  );

  const catalogCodes = new Set(catalog.courses.map((c) => c.courseCode));
  const courseCredits = new Map(
    catalog.courses.map((c) => [c.courseCode, legacyDecimal(c.credits)]),
  );
  const frameRowsByFrame = groupBy(frameRows, (row) => row.MaKhung);
  const budgetsByFrame = groupBy(budgets, (row) => row.MaKhung);
  const requisitesByFrame = groupBy(requisites, (row) => row.MaKhung);

  function buildVersion(
    frameCode: string,
    programCode: string,
    overrideStartSemester: string | null,
  ): DutVersion {
    const major = majorByCode.get(frameCode);
    assert.ok(major, `Missing frame ${frameCode}`);
    const baseMajorCode = major.Kyhieu.slice(0, 7);
    const majorName = nationalMajors.get(baseMajorCode);
    assert.ok(majorName, `No national major name for ${major.Kyhieu} (${frameCode})`);
    const { version } = extractVersion(major, {
      frameRows: frameRowsByFrame.get(frameCode) ?? [],
      budgets: budgetsByFrame.get(frameCode) ?? [],
      requisites: requisitesByFrame.get(frameCode) ?? [],
      catalogCodes,
      courseCredits,
      majorName,
      programCode,
      students: 0,
    });
    if (!version.startSemesterCode && overrideStartSemester) {
      version.startSemesterCode =
        semesterFromLegacyCode(overrideStartSemester).semesterCode;
    }
    return version;
  }

  const programs: ExtraProgram[] = groupedPrograms.map((group) => {
    const versions = group.frames
      .map((frame) =>
        buildVersion(
          frame.frameCode,
          group.programCode,
          frame.startSemesterCode,
        ),
      )
      .sort(
        (left, right) =>
          (left.startSemesterCode ?? '').localeCompare(
            right.startSemesterCode ?? '',
          ) || left.frameCode.localeCompare(right.frameCode),
      );
    const baseMajorCode = versions[versions.length - 1].majorCode.replace(
      /[^0-9].*$/,
      '',
    );
    return {
      programCode: group.programCode,
      facultyUnitCode: group.facultyUnitCode,
      majorCode: baseMajorCode,
      degreeLevel: group.degreeLevel as DegreeLevel,
      versions,
    };
  });

  // Build CNTT-CN-DH track showcase from 1024034..1024037.
  const showcaseInputs = SHOWCASE_FRAMES.map((spec) => ({
    trackCode: spec.trackCode,
    trackName: spec.trackName,
    englishName: spec.englishName,
    description: spec.description,
    sortOrder: spec.sortOrder,
    version: buildVersion(spec.frameCode, 'CNTT-CN-DH', null),
  }));
  const trackShowcase = buildTrackShowcase(showcaseInputs, courseCredits);

  // Extract course relations from all extra programs + showcase frames.
  const allProgramsForRelations: DutProgram[] = [
    ...programs,
    ...showcaseInputs.map((s) => ({
      programCode: `SHOWCASE-${s.trackCode}`,
      degreeLevel: trackShowcase.degreeLevel,
      versions: [s.version],
    })),
  ];
  const relations = extractRelations(allProgramsForRelations);

  // Invariant checks.
  const semesterCodes = new Set(catalog.semesters.map((s) => s.semesterCode));
  const seenProgramCodes = new Set<string>();
  for (const program of programs) {
    assert.ok(
      program.versions.length > 0,
      `Empty program ${program.programCode}`,
    );
    assert.ok(
      program.programCode.length <= PROGRAM_LIMITS.CODE_MAX,
      `Program code too long: ${program.programCode}`,
    );
    assert.ok(
      !seenProgramCodes.has(program.programCode),
      `Duplicate programCode: ${program.programCode}`,
    );
    seenProgramCodes.add(program.programCode);
    const starts = program.versions.map((v) => v.startSemesterCode);
    assert.equal(
      new Set(starts).size,
      starts.length,
      `Duplicate startSemesterCode in ${program.programCode}: ${starts.join(', ')}`,
    );
    for (const version of program.versions) {
      assert.ok(
        version.items.length > 0,
        `Empty version ${version.frameCode} in ${program.programCode}`,
      );
      assert.ok(
        version.startSemesterCode &&
          semesterCodes.has(version.startSemesterCode),
        `Missing start semester ${version.startSemesterCode} for ${version.frameCode}`,
      );
      assert.ok(version.programName.length <= PROGRAM_LIMITS.NAME_MAX);
      assert.ok(version.majorName.length <= PROGRAM_LIMITS.NAME_MAX);
      assert.ok(version.majorCode.length <= PROGRAM_LIMITS.MAJOR_CODE_MAX);
      assert.ok(
        version.semesterCount >= PROGRAM_LIMITS.SEMESTERS_MIN &&
          version.semesterCount <= PROGRAM_LIMITS.SEMESTERS_MAX,
        `Invalid semesterCount for ${version.frameCode}`,
      );
      const codes = version.items.map((i) => i.courseCode);
      assert.equal(
        new Set(codes).size,
        codes.length,
        `Duplicate course in ${version.frameCode}`,
      );
    }
  }
  assert.ok(
    !seenProgramCodes.has(trackShowcase.programCode),
    `Showcase programCode collides with extra programs: ${trackShowcase.programCode}`,
  );
  assert.ok(
    semesterCodes.has(trackShowcase.startSemesterCode),
    `Missing showcase startSemesterCode ${trackShowcase.startSemesterCode}`,
  );
  assert.ok(
    trackShowcase.commonItems.length > 0,
    'Showcase has no common items',
  );
  for (const track of trackShowcase.tracks) {
    assert.ok(
      track.items.length > 0,
      `Showcase track ${track.trackCode} has no track-specific items`,
    );
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

  // Ensure showcase cohort is present in catalog.cohorts.
  const cohortsByCode = new Map(
    catalog.cohorts.map((c) => [c.cohortCode, c]),
  );
  if (trackShowcase.cohortCode && !cohortsByCode.has(trackShowcase.cohortCode)) {
    const cohort = cohortFromLegacyCode(trackShowcase.startSemesterCode);
    cohortsByCode.set(cohort.cohortCode, cohort);
  }
  const cohorts = [...cohortsByCode.values()].sort((a, b) =>
    a.cohortCode.localeCompare(b.cohortCode),
  );

  const output: ExtraFacultiesFile = {
    catalog: {
      units,
      courses: catalog.courses,
      semesters: catalog.semesters,
      cohorts,
      relations: relations.relations,
    },
    programs,
    trackShowcase,
  };

  const outUrl = new URL('../data/extra-faculties.json', import.meta.url);
  writeFileSync(outUrl, `${JSON.stringify(output, null, 2)}\n`, 'utf8');

  const totalVersions = programs.reduce((s, p) => s + p.versions.length, 0);
  console.log(
    `Extracted extra faculties from ${root}: units=${units.length}, courses=${catalog.courses.length} (missing=${catalog.missingCourseCodes.length}), semesters=${catalog.semesters.length}, cohorts=${cohorts.length}, relations=${relations.relations.length} (cycleSkipped=${relations.cycleSkipped.length})`,
  );
  console.log(
    `Programs=${programs.length}, versions=${totalVersions}, deduplicatedFrames=${deduplicatedFrames.join(',') || 'none'}`,
  );
  for (const p of programs) {
    console.log(
      `  ${p.programCode.padEnd(20)} | ${p.facultyUnitCode.padEnd(10)} | ${p.degreeLevel.padEnd(10)} | major=${p.majorCode} | versions=${p.versions.length} (${p.versions.map((v) => `${v.frameCode}@${v.startSemesterCode}`).join(', ')})`,
    );
  }
  console.log(
    `Track showcase ${trackShowcase.programCode}: commonItems=${trackShowcase.commonItems.length}, commonGroups=${trackShowcase.commonGroups.length}`,
  );
  for (const t of trackShowcase.tracks) {
    console.log(
      `  Track ${t.trackCode}: items=${t.items.length}, groups=${t.groups.length}, compulsory=${t.compulsoryCredits}, elective=${t.electiveCredits}`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
