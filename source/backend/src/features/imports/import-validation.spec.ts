import { describe, expect, it, vi } from 'vitest';
import { ImportType, Prisma } from '../../generated/prisma/client.js';
import type { CourseUsageReader } from '../../shared/courses/course-usage.reader.js';
import { COURSE_CATALOG_SHEET } from './sheets/course-catalog.sheet.js';
import { CURRICULUM_SHEET } from './sheets/curriculum.sheet.js';
import { writeSheet } from './sheets/sheet-writer.js';
import { readImportSheet, validateImport } from './import-validation.js';
import { loadCatalogContext } from './validation/catalog-context.js';
import { loadCurriculumContext } from './validation/curriculum-context.js';

vi.mock('./validation/catalog-context.js', () => ({
  loadCatalogContext: vi.fn(),
}));
vi.mock('./validation/curriculum-context.js', () => ({
  loadCurriculumContext: vi.fn(),
}));
describe('import validation orchestration', () => {
  it('passes normalized catalog codes, the exact client and unknown columns to the validator', async () => {
    vi.mocked(loadCatalogContext).mockResolvedValue({
      coursesByCode: new Map(),
      facultiesByCode: new Map([
        [
          'F',
          { id: 'f', unitCode: 'F', status: 'ACTIVE', unitType: 'FACULTY' },
        ],
      ]),
      groupsByCode: new Map(),
      homeFacultyCode: 'F',
      releasedCourseIds: new Set(),
    });
    const parsed = await readImportSheet(
      ImportType.COURSE_CATALOG,
      await writeSheet(COURSE_CATALOG_SHEET, {}, [
        {
          courseCode: ' a ',
          courseName: 'Tên',
          courseType: 'THEORY',
          credits: '2.5',
        },
      ]),
    );
    parsed.sheet.unknownColumns.push('Riêng');
    const client = {} as Prisma.TransactionClient;
    const usage = {} as CourseUsageReader;
    const result = await validateImport(client, usage, parsed, null);
    expect(loadCatalogContext).toHaveBeenCalledWith(client, usage, ['A']);
    expect(result.report.issues).toContainEqual(
      expect.objectContaining({ code: 'UNKNOWN_COLUMN', column: 'Riêng' }),
    );
    expect(result.errorRows).toBe(0);
  });
  it('collects requisite tokens before the single curriculum context load', async () => {
    vi.mocked(loadCurriculumContext).mockResolvedValue({
      version: {
        id: 'v',
        semesterCount: 1,
        totalCredits: new Prisma.Decimal(3),
        compulsoryCredits: new Prisma.Decimal(3),
        electiveCredits: new Prisma.Decimal(0),
      },
      program: { programCode: 'P', programName: 'Tên', majorCode: 'M' },
      coursesByCode: new Map(
        ['A', 'B', 'C', 'D'].map((code) => [
          code,
          {
            id: code,
            courseCode: code,
            courseName: code,
            credits: new Prisma.Decimal(3),
            status: 'ACTIVE',
          },
        ]),
      ),
      existingItems: new Map(),
      groups: [],
      catalogEdges: [],
      catalogMinScores: new Map(),
    });
    const parsed = await readImportSheet(
      ImportType.CURRICULUM,
      await writeSheet(CURRICULUM_SHEET, {}, [
        {
          courseCode: ' a ',
          plannedSemester: '1',
          priorCourses: 'b – Tên B; C',
          corequisites: 'd',
        },
      ]),
    );
    const client = {} as Prisma.TransactionClient;
    const result = await validateImport(
      client,
      {} as CourseUsageReader,
      parsed,
      'v',
    );
    expect(loadCurriculumContext).toHaveBeenCalledWith(client, 'v', [
      'A',
      'B',
      'C',
      'D',
    ]);
    expect(result.errorRows).toBe(0);
    await expect(
      validateImport(client, {} as CourseUsageReader, parsed, null),
    ).rejects.toThrow('no version');
  });
});
