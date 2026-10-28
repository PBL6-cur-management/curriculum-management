import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CourseStatus,
  Prisma,
  ScopeSource,
  ScopeType,
  SyllabusStatus,
} from '../../generated/prisma/client.js';
import {
  AccessContext,
  type ActiveAssignment,
  type PermissionGrant,
} from '../../shared/authz/access-context.js';
import {
  PERMISSIONS,
  type PermissionCode,
} from '../../shared/authz/permission-codes.js';
import type { PrismaService } from '../../shared/prisma/prisma.service.js';
import type {
  ReplaceAssessmentMappingsDto,
  ReplaceGradeFormulaDto,
} from './grade-formula.dto.js';
import { GradeFormulaService } from './grade-formula.service.js';

function holder(
  orgUnitIds: string[],
  permissions: PermissionCode[],
): AccessContext {
  const assignment: ActiveAssignment = {
    assignmentId: null,
    roleId: 'r',
    roleCode: 'R',
    roleName: 'R',
    scopeSource: ScopeSource.NONE,
    scopeType: ScopeType.ASSIGNMENT,
    scopeUnit: null,
    scope: {
      all: false,
      orgUnitIds: new Set(orgUnitIds),
      subjectGroupIds: new Set(),
      programIds: new Set(),
      studentIds: new Set(),
    },
    permissions: new Map<PermissionCode, PermissionGrant>([
      ...permissions.map((code): [PermissionCode, PermissionGrant] => [
        code,
        { mode: 'DIRECT', scope: 'SCOPED' },
      ]),
      [PERMISSIONS.PROGRAM_VIEW, { mode: 'DIRECT', scope: 'ALL' }],
    ]),
  };
  return new AccessContext('user', [assignment]);
}

const GRADER = holder(['home'], [PERMISSIONS.GRADING_FORMULA_EDIT]);
const AUTHOR = holder(['home'], [PERMISSIONS.SYLLABUS_EDIT]);
const OUTSIDER = holder(['other'], [PERMISSIONS.GRADING_FORMULA_EDIT]);

const TOKEN = new Date('2026-10-27T01:00:00.000Z');

function accessRow(status: SyllabusStatus, updatedAt = TOKEN) {
  return {
    id: 's1',
    status,
    courseId: 'c1',
    updatedAt,
    course: {
      id: 'c1',
      courseCode: 'IT001',
      courseName: 'Nhập môn',
      englishName: null,
      credits: new Prisma.Decimal('3'),
      status: CourseStatus.ACTIVE,
      ownerFacultyId: 'home',
      ownerGroupId: null,
      ownerFaculty: { unitCode: 'KHOA_CNTT' },
    },
  };
}

const SAVED = {
  failingScore: null,
  clos: [{ id: 'k1', cloCode: 'CLO1', sortOrder: 1 }],
  assessmentComponents: [
    {
      id: 'a1',
      syllabusId: 's1',
      componentCode: 'GK',
      componentName: 'Giữa kỳ',
      weight: new Prisma.Decimal('100'),
      assessmentForm: null,
      isConditional: false,
      conditionThreshold: null,
      failingScore: null,
      mappings: [],
    },
  ],
};

function component(code: string, weight: string, id?: string) {
  return {
    ...(id === undefined ? {} : { id }),
    componentCode: code,
    componentName: `Thành phần ${code}`,
    weight,
    isConditional: false,
  };
}

function formula(
  components: ReturnType<typeof component>[],
  patch: Partial<ReplaceGradeFormulaDto> = {},
): ReplaceGradeFormulaDto {
  return {
    expectedUpdatedAt: TOKEN.toISOString(),
    failingScore: null,
    components,
    ...patch,
  } as ReplaceGradeFormulaDto;
}

describe('GradeFormulaService', () => {
  let prisma: {
    syllabus: Record<
      'findUnique' | 'findFirst' | 'findUniqueOrThrow' | 'update',
      ReturnType<typeof vi.fn>
    >;
    assessmentComponent: Record<
      'findMany' | 'create' | 'update' | 'deleteMany',
      ReturnType<typeof vi.fn>
    >;
    assessmentCLOMapping: Record<
      'deleteMany' | 'createMany',
      ReturnType<typeof vi.fn>
    >;
    cLO: { findMany: ReturnType<typeof vi.fn> };
    $transaction: ReturnType<typeof vi.fn>;
    $queryRaw: ReturnType<typeof vi.fn>;
  };
  let service: GradeFormulaService;

  beforeEach(() => {
    prisma = {
      syllabus: {
        findUnique: vi.fn().mockResolvedValue(accessRow(SyllabusStatus.DRAFT)),
        findFirst: vi.fn().mockResolvedValue(null),
        findUniqueOrThrow: vi.fn().mockResolvedValue(SAVED),
        update: vi.fn().mockResolvedValue({}),
      },
      assessmentComponent: {
        findMany: vi.fn().mockResolvedValue([{ id: 'a1' }, { id: 'a2' }]),
        create: vi.fn().mockResolvedValue({}),
        update: vi.fn().mockResolvedValue({}),
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      assessmentCLOMapping: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        createMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      cLO: { findMany: vi.fn().mockResolvedValue([{ id: 'k1' }]) },
      $transaction: vi.fn(),
      $queryRaw: vi.fn().mockResolvedValue([]),
    };
    prisma.$transaction.mockImplementation((run: (tx: unknown) => unknown) =>
      run(prisma),
    );
    service = new GradeFormulaService(prisma as unknown as PrismaService);
  });

  describe('replaceFormula', () => {
    it('saves the whole formula and returns the reloaded aggregate', async () => {
      const result = await service.replaceFormula(
        's1',
        formula([component('GK', '40', 'a1'), component('CK', '60')], {
          failingScore: '4',
        }),
        GRADER,
      );

      expect(prisma.assessmentComponent.create).toHaveBeenCalledTimes(1);
      expect(prisma.syllabus.update).toHaveBeenCalledWith({
        where: { id: 's1' },
        data: {
          failingScore: new Prisma.Decimal('4'),
          updatedAt: expect.any(Date),
        },
      });
      expect(result.components.map((row) => row.componentCode)).toEqual(['GK']);
    });

    it('locks the revision before reading it', async () => {
      await service.replaceFormula(
        's1',
        formula([component('GK', '100')]),
        GRADER,
      );

      expect(prisma.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
        prisma.syllabus.findUnique.mock.invocationCallOrder.at(-1)!,
      );
    });

    it('moves the token strictly forward even inside the same millisecond', async () => {
      const future = new Date(Date.now() + 60_000);
      prisma.syllabus.findUnique.mockResolvedValue(
        accessRow(SyllabusStatus.DRAFT, future),
      );

      await service.replaceFormula(
        's1',
        formula([component('GK', '100')], {
          expectedUpdatedAt: future.toISOString(),
        }),
        GRADER,
      );

      const { data } = prisma.syllabus.update.mock.calls[0]![0] as {
        data: { updatedAt: Date };
      };
      expect(data.updatedAt.getTime()).toBeGreaterThan(future.getTime());
    });

    it('refuses a total other than 100 before writing anything', async () => {
      await expect(
        service.replaceFormula(
          's1',
          formula([component('GK', '40'), component('CK', '50')]),
          GRADER,
        ),
      ).rejects.toMatchObject({ code: 'ASSESSMENT_WEIGHT_TOTAL_INVALID' });

      expect(prisma.assessmentComponent.deleteMany).not.toHaveBeenCalled();
      expect(prisma.assessmentComponent.create).not.toHaveBeenCalled();
      expect(prisma.syllabus.update).not.toHaveBeenCalled();
    });

    it('requires a threshold for a conditional component but accepts zero', async () => {
      await expect(
        service.replaceFormula(
          's1',
          formula([{ ...component('GK', '100'), isConditional: true }]),
          GRADER,
        ),
      ).rejects.toMatchObject({
        code: 'ASSESSMENT_CONDITION_THRESHOLD_REQUIRED',
      });

      await service.replaceFormula(
        's1',
        formula([
          {
            ...component('GK', '100'),
            isConditional: true,
            conditionThreshold: '0',
          } as ReturnType<typeof component>,
        ]),
        GRADER,
      );
      expect(prisma.assessmentComponent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          conditionThreshold: new Prisma.Decimal('0'),
        }),
      });
    });

    it('drops the threshold of a component that is not conditional and keeps null cutoffs null', async () => {
      await service.replaceFormula(
        's1',
        formula([
          {
            ...component('GK', '100'),
            conditionThreshold: '5',
          } as ReturnType<typeof component>,
        ]),
        GRADER,
      );

      expect(prisma.assessmentComponent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          conditionThreshold: null,
          failingScore: null,
          assessmentForm: null,
        }),
      });
    });

    it('refuses duplicate codes after normalization', async () => {
      await expect(
        service.replaceFormula(
          's1',
          formula([component('GK', '50'), component('GK', '50')]),
          GRADER,
        ),
      ).rejects.toMatchObject({ code: 'ASSESSMENT_CODE_DUPLICATE' });
      expect(prisma.syllabus.update).not.toHaveBeenCalled();
    });

    it('refuses the reserved temporary code prefix', async () => {
      await expect(
        service.replaceFormula(
          's1',
          formula([component('__F12_TMP__X', '100')]),
          GRADER,
        ),
      ).rejects.toMatchObject({ code: 'ASSESSMENT_COMPONENT_INVALID' });
    });

    it('refuses an id that belongs to another revision and a repeated id', async () => {
      await expect(
        service.replaceFormula(
          's1',
          formula([component('GK', '100', 'foreign')]),
          GRADER,
        ),
      ).rejects.toMatchObject({ code: 'ASSESSMENT_ID_INVALID' });
      await expect(
        service.replaceFormula(
          's1',
          formula([component('GK', '50', 'a1'), component('CK', '50', 'a1')]),
          GRADER,
        ),
      ).rejects.toMatchObject({ code: 'ASSESSMENT_ID_INVALID' });
      expect(prisma.syllabus.update).not.toHaveBeenCalled();
    });

    it('deletes omitted components and parks retained codes so a swap cannot collide', async () => {
      await service.replaceFormula(
        's1',
        formula([component('CK', '50', 'a1'), component('GK', '50', 'a2')]),
        GRADER,
      );

      expect(prisma.assessmentComponent.deleteMany).not.toHaveBeenCalled();
      const updates = prisma.assessmentComponent.update.mock.calls.map(
        ([arg]) =>
          (arg as { data: { componentCode: string } }).data.componentCode,
      );
      expect(updates).toEqual(['__F12_TMP__a1', '__F12_TMP__a2', 'CK', 'GK']);

      prisma.assessmentComponent.deleteMany.mockClear();
      await service.replaceFormula(
        's1',
        formula([component('GK', '100', 'a1')]),
        GRADER,
      );
      expect(prisma.assessmentComponent.deleteMany).toHaveBeenCalledWith({
        where: { syllabusId: 's1', id: { in: ['a2'] } },
      });
    });

    it('keeps a retained component by updating it, never recreating it', async () => {
      await service.replaceFormula(
        's1',
        formula([component('GK', '100', 'a1')]),
        GRADER,
      );

      expect(prisma.assessmentComponent.create).not.toHaveBeenCalled();
      expect(prisma.assessmentCLOMapping.deleteMany).not.toHaveBeenCalled();
    });

    it('maps a unique-index collision to a duplicate-code refusal', async () => {
      prisma.assessmentComponent.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('dup', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );

      await expect(
        service.replaceFormula('s1', formula([component('GK', '100')]), GRADER),
      ).rejects.toMatchObject({ code: 'ASSESSMENT_CODE_DUPLICATE' });
    });

    it('answers stale when the token no longer matches', async () => {
      await expect(
        service.replaceFormula(
          's1',
          formula([component('GK', '100')], {
            expectedUpdatedAt: '2026-10-27T00:00:00.000Z',
          }),
          GRADER,
        ),
      ).rejects.toMatchObject({ code: 'ASSESSMENT_STALE' });
      expect(prisma.assessmentComponent.create).not.toHaveBeenCalled();
    });

    it('refuses a holder without the grading permission', async () => {
      await expect(
        service.replaceFormula('s1', formula([component('GK', '100')]), AUTHOR),
      ).rejects.toBeDefined();
      expect(prisma.syllabus.update).not.toHaveBeenCalled();
    });

    it('refuses a holder outside the course scope', async () => {
      await expect(
        service.replaceFormula(
          's1',
          formula([component('GK', '100')]),
          OUTSIDER,
        ),
      ).rejects.toBeDefined();
      expect(prisma.syllabus.update).not.toHaveBeenCalled();
    });

    it('asks for a change request on a published revision', async () => {
      prisma.syllabus.findUnique.mockResolvedValue(
        accessRow(SyllabusStatus.PUBLISHED),
      );

      await expect(
        service.replaceFormula('s1', formula([component('GK', '100')]), GRADER),
      ).rejects.toBeDefined();
      expect(prisma.syllabus.update).not.toHaveBeenCalled();
    });

    it('is not found for an unknown revision', async () => {
      prisma.syllabus.findUnique.mockResolvedValue(null);

      await expect(
        service.replaceFormula('s1', formula([component('GK', '100')]), GRADER),
      ).rejects.toBeDefined();
    });

    it('reports an uncovered CLO as a warning, not a refusal', async () => {
      const result = await service.replaceFormula(
        's1',
        formula([component('GK', '100', 'a1')]),
        GRADER,
      );

      expect(result.warnings).toMatchObject([
        { code: 'ASSESSMENT_CLO_UNCOVERED', cloId: 'k1' },
      ]);
    });
  });

  describe('replaceMappings', () => {
    const grid = (
      mappings: ReplaceAssessmentMappingsDto['mappings'],
      patch: Partial<ReplaceAssessmentMappingsDto> = {},
    ): ReplaceAssessmentMappingsDto => ({
      expectedUpdatedAt: TOKEN.toISOString(),
      mappings,
      ...patch,
    });

    it('replaces the grid and keeps a null weight as a mapped cell', async () => {
      await service.replaceMappings(
        's1',
        grid([
          { assessmentComponentId: 'a1', cloId: 'k1', cloWeight: null },
          { assessmentComponentId: 'a2', cloId: 'k1', cloWeight: '0' },
        ]),
        GRADER,
      );

      expect(prisma.assessmentCLOMapping.deleteMany).toHaveBeenCalledWith({
        where: { assessmentComponent: { syllabusId: 's1' } },
      });
      expect(prisma.assessmentCLOMapping.createMany).toHaveBeenCalledWith({
        data: [
          { assessmentComponentId: 'a1', cloId: 'k1', cloWeight: null },
          {
            assessmentComponentId: 'a2',
            cloId: 'k1',
            cloWeight: new Prisma.Decimal('0'),
          },
        ],
      });
      expect(prisma.syllabus.update).toHaveBeenCalledTimes(1);
    });

    it('accepts an empty grid as valid Draft work', async () => {
      await service.replaceMappings('s1', grid([]), GRADER);

      expect(prisma.assessmentCLOMapping.createMany).not.toHaveBeenCalled();
      expect(prisma.assessmentCLOMapping.deleteMany).toHaveBeenCalled();
    });

    it('refuses a foreign component, a foreign CLO and a repeated cell', async () => {
      await expect(
        service.replaceMappings(
          's1',
          grid([{ assessmentComponentId: 'x', cloId: 'k1' }]),
          GRADER,
        ),
      ).rejects.toMatchObject({ code: 'ASSESSMENT_MAPPING_INVALID' });
      await expect(
        service.replaceMappings(
          's1',
          grid([{ assessmentComponentId: 'a1', cloId: 'x' }]),
          GRADER,
        ),
      ).rejects.toMatchObject({ code: 'ASSESSMENT_MAPPING_INVALID' });
      await expect(
        service.replaceMappings(
          's1',
          grid([
            { assessmentComponentId: 'a1', cloId: 'k1' },
            { assessmentComponentId: 'a1', cloId: 'k1' },
          ]),
          GRADER,
        ),
      ).rejects.toMatchObject({ code: 'ASSESSMENT_MAPPING_INVALID' });
      expect(prisma.assessmentCLOMapping.deleteMany).not.toHaveBeenCalled();
    });

    it('answers stale and refuses a non-holder without touching the grid', async () => {
      await expect(
        service.replaceMappings(
          's1',
          grid([], { expectedUpdatedAt: '2026-10-27T00:00:00.000Z' }),
          GRADER,
        ),
      ).rejects.toMatchObject({ code: 'ASSESSMENT_STALE' });
      await expect(
        service.replaceMappings('s1', grid([]), AUTHOR),
      ).rejects.toBeDefined();
      expect(prisma.assessmentCLOMapping.deleteMany).not.toHaveBeenCalled();
    });
  });
});
