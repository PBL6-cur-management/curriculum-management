import type {
  ApprovalAction,
  ApprovalStepKind,
  OverrideAction,
} from '../api/changeRequests';

export const STEP_KIND_LABELS: Record<ApprovalStepKind, string> = {
  NORMAL: '',
  SKIPPED: 'Bỏ qua',
  OVERRIDE: 'Phòng Đào tạo duyệt thay',
  DELEGATED: 'Được ủy quyền',
};

export const OVERRIDE_ACTION_LABELS: Record<OverrideAction, string> = {
  APPROVE: 'Đồng ý thay',
  RETURN: 'Trả lại thay',
  REJECT: 'Từ chối thay',
};

export const DECISION_TITLES = {
  RETURN: 'Trả lại đề xuất',
  REJECT: 'Từ chối đề xuất',
} as const;

export const STEP_COLORS: Record<ApprovalAction, string> = {
  PENDING: 'default',
  APPROVE: 'success',
  RETURN: 'warning',
  REJECT: 'error',
};

export const APPROVE_CONFIRM = 'Đồng ý đề xuất này?';
export const OVERRIDE_NOTE =
  'Phòng Đào tạo quyết định thay cho người duyệt của cấp hiện tại; lịch sử ghi rõ người được thay.';
export const DEAD_STEP_LABEL = 'không còn hiệu lực';
export const NO_QUEUE = 'Không có đề xuất nào chờ bạn duyệt.';

export const FINAL_APPROVAL_BUTTON = 'Phê duyệt cuối';
export const FINAL_APPROVAL_TITLE = 'Phê duyệt cuối và ban hành';
export const FINAL_APPROVE_CONFIRM_TITLE = 'Chấp thuận và ban hành?';
export const FINAL_APPROVE_CONFIRM_BODY =
  'Đề xuất được áp dụng ngay: phiên bản mới (hoặc thay đổi danh mục) được ghi nhận cùng số quyết định và học kỳ hiệu lực. Không hoàn tác được.';
export const STALE_NOTE =
  'Dữ liệu gốc đã thay đổi sau khi đề xuất được soạn: không phê duyệt được. Trả lại đề xuất để người soạn làm lại trên dữ liệu mới.';
export const FINAL_KIND_LABELS = {
  PROGRAM_VERSION: 'Tạo phiên bản mới của chương trình',
  SYLLABUS:
    'Ban hành bản đề cương mới và phiên bản mới của mọi chương trình đang dùng học phần',
  AUTHORED:
    'Áp dụng các thay đổi học phần / quan hệ học phần (không tạo phiên bản)',
} as const;
