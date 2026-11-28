import { Injectable } from '@nestjs/common';
import {
  ProgramVersionStatus,
  type Prisma,
} from '../../generated/prisma/client.js';
import type { AccessContext } from '../../shared/authz/access-context.js';
import { PERMISSIONS } from '../../shared/authz/permission-codes.js';
import { toWireDecimal } from '../../shared/decimal/decimal.js';
import { USER_REF_SELECT } from '../../shared/dtos/ref.dto.js';
import { AppException } from '../../shared/exception/app.exception.js';
import { PrismaService } from '../../shared/prisma/prisma.service.js';
import { programTarget } from '../../shared/programs/program-target.js';
import {
  canEditCorrection,
  isCorrectionDraft,
} from '../../shared/releases/correction-access.js';
import { RELEASE_ERRORS } from '../../shared/releases/release.errors.js';
import {
  toCohortDto,
  toSemesterDto,
} from '../../shared/releases/semester.dto.js';
import { rowCourse } from '../../shared/curriculum/row-course.js';
import { revisionForItems } from '../../shared/syllabi/revision-for-items.js';
import { toIsoDay } from '../../shared/time/today.js';
import type {
  VersionDetailDto,
  VersionListDto,
  VersionRefDto,
  VersionRowDto,
} from './dto/version-detail.dto.js';

const REF_INCLUDE = {
  effectiveSemester: true,
  cohortVersions: {
    include: { cohort: true },
    orderBy: { cohort: { intakeYear: 'desc' } },
  },
  originRequest: { select: { id: true, requestCode: true } },
  correctedBy: { select: { id: true, versionNumber: true, status: true } },
} as const satisfies Prisma.ProgramVersionInclude;

const DETAIL_INCLUDE = {
  ...REF_INCLUDE,
  publishedBy: { select: USER_REF_SELECT },
  previousVersion: { select: { id: true, versionNumber: true } },
  correctionOf: { select: { id: true, versionNumber: true } },
  curriculumItems: {
    select: {
      id: true,
      courseId: true,
      plannedSemester: true,
      sortOrder: true,
      syllabusId: true,
      courseNameSnapshot: true,
      creditsSnapshot: true,
      course: { select: { courseCode: true, courseName: true, credits: true } },
    },
    orderBy: [{ plannedSemester: 'asc' }, { sortOrder: 'asc' }, { id: 'asc' }],
  },
} as const satisfies Prisma.ProgramVersionInclude;

type RefRow = Prisma.ProgramVersionGetPayload<{ include: typeof REF_INCLUDE }>;
type DetailRow = Prisma.ProgramVersionGetPayload<{
  include: typeof DETAIL_INCLUDE;
}>;

// MH-46 / MH-47: the issued versions of a program and the frozen content of one. Read-only by construction:
// nothing here offers a write, whoever asks.
@Injectable()
export class VersionHistoryReader {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    programId: string,
    access: AccessContext,
  ): Promise<VersionListDto> {
    const program = await this.scopedProgram(programId, access);
    // A student sees issued versions only; a working copy and an unissued correction are never listed.
    const seesDrafts = access.scopeFor(PERMISSIONS.PROGRAM_VIEW).all;
    const rows = await this.prisma.programVersion.findMany({
      where: {
        programId: program.id,
        sourceRequestId: null,
        ...(!seesDrafts && { status: { not: ProgramVersionStatus.DRAFT } }),
        NOT: {
          status: ProgramVersionStatus.DRAFT,
          correctionOfId: { not: null },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: REF_INCLUDE,
    });
    return { versions: rows.map(toVersionRef) };
  }

  async detail(
    programId: string,
    versionId: string,
    access: AccessContext,
  ): Promise<VersionDetailDto> {
    const program = await this.scopedProgram(programId, access);
    const row = await this.prisma.programVersion.findFirst({
      where: { id: versionId, programId: program.id, sourceRequestId: null },
      include: DETAIL_INCLUDE,
    });
    // A plain Draft is served by the curriculum screens, not here; a correction Draft is the academic office's.
    if (
      !row ||
      (row.status === ProgramVersionStatus.DRAFT && !isCorrectionDraft(row)) ||
      (isCorrectionDraft(row) && !canEditCorrection(access))
    ) {
      throw new AppException(RELEASE_ERRORS.VERSION_NOT_FOUND);
    }
    return this.toDetail(row, program, access);
  }

  private async scopedProgram(programId: string, access: AccessContext) {
    const program = await this.prisma.program.findUnique({
      where: { id: programId },
      select: { id: true, programCode: true, facultyId: true },
    });
    if (!program) throw new AppException(RELEASE_ERRORS.PROGRAM_NOT_FOUND);
    access.assertCan(PERMISSIONS.PROGRAM_VIEW, programTarget(program));
    return program;
  }

  private async toDetail(
    row: DetailRow,
    program: { programCode: string },
    access: AccessContext,
  ): Promise<VersionDetailDto> {
    const revisions = await revisionForItems(
      this.prisma,
      row.curriculumItems.map((item) => ({
        id: item.id,
        courseId: item.courseId,
        syllabusId: item.syllabusId,
      })),
    );
    const rows: VersionRowDto[] = row.curriculumItems.map((item) => {
      const course = rowCourse(item);
      const revision = revisions.get(item.id);
      return {
        itemId: item.id,
        plannedSemester: item.plannedSemester,
        courseId: item.courseId,
        courseCode: course.courseCode,
        courseName: course.courseName,
        credits: toWireDecimal(course.credits),
        syllabus: revision
          ? {
              id: revision.id,
              revisionNumber: revision.revisionNumber,
              status: revision.status,
            }
          : null,
      };
    });
    const corrector = canEditCorrection(access);
    const draftCorrection =
      row.correctedBy?.status === ProgramVersionStatus.DRAFT
        ? row.correctedBy
        : null;
    const issuedCorrection =
      row.correctedBy !== null && draftCorrection === null;
    const activeEnrollments =
      row.status === ProgramVersionStatus.HISTORICAL &&
      row.cohortVersions.length === 0 &&
      this.prisma.programEnrollment
        ? await this.prisma.programEnrollment.count({
            where: { appliedVersionId: row.id, untilSemesterId: null },
          })
        : 0;
    const released =
      row.status === ProgramVersionStatus.ACTIVE ||
      row.status === ProgramVersionStatus.PENDING ||
      (row.status === ProgramVersionStatus.HISTORICAL &&
        (row.cohortVersions.length > 0 || activeEnrollments > 0));
    return Object.assign(toVersionRef(row), {
      programId: row.programId,
      programCode: program.programCode,
      programName: row.programName,
      majorCode: row.majorCode,
      majorName: row.majorName,
      semesterCount: row.semesterCount,
      totalCredits: toWireDecimal(row.totalCredits),
      compulsoryCredits: toWireDecimal(row.compulsoryCredits),
      electiveCredits: toWireDecimal(row.electiveCredits),
      publishedBy: row.publishedBy,
      previousVersion: row.previousVersion,
      correctionOf: row.correctionOf,
      correctionReason: row.correctionReason,
      isCorrectionDraft: isCorrectionDraft(row),
      openCorrection:
        corrector && draftCorrection
          ? {
              id: draftCorrection.id,
              versionNumber: draftCorrection.versionNumber,
            }
          : null,
      // A Draft correction already open can be continued; an issued one ends the right to correct this version.
      canCorrect: corrector && released && !issuedCorrection,
      rows,
    });
  }
}

export function toVersionRef(row: RefRow): VersionRefDto {
  const issued =
    row.correctedBy && row.correctedBy.status !== ProgramVersionStatus.DRAFT
      ? row.correctedBy
      : null;
  return {
    id: row.id,
    versionNumber: row.versionNumber,
    status: row.status,
    decisionNumber: row.decisionNumber,
    signedDate: row.signedDate ? toIsoDay(row.signedDate) : null,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    effectiveSemester: row.effectiveSemester
      ? toSemesterDto(row.effectiveSemester)
      : null,
    cohorts: row.cohortVersions.map((link) => toCohortDto(link.cohort)),
    originRequest: row.originRequest,
    correctedBy: issued
      ? { id: issued.id, versionNumber: issued.versionNumber }
      : null,
  };
}
