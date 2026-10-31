import { Injectable } from '@nestjs/common';
import {
  ApprovalAction,
  ChangeRequestStatus,
  ChangeRequestType,
  ProgramVersionStatus,
} from '../../generated/prisma/client.js';
import type { AccessContext } from '../../shared/authz/access-context.js';
import { PERMISSIONS } from '../../shared/authz/permission-codes.js';
import { ApprovalRecorder } from '../../shared/change-requests/approval-recorder.js';
import { levelOfStatus } from '../../shared/change-requests/approval-rules.js';
import {
  APPROVAL_LEVEL,
  PENDING_STATUSES,
} from '../../shared/change-requests/approval.constants.js';
import { AUTHORED_ENTITY } from '../../shared/change-requests/authored-item.types.js';
import {
  WORKSPACE_KIND,
  workspaceKindFor,
} from '../../shared/change-requests/request-kinds.js';
import { StaleChecker } from '../../shared/change-requests/stale-checker.js';
import { AppException } from '../../shared/exception/app.exception.js';
import { PrismaService } from '../../shared/prisma/prisma.service.js';
import { toSemesterDto } from '../../shared/releases/semester.dto.js';
import { toIsoDay, todayDate } from '../../shared/time/today.js';
import { CHANGE_REQUEST_ERRORS } from './change-request-feature.errors.js';
import {
  DOCUMENT_INCLUDE,
  REQUEST_SUMMARY_SELECT,
  STEP_INCLUDE,
  toAuthoredItemDto,
  toDocumentDto,
  toStepDto,
  toSummaryDto,
  type RequestSummaryRow,
} from './change-request.mapper.js';
import type {
  ChangeRequestDetailDto,
  RequestActionsDto,
  RequestReleaseDto,
  RequestWorkspaceDto,
} from './change-request-response.dto.js';
import { UPLOAD_STATUSES } from './change-request.constants.js';
import { ConflictFinder } from './conflict-finder.js';
import { targetKey } from './request-target.resolver.js';
import { visibleOrDelegatedWhere } from './request-visibility.js';

const NO_NUMBER = 'chưa đánh số';
// These end at level 3 with the plain Đồng ý; every other type is released on MH-43.
const NO_FINAL_APPROVAL: readonly ChangeRequestType[] = [
  ChangeRequestType.ORGANIZATION,
];
const AUTHORED_ENTITIES: string[] = Object.values(AUTHORED_ENTITY);

// Everything the edit page and the detail page show about one request, as the caller may see it.
@Injectable()
export class ChangeRequestDetailReader {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stale: StaleChecker,
    private readonly conflicts: ConflictFinder,
    private readonly recorder: ApprovalRecorder,
  ) {}

  async read(
    id: string,
    access: AccessContext,
  ): Promise<ChangeRequestDetailDto> {
    const row = await this.prisma.changeRequest.findFirst({
      where: { id, ...(await visibleOrDelegatedWhere(this.prisma, access)) },
      select: {
        ...REQUEST_SUMMARY_SELECT,
        documents: {
          include: DOCUMENT_INCLUDE,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        },
        steps: {
          include: STEP_INCLUDE,
          orderBy: [
            { approvalLevel: 'asc' },
            { createdAt: 'asc' },
            { id: 'asc' },
          ],
        },
        items: {
          where: { entityType: { in: AUTHORED_ENTITIES } },
          orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        },
        decisionNumber: true,
        signedDate: true,
        pastSemesterAllowed: true,
        effectiveSemester: true,
        originatedVersions: {
          select: {
            id: true,
            programId: true,
            versionNumber: true,
            status: true,
            program: { select: { programCode: true } },
          },
          orderBy: { program: { programCode: 'asc' } },
        },
        programCopy: {
          select: {
            id: true,
            baseVersion: { select: { versionNumber: true } },
          },
        },
        syllabusCopy: {
          select: {
            id: true,
            baseRevision: { select: { revisionNumber: true } },
          },
        },
      },
    });
    if (!row) {
      throw new AppException(CHANGE_REQUEST_ERRORS.REQUEST_NOT_FOUND);
    }
    const isCreator = row.createdById === access.userId;
    const isDraft = row.status === ChangeRequestStatus.DRAFT;
    const steps = row.steps.filter(
      (step) => step.submissionRound === row.submissionRound,
    );
    return Object.assign(toSummaryDto(row), {
      reason: row.reason,
      basisDocumentNumber: row.basisDocumentNumber,
      workspace: await this.workspace(row),
      authoredItems: row.items.map(toAuthoredItemDto),
      documents: row.documents.map((document) =>
        toDocumentDto(document, isCreator && isDraft),
      ),
      steps: steps.map(toStepDto),
      conflicts: await this.conflicts.find(targetKey(toKey(row)), access, id),
      permissions: await this.actions(row, access, steps),
      release: toReleaseDto(row),
    });
  }

  private async workspace(
    row: RequestSummaryRow & {
      programCopy: {
        id: string;
        baseVersion: { versionNumber: string | null } | null;
      } | null;
      syllabusCopy: {
        id: string;
        baseRevision: { revisionNumber: number | null } | null;
      } | null;
    },
  ): Promise<RequestWorkspaceDto | null> {
    const kind = workspaceKindFor(row.requestType, row.targetType);
    if (!kind) return null;
    // Only a Draft can be rebased, so only a Draft reports staleness here; later checks belong to approval.
    const isStale =
      row.status === ChangeRequestStatus.DRAFT
        ? await this.stale.isStale(this.prisma, row)
        : false;
    if (kind === WORKSPACE_KIND.PROGRAM_VERSION && row.programCopy) {
      return {
        kind,
        copyId: row.programCopy.id,
        programId: row.programId,
        courseId: null,
        baseLabel: `Phiên bản ${row.programCopy.baseVersion?.versionNumber ?? NO_NUMBER}`,
        isStale,
      };
    }
    if (kind === WORKSPACE_KIND.SYLLABUS && row.syllabusCopy) {
      return {
        kind,
        copyId: row.syllabusCopy.id,
        programId: null,
        courseId: row.courseId,
        baseLabel: `Đề cương bản ${row.syllabusCopy.baseRevision?.revisionNumber ?? NO_NUMBER}`,
        isStale,
      };
    }
    return null;
  }

  private async actions(
    row: RequestSummaryRow,
    access: AccessContext,
    steps: readonly { action: ApprovalAction; isSkipped: boolean }[],
  ): Promise<RequestActionsDto> {
    const isCreator = row.createdById === access.userId;
    const isDraft = row.status === ChangeRequestStatus.DRAFT;
    const canCreate = access.has(
      row.requestType === ChangeRequestType.ORGANIZATION
        ? PERMISSIONS.CHANGE_REQUEST_CREATE_ORGANIZATIONAL
        : PERMISSIONS.CHANGE_REQUEST_CREATE,
    );
    const approved = steps.some(
      (step) => step.action === ApprovalAction.APPROVE && !step.isSkipped,
    );
    const pending = PENDING_STATUSES.includes(row.status);
    const canEdit = isCreator && isDraft && canCreate;
    const level = levelOfStatus(row.status);
    const decides = await this.canDecide(row, access.userId);
    // A data request at level 3 is approved on F-15's final-approval form, not here.
    const approvesHere =
      level !== APPROVAL_LEVEL.ACADEMIC_OFFICE ||
      row.requestType === ChangeRequestType.ORGANIZATION;
    return {
      canEdit,
      canDelete: canEdit && row.submissionRound === 0,
      canSubmit: canEdit,
      canWithdraw:
        isCreator &&
        (pending || (isDraft && row.submissionRound > 0)) &&
        !approved,
      canUpload: isCreator && UPLOAD_STATUSES.includes(row.status),
      canApprove: decides && approvesHere,
      canFinalApprove:
        decides &&
        level === APPROVAL_LEVEL.ACADEMIC_OFFICE &&
        !NO_FINAL_APPROVAL.includes(row.requestType),
      canReturn: decides,
      canReject: decides,
      canOverride:
        access.has(PERMISSIONS.CHANGE_REQUEST_OVERRIDE) &&
        (level === APPROVAL_LEVEL.COORDINATOR ||
          level === APPROVAL_LEVEL.DIRECTOR) &&
        !isCreator,
      canComment: access.has(PERMISSIONS.CHANGE_REQUEST_COMMENT),
    };
  }

  private async canDecide(
    row: RequestSummaryRow,
    userId: string,
  ): Promise<boolean> {
    if (!PENDING_STATUSES.includes(row.status)) return false;
    const rows = await this.recorder.actionableRows(
      this.prisma,
      row,
      userId,
      todayDate(),
    );
    return rows.length > 0;
  }
}

function toReleaseDto(row: {
  decisionNumber: string | null;
  signedDate: Date | null;
  pastSemesterAllowed: boolean;
  effectiveSemester: Parameters<typeof toSemesterDto>[0] | null;
  originatedVersions: {
    id: string;
    programId: string;
    versionNumber: string | null;
    status: ProgramVersionStatus;
    program: { programCode: string };
  }[];
}): RequestReleaseDto | null {
  if (row.decisionNumber === null || row.signedDate === null) return null;
  return {
    decisionNumber: row.decisionNumber,
    signedDate: toIsoDay(row.signedDate),
    effectiveSemester: row.effectiveSemester
      ? toSemesterDto(row.effectiveSemester)
      : null,
    pastSemesterAllowed: row.pastSemesterAllowed,
    versions: row.originatedVersions.map((version) => ({
      id: version.id,
      programId: version.programId,
      programCode: version.program.programCode,
      versionNumber: version.versionNumber,
      status: version.status,
    })),
  };
}

function toKey(row: RequestSummaryRow) {
  return { targetType: row.targetType, id: targetId(row) };
}

function targetId(row: RequestSummaryRow): string {
  return row.courseId ?? row.programId ?? row.subjectGroupId!;
}
