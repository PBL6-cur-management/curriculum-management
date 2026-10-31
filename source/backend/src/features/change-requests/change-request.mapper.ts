import {
  ChangeRequestStatus,
  ChangeTargetType,
  type Prisma,
} from '../../generated/prisma/client.js';
import { stepKind } from '../../shared/change-requests/approval-rules.js';
import {
  APPROVAL_LEVEL_NAMES,
  type ApprovalLevel,
} from '../../shared/change-requests/approval.constants.js';
import { USER_REF_SELECT } from '../../shared/dtos/ref.dto.js';
import { daysSince } from '../../shared/time/days-since.js';
import type {
  ApprovalStepDto,
  AuthoredItemDto,
  ChangeRequestDocumentDto,
  ChangeRequestSummaryDto,
  ConflictDto,
  RequestTargetDto,
} from './change-request-response.dto.js';

export const REQUEST_SUMMARY_SELECT = {
  id: true,
  requestCode: true,
  requestType: true,
  targetType: true,
  targetCode: true,
  title: true,
  reason: true,
  status: true,
  origin: true,
  basisDocumentNumber: true,
  submissionRound: true,
  levelEnteredAt: true,
  createdById: true,
  courseId: true,
  programId: true,
  subjectGroupId: true,
  createdAt: true,
  updatedAt: true,
  createdBy: { select: USER_REF_SELECT },
  course: { select: { id: true, courseCode: true, courseName: true } },
  program: {
    select: {
      id: true,
      programCode: true,
      versions: {
        where: { sourceRequestId: null },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 1,
        select: { programName: true },
      },
    },
  },
  subjectGroup: { select: { id: true, groupCode: true, groupName: true } },
} as const satisfies Prisma.ChangeRequestSelect;
export type RequestSummaryRow = Prisma.ChangeRequestGetPayload<{
  select: typeof REQUEST_SUMMARY_SELECT;
}>;

export function toTargetDto(row: RequestSummaryRow): RequestTargetDto {
  switch (row.targetType) {
    case ChangeTargetType.COURSE:
      return {
        targetType: row.targetType,
        id: row.course!.id,
        code: row.course!.courseCode,
        name: row.course!.courseName,
      };
    case ChangeTargetType.PROGRAM:
      return {
        targetType: row.targetType,
        id: row.program!.id,
        code: row.program!.programCode,
        name: row.program!.versions[0]?.programName ?? row.program!.programCode,
      };
    case ChangeTargetType.SUBJECT_GROUP:
      return {
        targetType: row.targetType,
        id: row.subjectGroup!.id,
        code: row.subjectGroup!.groupCode,
        name: row.subjectGroup!.groupName,
      };
  }
}

export function toSummaryDto(row: RequestSummaryRow): ChangeRequestSummaryDto {
  return {
    id: row.id,
    requestCode: row.requestCode,
    requestType: row.requestType,
    target: toTargetDto(row),
    title: row.title,
    status: row.status,
    origin: row.origin,
    submissionRound: row.submissionRound,
    levelEnteredAt: row.levelEnteredAt?.toISOString() ?? null,
    daysWaiting: row.levelEnteredAt ? daysSince(row.levelEnteredAt) : null,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toConflictDto(row: {
  id: string;
  requestCode: string;
  title: string;
  status: ChangeRequestStatus;
  createdBy: { id: string; fullName: string };
}): ConflictDto {
  return {
    id: row.id,
    requestCode: row.requestCode,
    title: row.title,
    status: row.status,
    createdBy: row.createdBy,
  };
}

export const DOCUMENT_INCLUDE = {
  uploadedBy: { select: USER_REF_SELECT },
} as const satisfies Prisma.ChangeRequestDocumentInclude;
export type DocumentRow = Prisma.ChangeRequestDocumentGetPayload<{
  include: typeof DOCUMENT_INCLUDE;
}>;

// canRemove: the creator, while the request is a Draft and no approver has seen the file (US-056 AC3).
export function toDocumentDto(
  row: DocumentRow,
  canRemove: boolean,
): ChangeRequestDocumentDto {
  return {
    id: row.id,
    documentType: row.documentType,
    fileName: row.fileName,
    fileType: row.fileType,
    sizeBytes: row.sizeBytes,
    uploadedBy: row.uploadedBy,
    createdAt: row.createdAt.toISOString(),
    seenInRound: row.seenInRound,
    canRemove: canRemove && row.seenInRound === null,
  };
}

export const STEP_INCLUDE = {
  approver: { select: USER_REF_SELECT },
  performedBy: { select: USER_REF_SELECT },
  forSubjectGroup: {
    select: { id: true, groupCode: true, groupName: true },
  },
  forProgram: { select: { id: true, programCode: true } },
  delegation: {
    select: { id: true, delegator: { select: USER_REF_SELECT } },
  },
} as const satisfies Prisma.ApprovalStepInclude;
export type StepRow = Prisma.ApprovalStepGetPayload<{
  include: typeof STEP_INCLUDE;
}>;

export function toStepDto(row: StepRow): ApprovalStepDto {
  return {
    id: row.id,
    approvalLevel: row.approvalLevel,
    levelName: APPROVAL_LEVEL_NAMES[row.approvalLevel as ApprovalLevel],
    approver: row.approver,
    forSubjectGroup: row.forSubjectGroup,
    forProgram: row.forProgram,
    action: row.action,
    isSkipped: row.isSkipped,
    skipReason: row.skipReason,
    remark: row.remark,
    recordedAt: row.recordedAt?.toISOString() ?? null,
    performedBy: row.performedBy,
    isOverride: row.isOverride,
    kind: stepKind(row),
    delegation: row.delegation,
  };
}

export function toAuthoredItemDto(row: {
  id: string;
  entityType: string;
  itemKey: string;
  label: string;
  oldValue: Prisma.JsonValue | null;
  newValue: Prisma.JsonValue | null;
}): AuthoredItemDto {
  return {
    id: row.id,
    entityType: row.entityType,
    itemKey: row.itemKey,
    label: row.label,
    oldValue: row.oldValue,
    newValue: row.newValue,
  };
}
