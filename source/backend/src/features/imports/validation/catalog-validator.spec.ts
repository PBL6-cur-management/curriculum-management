import { describe, expect, it, vi } from 'vitest';
import {
  CourseStatus,
  CourseType,
  OrgUnitStatus,
  OrgUnitType,
  Prisma,
  SubjectGroupStatus,
} from '../../../generated/prisma/client.js';
import { CourseUsageReader } from '../../../shared/courses/course-usage.reader.js';
import type { PrismaService } from '../../../shared/prisma/prisma.service.js';
import {
  COURSE_CATALOG_SHEET,
  type CatalogColumnKey,
} from '../sheets/course-catalog.sheet.js';
import type { SheetRow } from '../sheets/sheet-reader.js';
import {
  loadCatalogContext,
  type CatalogContext,
  type CatalogCourseRow,
} from './catalog-context.js';
import { validateCatalogRows } from './catalog-validator.js';
import { IMPORT_ISSUE } from './import-issues.js';

function context(): CatalogContext {
  return {
    coursesByCode: new Map(),
    releasedCourseIds: new Set(),
    homeFacultyCode: 'CNTT',
    facultiesByCode: new Map([
      [
        'CNTT',
        {
          id: 'faculty',
          unitCode: 'CNTT',
          status: OrgUnitStatus.ACTIVE,
          unitType: OrgUnitType.FACULTY,
        },
      ],
    ]),
    groupsByCode: new Map([
      [
        'GROUP',
        {
          id: 'group',
          facultyId: 'faculty',
          status: SubjectGroupStatus.ACTIVE,
        },
      ],
    ]),
  };
}
function row(
  rowNumber = 4,
  overrides: Partial<Record<CatalogColumnKey, string>> = {},
): SheetRow<CatalogColumnKey> {
  return {
    rowNumber,
    cells: {
      courseCode: 'a',
      courseName: 'Tên',
      englishName: '',
      credits: '2.5',
      courseType: 'PROJECT',
      ownerFacultyCode: '',
      ownerGroupCode: '',
      ...overrides,
    },
  };
}
function existing(overrides: Partial<CatalogCourseRow> = {}): CatalogCourseRow {
  return {
    id: 'course',
    courseCode: 'A',
    courseName: 'Tên',
    englishName: null,
    credits: new Prisma.Decimal('2.50'),
    courseType: CourseType.PROJECT,
    status: CourseStatus.ACTIVE,
    ownerFacultyId: 'faculty',
    ownerGroupId: null,
    ...overrides,
  };
}

describe('catalog validator', () => {
  it('reports unknown columns once at file INFO severity', () => {
    const result = validateCatalogRows([row()], context(), ['Ghi chú riêng']);
    expect(result.report.issues).toContainEqual(
      expect.objectContaining({
        rowNumber: null,
        code: IMPORT_ISSUE.UNKNOWN_COLUMN,
        column: 'Ghi chú riêng',
        severity: 'INFO',
      }),
    );
    expect(result.errorRows).toBe(0);
  });
  it('marks every occurrence of a duplicate and names both spreadsheet rows', () => {
    const result = validateCatalogRows([row(4), row(17)], context());
    expect(result.errorRows).toBe(2);
    expect(result.plan.creates).toEqual([]);
    expect(result.report.issues).toEqual(
      expect.arrayContaining(
        [4, 17].map((rowNumber) =>
          expect.objectContaining({
            rowNumber,
            code: IMPORT_ISSUE.DUPLICATE_CODE_IN_FILE,
            severity: 'ERROR',
            message: expect.stringContaining('4, 17'),
            column: 'Mã HP',
          }),
        ),
      ),
    );
  });
  it('warns about zero credits and still creates the course', () => {
    const result = validateCatalogRows([row(4, { credits: '0' })], context());
    expect(result.errorRows).toBe(0);
    expect(result.report.issues).toContainEqual(
      expect.objectContaining({
        code: IMPORT_ISSUE.ZERO_CREDITS,
        severity: 'HIGH',
      }),
    );
    expect(result.plan.creates[0]).toMatchObject({
      courseCode: 'A',
      englishName: null,
      ownerFacultyId: 'faculty',
    });
  });
  it('reports changed fields and a write plan, but refuses changed released courses', () => {
    const loaded = context();
    loaded.coursesByCode.set('A', existing());
    const result = validateCatalogRows(
      [row(4, { courseName: 'Tên mới' })],
      loaded,
    );
    expect(result.report.issues).toContainEqual(
      expect.objectContaining({
        code: IMPORT_ISSUE.WILL_UPDATE,
        message: expect.stringContaining('tên'),
      }),
    );
    expect(result.plan.updates).toHaveLength(1);
    loaded.releasedCourseIds.add('course');
    const released = validateCatalogRows(
      [row(4, { courseName: 'Tên mới' })],
      loaded,
    );
    expect(released.report.issues).toContainEqual(
      expect.objectContaining({
        code: IMPORT_ISSUE.COURSE_RELEASED,
        severity: 'ERROR',
      }),
    );
    expect(released.plan.updates).toEqual([]);
  });
  it('compares decimals by value and leaves unchanged released courses alone', () => {
    const loaded = context();
    loaded.coursesByCode.set('A', existing());
    loaded.releasedCourseIds.add('course');
    const result = validateCatalogRows([row()], loaded);
    expect(result.errorRows).toBe(0);
    expect(result.report.issues).toContainEqual(
      expect.objectContaining({
        code: IMPORT_ISSUE.UNCHANGED,
        severity: 'INFO',
      }),
    );
    expect(result.plan).toEqual({ creates: [], updates: [] });
  });
  it.each(['Đồ án', 'PROJECT'])(
    'accepts the type label or enum: %s',
    (courseType) => {
      expect(
        validateCatalogRows([row(4, { courseType })], context()).plan.creates[0]
          .courseType,
      ).toBe(CourseType.PROJECT);
    },
  );
  it('refuses an OFFICE or inactive faculty and a group belonging to another faculty', () => {
    const loaded = context();
    loaded.facultiesByCode.get('CNTT')!.unitType = OrgUnitType.OFFICE;
    expect(validateCatalogRows([row()], loaded).report.issues).toContainEqual(
      expect.objectContaining({ code: IMPORT_ISSUE.OWNER_FACULTY_INVALID }),
    );
    loaded.facultiesByCode.get('CNTT')!.unitType = OrgUnitType.FACULTY;
    loaded.groupsByCode.get('GROUP')!.facultyId = 'another';
    expect(
      validateCatalogRows([row(4, { ownerGroupCode: 'GROUP' })], loaded).report
        .issues,
    ).toContainEqual(
      expect.objectContaining({ code: IMPORT_ISSUE.OWNER_GROUP_INVALID }),
    );
  });
  it.each([
    ['courseName', '', IMPORT_ISSUE.REQUIRED_EMPTY],
    ['courseCode', 'A'.repeat(21), IMPORT_ISSUE.VALUE_INVALID],
    ['courseName', 'A'.repeat(201), IMPORT_ISSUE.VALUE_INVALID],
    ['englishName', 'A'.repeat(201), IMPORT_ISSUE.VALUE_INVALID],
    ['credits', '-1', IMPORT_ISSUE.VALUE_INVALID],
    ['credits', '2.555', IMPORT_ISSUE.VALUE_INVALID],
    ['courseType', 'UNKNOWN', IMPORT_ISSUE.VALUE_INVALID],
    ['ownerFacultyCode', 'UNKNOWN', IMPORT_ISSUE.OWNER_FACULTY_INVALID],
    ['ownerGroupCode', 'UNKNOWN', IMPORT_ISSUE.OWNER_GROUP_INVALID],
  ] as const)('rejects invalid %s', (key, value, code) => {
    const result = validateCatalogRows([row(4, { [key]: value })], context());
    expect(result.errorRows).toBe(1);
    expect(result.report.issues).toContainEqual(
      expect.objectContaining({
        code,
        column: COURSE_CATALOG_SHEET.columns.find(
          (column) => column.key === key,
        )!.label,
      }),
    );
  });
  it('refuses cancelled courses even if unchanged', () => {
    const loaded = context();
    loaded.coursesByCode.set('A', existing({ status: CourseStatus.CANCELLED }));
    expect(validateCatalogRows([row()], loaded).report.issues).toContainEqual(
      expect.objectContaining({ code: IMPORT_ISSUE.COURSE_CANCELLED }),
    );
  });
  it('loads the catalog once per table and passes the same transaction to the usage reader', async () => {
    const course = vi.fn().mockResolvedValue([existing()]);
    const faculties = vi
      .fn()
      .mockResolvedValue([...context().facultiesByCode.values()]);
    const groups = vi
      .fn()
      .mockResolvedValue([
        { ...context().groupsByCode.get('GROUP'), groupCode: 'GROUP' },
      ]);
    const released = vi.fn().mockResolvedValue([{ courseId: 'course' }]);
    const client = {
      course: { findMany: course },
      orgUnit: { findMany: faculties },
      subjectGroup: { findMany: groups },
      curriculumItem: { findMany: released },
    } as unknown as Prisma.TransactionClient;
    const usage = new CourseUsageReader({} as PrismaService);
    const loaded = await loadCatalogContext(client, usage, ['A']);
    expect(loaded.releasedCourseIds).toEqual(new Set(['course']));
    expect(loaded.coursesByCode.get('A')?.credits.equals('2.5')).toBe(true);
    for (const query of [course, faculties, groups, released])
      expect(query).toHaveBeenCalledOnce();
  });
});
