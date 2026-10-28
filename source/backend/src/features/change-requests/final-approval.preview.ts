import { Injectable } from '@nestjs/common';
import type { ChangeRequest } from '../../generated/prisma/client.js';
import { newestReleasedVersion } from '../../shared/change-requests/released-base.js';
import {
  WORKSPACE_KIND,
  workspaceKindFor,
} from '../../shared/change-requests/request-kinds.js';
import { StaleChecker } from '../../shared/change-requests/stale-checker.js';
import { ConsistencyChecker } from '../../shared/curriculum/consistency-checker.js';
import { PrismaService } from '../../shared/prisma/prisma.service.js';
import { newestVersionsContainingCourse } from '../../shared/releases/fan-out-targets.js';
import {
  collectSyllabusIssues,
  PUBLISHABLE_SYLLABUS_SELECT,
  syllabusPublishIssues,
} from '../../shared/releases/syllabus-release-issues.js';
import { countDroppedLinks } from '../../shared/releases/version.publisher.js';
import {
  bumpForRequest,
  nextReleaseNumber,
  VERSION_BUMP,
  type VersionBump,
} from '../../shared/releases/version-number.js';
import type {
  FinalApprovalProgramDto,
  FinalApprovalPreviewDto,
} from './final-approval.dto.js';
import { hasGradingChanges } from './grading-changes.js';

// What the academic office is shown before it decides. Advisory: the approval repeats every check in its transaction.
@Injectable()
export class FinalApprovalPreviewReader {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stale: StaleChecker,
    private readonly consistency: ConsistencyChecker,
  ) {}

  async read(request: ChangeRequest): Promise<FinalApprovalPreviewDto> {
    const workspace = workspaceKindFor(request.requestType, request.targetType);
    const base = {
      requestId: request.id,
      requestCode: request.requestCode,
      stale: await this.stale.isStale(this.prisma, request),
      canAllowPastSemester:
        request.createdByAcademicOffice &&
        !(await hasGradingChanges(this.prisma, request.id)),
    };
    if (workspace === WORKSPACE_KIND.PROGRAM_VERSION) {
      const affected = await this.programCopy(request);
      return {
        ...base,
        kind: 'PROGRAM_VERSION',
        affectedPrograms: affected,
        copyIssues: [],
        authoredLabels: [],
        canAssignCohorts: affected.length === 1,
      };
    }
    if (workspace === WORKSPACE_KIND.SYLLABUS) {
      const { affected, copyIssues } = await this.syllabusCopy(request);
      return {
        ...base,
        kind: 'SYLLABUS',
        affectedPrograms: affected,
        copyIssues,
        authoredLabels: [],
        canAssignCohorts: affected.length === 1,
      };
    }
    const items = await this.prisma.changeItem.findMany({
      where: { changeRequestId: request.id },
      select: { label: true },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });
    return {
      ...base,
      kind: 'AUTHORED',
      affectedPrograms: [],
      copyIssues: [],
      authoredLabels: items.map((item) => item.label),
      canAssignCohorts: false,
    };
  }

  private async programCopy(
    request: ChangeRequest,
  ): Promise<FinalApprovalProgramDto[]> {
    const copy = await this.prisma.programVersion.findUniqueOrThrow({
      where: { sourceRequestId: request.id },
      include: { program: { select: { programCode: true } } },
    });
    const base = await newestReleasedVersion(this.prisma, copy.programId);
    const { issues } = await this.consistency.check(copy.id);
    return [
      {
        programId: copy.programId,
        programCode: copy.program.programCode,
        baseVersionId: base?.id ?? copy.baseVersionId ?? copy.id,
        baseVersionNumber: base?.versionNumber ?? null,
        nextVersionNumber: await this.nextNumber(
          copy.programId,
          base?.versionNumber ?? null,
          bumpForRequest(request),
        ),
        consistencyIssues: issues,
        syllabusIssues: await collectSyllabusIssues(this.prisma, copy.id),
        droppedCloLinks: 0,
      },
    ];
  }

  private async syllabusCopy(request: ChangeRequest) {
    const courseId = request.courseId!;
    const copy = await this.prisma.syllabus.findUniqueOrThrow({
      where: { sourceRequestId: request.id },
      select: PUBLISHABLE_SYLLABUS_SELECT,
    });
    const targets = await newestVersionsContainingCourse(this.prisma, courseId);
    const affected: FinalApprovalProgramDto[] = [];
    for (const target of targets) {
      affected.push({
        programId: target.programId,
        programCode: target.program.programCode,
        baseVersionId: target.id,
        baseVersionNumber: target.versionNumber,
        nextVersionNumber: await this.nextNumber(
          target.programId,
          target.versionNumber,
          VERSION_BUMP.MINOR,
        ),
        consistencyIssues: [],
        syllabusIssues: [],
        droppedCloLinks: await countDroppedLinks(
          this.prisma,
          target.id,
          courseId,
          copy.id,
        ),
      });
    }
    return { affected, copyIssues: syllabusPublishIssues(copy) };
  }

  private async nextNumber(
    programId: string,
    baseNumber: string | null,
    bump: VersionBump,
  ): Promise<string> {
    if (!baseNumber) return '';
    const held = await this.prisma.programVersion.findMany({
      where: { programId, versionNumber: { not: null } },
      select: { versionNumber: true },
    });
    return nextReleaseNumber(
      baseNumber,
      held.map((row) => row.versionNumber),
      bump,
    );
  }
}
