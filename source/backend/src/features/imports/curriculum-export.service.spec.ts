import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProgramVersionStatus, Prisma } from '../../generated/prisma/client.js';
import { AccessContext } from '../../shared/authz/access-context.js';
import { PERMISSIONS } from '../../shared/authz/permission-codes.js';
import type { PrismaService } from '../../shared/prisma/prisma.service.js';
import { CurriculumExportService } from './curriculum-export.service.js';
import { CURRICULUM_SHEET } from './sheets/curriculum.sheet.js';
import { readSheet } from './sheets/sheet-reader.js';
import { validateCurriculumRows } from './validation/curriculum-validator.js';

function access() {
  return new AccessContext('user', [
    {
      assignmentId: null,
      roleId: 'r',
      roleCode: 'R3',
      roleName: 'R3',
      scopeSource: 'NONE',
      scopeType: 'SYSTEM',
      scopeUnit: null,
      scope: { all: true },
      permissions: new Map([
        [
          PERMISSIONS.CURRICULUM_IMPORT_EXPORT_EXCEL,
          { mode: 'DIRECT', scope: 'ALL' },
        ],
      ]),
    },
  ]);
}
describe('CurriculumExportService', () => {
  let service: CurriculumExportService;
  let findUnique: ReturnType<typeof vi.fn>;
  let findMany: ReturnType<typeof vi.fn>;
  const version = (
    status: ProgramVersionStatus = ProgramVersionStatus.DRAFT,
  ) => ({
    id: 'v',
    status,
    versionNumber: status === 'DRAFT' ? null : '1.0',
    programName: 'Tên phiên bản',
    majorCode: 'M01',
    semesterCount: 8,
    totalCredits: new Prisma.Decimal(3),
    compulsoryCredits: new Prisma.Decimal(3),
    electiveCredits: new Prisma.Decimal(0),
    program: { id: 'p', facultyId: 'f', programCode: 'P01' },
  });
  const item = () => ({
    id: 'i',
    courseNameSnapshot: null,
    creditsSnapshot: null,
    course: {
      courseCode: 'A',
      courseName: 'Tên A',
      credits: new Prisma.Decimal('2.5'),
    },
    plannedSemester: 2,
    sortOrder: 1,
    blockSymbol: 'CS',
    isElective: false,
    htDa: true,
    tqDa: false,
    minStudiedScore: new Prisma.Decimal(2),
    minTransferScore: new Prisma.Decimal('2.5'),
    note: 'Ghi chú',
    requisites: [
      {
        relationType: 'PRIOR',
        sourceCourse: { courseCode: 'B', courseName: 'Tên B' },
      },
      {
        relationType: 'COREQUISITE',
        sourceCourse: { courseCode: 'C', courseName: 'Tên C' },
      },
      {
        relationType: 'PREREQUISITE',
        sourceCourse: { courseCode: 'D', courseName: 'Tên D' },
      },
    ],
  });
  beforeEach(() => {
    findUnique = vi.fn().mockResolvedValue(version());
    findMany = vi.fn().mockResolvedValue([item()]);
    service = new CurriculumExportService({
      programVersion: { findUnique },
      curriculumItem: { findMany },
    } as unknown as PrismaService);
  });
  it('writes the SRS columns, version header, decimals, flags and separate requisite lists', async () => {
    const file = await service.export('v', access());
    const parsed = await readSheet(file.content, CURRICULUM_SHEET);
    expect(file.fileName).toBe('P01_nhap.xlsx');
    expect(parsed.formatErrors).toEqual([]);
    expect(parsed.header).toMatchObject({
      programCode: 'P01',
      programName: 'Tên phiên bản',
      totalCredits: '3',
      majorCode: 'M01',
    });
    expect(parsed.rows[0].cells).toMatchObject({
      courseCode: 'A',
      credits: '2.5',
      plannedSemester: '2',
      htDa: 'x',
      tqDa: '',
      registrable: '',
      minStudiedScore: '2',
      minTransferScore: '2.5',
      priorCourses: 'B – Tên B',
      corequisites: 'C – Tên C',
      prerequisites: 'D – Tên D',
      note: 'Ghi chú',
    });
    expect(findMany.mock.calls[0][0].orderBy).toEqual([
      { plannedSemester: 'asc' },
      { sortOrder: 'asc' },
      { id: 'asc' },
    ]);
  });
  it.each([
    { score: '2.5', errorRows: 0 },
    { score: '5', errorRows: 1 },
  ])(
    'round-trips real workbook cells with transfer score $score through the validator',
    async ({ score, errorRows }) => {
      findMany.mockResolvedValue([
        { ...item(), minTransferScore: new Prisma.Decimal(score) },
      ]);
      const file = await service.export('v', access());
      const parsed = await readSheet(file.content, CURRICULUM_SHEET);
      const target = version();
      const result = validateCurriculumRows(parsed, {
        version: target,
        program: {
          programCode: target.program.programCode,
          programName: target.programName,
          majorCode: target.majorCode,
        },
        coursesByCode: new Map(
          ['A', 'B', 'C', 'D'].map((code) => [
            code,
            {
              id: code,
              courseCode: code,
              courseName: `Tên ${code}`,
              credits: new Prisma.Decimal(code === 'A' ? '2.5' : '3'),
              status: 'ACTIVE' as const,
            },
          ]),
        ),
        existingItems: new Map(),
        groups: [],
        catalogEdges: [],
        catalogMinScores: new Map(),
      });
      expect(parsed.formatErrors).toEqual([]);
      expect(parsed.header.programCode).toBe(target.program.programCode);
      expect(parsed.rows[0].cells).toMatchObject({
        priorCourses: 'B – Tên B',
        plannedSemester: '2',
        registrable: '',
      });
      expect(result.errorRows, JSON.stringify(result.report, null, 2)).toBe(
        errorRows,
      );
      if (errorRows)
        expect(
          result.report.issues.filter((issue) => issue.severity === 'ERROR'),
        ).toEqual([
          expect.objectContaining({
            code: 'VALUE_INVALID',
            column: 'Điểm chuyển',
          }),
        ]);
    },
  );
  it.each([
    ProgramVersionStatus.PENDING,
    ProgramVersionStatus.ACTIVE,
    ProgramVersionStatus.HISTORICAL,
  ])('exports %s using F-15 frozen row facts', async (status) => {
    findUnique.mockResolvedValue(version(status));
    findMany.mockResolvedValue([
      {
        ...item(),
        courseNameSnapshot: 'Tên đã ban hành',
        creditsSnapshot: new Prisma.Decimal(3),
      },
    ]);
    const file = await service.export('v', access());
    const parsed = await readSheet(file.content, CURRICULUM_SHEET);
    expect(file.fileName).toBe('P01_1.0.xlsx');
    expect(parsed.rows[0].cells).toMatchObject({
      courseName: 'Tên đã ban hành',
      credits: '3',
    });
  });
  it('refuses a missing version and checks scope before reading items', async () => {
    await expect(
      service.export('v', new AccessContext('u', [])),
    ).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    expect(findMany).not.toHaveBeenCalled();
    findUnique.mockResolvedValue(null);
    await expect(service.export('missing', access())).rejects.toMatchObject({
      code: 'PROGRAM_VERSION_NOT_FOUND',
    });
  });
  it('sanitizes unsafe file-name characters', async () => {
    findUnique.mockResolvedValue({
      ...version(),
      program: { id: 'p', facultyId: 'f', programCode: 'P/01' },
    });
    expect((await service.export('v', access())).fileName).toBe(
      'P_01_nhap.xlsx',
    );
  });
});
