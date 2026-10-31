import type {
  ApprovalStep,
  ChangeRequestDetail,
  ChangeRequestSummary,
  Conflict,
} from './api/changeRequests';

export const ME = {
  id: 'u1',
  username: 'giangvien',
  userCode: 'GV',
  fullName: 'Giảng viên A',
  email: null,
  mustChangePassword: false,
  orgUnit: null,
  roles: [],
  permissions: [
    'changeRequest.view',
    'changeRequest.create',
    'syllabus.edit',
    'curriculum.edit',
    'plo.edit',
    'course.edit',
    'program.editInfo',
    'subjectGroup.view',
  ],
};

export const ACTIONS: ChangeRequestDetail['permissions'] = {
  canEdit: true,
  canDelete: true,
  canSubmit: true,
  canWithdraw: false,
  canUpload: true,
  canApprove: false,
  canFinalApprove: false,
  canReturn: false,
  canReject: false,
  canOverride: false,
  canComment: true,
};

export function summary(
  patch: Partial<ChangeRequestSummary> = {},
): ChangeRequestSummary {
  return {
    id: 'r1',
    requestCode: 'DX-2026-0001',
    requestType: 'SYLLABUS_CONTENT',
    target: { targetType: 'COURSE', id: 'c1', code: 'IT001', name: 'Nhập môn' },
    title: 'Cập nhật mục tiêu',
    status: 'DRAFT',
    origin: 'FACULTY',
    submissionRound: 0,
    levelEnteredAt: null,
    daysWaiting: null,
    createdBy: { id: 'u1', fullName: 'Giảng viên A' },
    createdAt: '2026-10-19T03:00:00.000Z',
    updatedAt: '2026-10-19T04:00:00.000Z',
    ...patch,
  };
}

export function detail(
  patch: Partial<ChangeRequestDetail> = {},
): ChangeRequestDetail {
  return {
    ...summary(),
    reason: 'Chuẩn hóa mục tiêu học phần',
    basisDocumentNumber: null,
    workspace: {
      kind: 'SYLLABUS',
      copyId: 's9',
      programId: null,
      courseId: 'c1',
      baseLabel: 'Đề cương bản 3',
      isStale: false,
    },
    authoredItems: [],
    documents: [],
    steps: [],
    conflicts: [],
    permissions: ACTIONS,
    release: null,
    ...patch,
  };
}

export function step(
  id: string,
  approvalLevel: 1 | 2 | 3,
  patch: Partial<ApprovalStep> = {},
): ApprovalStep {
  return {
    id,
    approvalLevel,
    levelName: ['Điều phối nhóm chuyên môn', 'Giám đốc CTĐT', 'Phòng Đào tạo'][
      approvalLevel - 1
    ],
    approver: { id: `a${id}`, fullName: `Người duyệt ${id}` },
    forSubjectGroup: null,
    forProgram: null,
    action: 'PENDING',
    isSkipped: false,
    skipReason: null,
    remark: null,
    recordedAt: null,
    performedBy: null,
    isOverride: false,
    kind: 'NORMAL',
    delegation: null,
    ...patch,
  };
}

export function conflict(patch: Partial<Conflict> = {}): Conflict {
  return {
    id: 'r0',
    requestCode: 'DX-2026-0000',
    title: 'Đề xuất trước',
    status: 'PENDING_COORDINATOR',
    createdBy: { id: 'u2', fullName: 'Giảng viên B' },
    ...patch,
  };
}
