import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import type { AccessContext } from '../../shared/authz/access-context.js';
import { PERMISSIONS } from '../../shared/authz/permission-codes.js';
import { AppException } from '../../shared/exception/app.exception.js';
import type { ErrorDefinition } from '../../shared/exception/error-definition.js';
import type { FieldErrorDto } from '../../shared/dtos/error-response.dto.js';
import { PrismaService } from '../../shared/prisma/prisma.service.js';
import { ASSESSMENT_ERRORS } from '../../shared/syllabi/grade-formula.errors.js';
import {
  ASSESSMENT_CONDITION,
  assessmentIssues,
  GRADE_FORMULA_LIMITS,
  type AssessmentRuleIssue,
} from '../../shared/syllabi/grade-formula.rules.js';
import { lockSyllabusAssessment } from '../../shared/syllabi/syllabus-assessment-lock.js';
import {
  GRADE_FORMULA_SELECT,
  toGradeFormulaDto,
  type GradeFormulaDto,
  type ReplaceAssessmentMappingsDto,
  type ReplaceGradeFormulaDto,
} from './grade-formula.dto.js';
import { assertDraftWrite, SYLLABUS_ACCESS_SELECT } from './syllabus-access.js';

// Two aggregate saves must never share a token, so the new updatedAt is always later than the locked one.
const UPDATED_AT_STEP_MS = 1;

export interface GradeFormulaWriter {
  replaceFormula(
    syllabusId: string,
    dto: ReplaceGradeFormulaDto,
    access: AccessContext,
  ): Promise<GradeFormulaDto>;
  replaceMappings(
    syllabusId: string,
    dto: ReplaceAssessmentMappingsDto,
    access: AccessContext,
  ): Promise<GradeFormulaDto>;
}

function toDetails(issues: readonly AssessmentRuleIssue[]): FieldErrorDto[] {
  return issues.map((issue) => ({
    field: issue.field,
    constraints: [issue.message],
  }));
}

// One error code per refusal, most specific first; every issue still travels in details.
function refusalFor(
  issues: readonly AssessmentRuleIssue[],
  hasDuplicateCode: boolean,
): AppException {
  const first = (code: AssessmentRuleIssue['code']) =>
    issues.find((issue) => issue.code === code);
  const threshold = first(ASSESSMENT_CONDITION.CONDITIONAL_THRESHOLD);
  const total = first(ASSESSMENT_CONDITION.WEIGHT_TOTAL);
  const definition: ErrorDefinition = hasDuplicateCode
    ? ASSESSMENT_ERRORS.CODE_DUPLICATE
    : threshold
      ? ASSESSMENT_ERRORS.CONDITION_THRESHOLD_REQUIRED
      : first(ASSESSMENT_CONDITION.COMPONENT_INVALID)
        ? ASSESSMENT_ERRORS.COMPONENT_INVALID
        : total
          ? {
              ...ASSESSMENT_ERRORS.WEIGHT_TOTAL_INVALID,
              message: total.message,
            }
          : ASSESSMENT_ERRORS.COMPONENT_INVALID;
  return new AppException(definition, toDetails(issues));
}

@Injectable()
export class GradeFormulaService implements GradeFormulaWriter {
  constructor(private readonly prisma: PrismaService) {}

  // The whole formula at once: a total other than 100 is never stored. Retained ids keep their CLO links.
  async replaceFormula(
    syllabusId: string,
    dto: ReplaceGradeFormulaDto,
    access: AccessContext,
  ): Promise<GradeFormulaDto> {
    return this.prisma.$transaction(async (tx) => {
      const previous = await this.openRevision(
        tx,
        syllabusId,
        dto.expectedUpdatedAt,
        access,
      );
      const components = dto.components.map((component) => ({
        ...component,
        assessmentForm: component.assessmentForm ?? null,
        conditionThreshold: component.isConditional
          ? (component.conditionThreshold ?? null)
          : null,
        failingScore: component.failingScore ?? null,
      }));
      const issues = assessmentIssues({
        failingScore: dto.failingScore,
        clos: [],
        assessmentComponents: components.map((component) => ({
          ...component,
          mappings: [],
        })),
      });
      components.forEach((component, index) => {
        if (
          component.componentCode.startsWith(
            GRADE_FORMULA_LIMITS.TEMPORARY_CODE_PREFIX,
          )
        ) {
          issues.push({
            code: ASSESSMENT_CONDITION.COMPONENT_INVALID,
            field: `components.${index}.componentCode`,
            message: `Mã thành phần không được bắt đầu bằng ${GRADE_FORMULA_LIMITS.TEMPORARY_CODE_PREFIX}.`,
          });
        }
      });
      if (issues.length > 0) {
        const codes = components.map((component) => component.componentCode);
        throw refusalFor(issues, new Set(codes).size !== codes.length);
      }

      const owned = new Set(
        (
          await tx.assessmentComponent.findMany({
            where: { syllabusId },
            select: { id: true },
          })
        ).map((row) => row.id),
      );
      const keptIds = components.flatMap((component) =>
        component.id === undefined ? [] : [component.id],
      );
      if (
        new Set(keptIds).size !== keptIds.length ||
        keptIds.some((id) => !owned.has(id))
      ) {
        throw new AppException(ASSESSMENT_ERRORS.ID_INVALID);
      }

      try {
        const kept = new Set(keptIds);
        const omitted = [...owned].filter((id) => !kept.has(id));
        if (omitted.length > 0) {
          await tx.assessmentComponent.deleteMany({
            where: { syllabusId, id: { in: omitted } },
          });
        }
        // Swapped codes would collide on the unique index mid-way, so retained rows park in a reserved namespace first.
        for (const id of keptIds) {
          await tx.assessmentComponent.update({
            where: { id },
            data: {
              componentCode: `${GRADE_FORMULA_LIMITS.TEMPORARY_CODE_PREFIX}${id}`,
            },
          });
        }
        for (const { id, ...fields } of components) {
          const data = {
            componentCode: fields.componentCode,
            componentName: fields.componentName,
            weight: new Prisma.Decimal(fields.weight),
            assessmentForm: fields.assessmentForm,
            isConditional: fields.isConditional,
            conditionThreshold:
              fields.conditionThreshold === null
                ? null
                : new Prisma.Decimal(fields.conditionThreshold),
            failingScore:
              fields.failingScore === null
                ? null
                : new Prisma.Decimal(fields.failingScore),
          };
          if (id === undefined) {
            await tx.assessmentComponent.create({
              data: { ...data, syllabusId },
            });
          } else {
            await tx.assessmentComponent.update({ where: { id }, data });
          }
        }
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          throw new AppException(ASSESSMENT_ERRORS.CODE_DUPLICATE);
        }
        throw error;
      }
      await tx.syllabus.update({
        where: { id: syllabusId },
        data: {
          failingScore:
            dto.failingScore === null
              ? null
              : new Prisma.Decimal(dto.failingScore),
          updatedAt: nextUpdatedAt(previous),
        },
      });
      return this.reload(tx, syllabusId);
    });
  }

  // Replaces the sparse grid only; the formula itself is untouched and an empty grid is valid Draft work.
  async replaceMappings(
    syllabusId: string,
    dto: ReplaceAssessmentMappingsDto,
    access: AccessContext,
  ): Promise<GradeFormulaDto> {
    return this.prisma.$transaction(async (tx) => {
      const previous = await this.openRevision(
        tx,
        syllabusId,
        dto.expectedUpdatedAt,
        access,
      );
      const [components, clos] = await Promise.all([
        tx.assessmentComponent.findMany({
          where: { syllabusId },
          select: { id: true },
        }),
        tx.cLO.findMany({ where: { syllabusId }, select: { id: true } }),
      ]);
      const componentIds = new Set(components.map((row) => row.id));
      const cloIds = new Set(clos.map((row) => row.id));
      const seen = new Set<string>();
      const issues: AssessmentRuleIssue[] = [];
      dto.mappings.forEach((mapping, index) => {
        const key = JSON.stringify([
          mapping.assessmentComponentId,
          mapping.cloId,
        ]);
        const field = `mappings.${index}`;
        if (!componentIds.has(mapping.assessmentComponentId)) {
          issues.push({
            code: ASSESSMENT_CONDITION.MAPPING_INVALID,
            field: `${field}.assessmentComponentId`,
            message: 'Thành phần đánh giá không thuộc bản đề cương này.',
          });
        }
        if (!cloIds.has(mapping.cloId)) {
          issues.push({
            code: ASSESSMENT_CONDITION.MAPPING_INVALID,
            field: `${field}.cloId`,
            message: 'CLO không thuộc bản đề cương này.',
          });
        }
        if (seen.has(key)) {
          issues.push({
            code: ASSESSMENT_CONDITION.MAPPING_INVALID,
            field: `${field}.cloId`,
            message: 'Ô ánh xạ này bị lặp trong danh sách.',
          });
        }
        seen.add(key);
      });
      if (issues.length > 0) {
        throw new AppException(
          ASSESSMENT_ERRORS.MAPPING_INVALID,
          toDetails(issues),
        );
      }
      await tx.assessmentCLOMapping.deleteMany({
        where: { assessmentComponent: { syllabusId } },
      });
      if (dto.mappings.length > 0) {
        await tx.assessmentCLOMapping.createMany({
          data: dto.mappings.map((mapping) => ({
            assessmentComponentId: mapping.assessmentComponentId,
            cloId: mapping.cloId,
            cloWeight:
              mapping.cloWeight == null
                ? null
                : new Prisma.Decimal(mapping.cloWeight),
          })),
        });
      }
      await tx.syllabus.update({
        where: { id: syllabusId },
        data: { updatedAt: nextUpdatedAt(previous) },
      });
      return this.reload(tx, syllabusId);
    });
  }

  // Lock first, then re-read: access, status and the token are all judged on the locked row.
  private async openRevision(
    tx: Prisma.TransactionClient,
    syllabusId: string,
    expectedUpdatedAt: string,
    access: AccessContext,
  ): Promise<Date> {
    await lockSyllabusAssessment(tx, syllabusId);
    const row = await tx.syllabus.findUnique({
      where: { id: syllabusId },
      select: { ...SYLLABUS_ACCESS_SELECT, updatedAt: true },
    });
    await assertDraftWrite(tx, access, row, PERMISSIONS.GRADING_FORMULA_EDIT);
    if (new Date(expectedUpdatedAt).getTime() !== row!.updatedAt.getTime()) {
      throw new AppException(ASSESSMENT_ERRORS.STALE);
    }
    return row!.updatedAt;
  }

  private async reload(
    tx: Prisma.TransactionClient,
    syllabusId: string,
  ): Promise<GradeFormulaDto> {
    return toGradeFormulaDto(
      await tx.syllabus.findUniqueOrThrow({
        where: { id: syllabusId },
        select: GRADE_FORMULA_SELECT,
      }),
    );
  }
}

function nextUpdatedAt(previous: Date): Date {
  return new Date(
    Math.max(Date.now(), previous.getTime() + UPDATED_AT_STEP_MS),
  );
}
