import {
  FunctionGroup,
  PermissionMode,
  PermissionScope,
} from '../../src/generated/prisma/client.js';
import {
  PERMISSIONS,
  type PermissionCode,
} from '../../src/shared/authz/permission-codes.js';
import type { RoleCode } from './roles.js';
import { LOCKED_CELLS } from '../../src/shared/authz/locked-cells.js';

export const CELL = { X: 'X', P: 'P', D: 'D', DP: 'DP' } as const;
type Cell = (typeof CELL)[keyof typeof CELL];

export const CELL_MEANING: Record<
  Cell,
  { mode: PermissionMode; scope: PermissionScope }
> = {
  X: { mode: PermissionMode.DIRECT, scope: PermissionScope.ALL },
  P: { mode: PermissionMode.DIRECT, scope: PermissionScope.SCOPED },
  D: { mode: PermissionMode.VIA_REQUEST, scope: PermissionScope.ALL },
  DP: { mode: PermissionMode.VIA_REQUEST, scope: PermissionScope.SCOPED },
};

export interface PermissionSeed {
  code: PermissionCode;
  name: string;
  group: FunctionGroup;
  source: string;
  cells: Partial<Record<RoleCode, Cell>>;
}

const { X, P, D, DP } = CELL;
const ALL_STAFF_VIEW = { R1: X, R2: X, R3: X, R4: X, R5: X } as const;
const SCOPED_EDIT = { R1: X, R3: DP, R4: DP, R5: DP } as const;

export const PERMISSION_CATALOG: readonly PermissionSeed[] = [
  {
    code: PERMISSIONS.ORG_UNIT_MANAGE,
    name: 'Quản lý đơn vị, nhóm chuyên môn',
    group: FunctionGroup.SYSTEM_ADMIN,
    source: '3.4',
    cells: { R1: X },
  },
  {
    code: PERMISSIONS.SUBJECT_GROUP_VIEW,
    name: 'Xem nhóm chuyên môn và thành viên',
    group: FunctionGroup.SYSTEM_ADMIN,
    source: 'G-2',
    cells: { R1: X, R2: P, R4: P },
  },
  {
    code: PERMISSIONS.USER_MANAGE,
    name: 'Quản lý người dùng, gán vai trò',
    group: FunctionGroup.SYSTEM_ADMIN,
    source: '3.4',
    cells: { R1: X },
  },
  {
    code: PERMISSIONS.PERMISSION_VIEW,
    name: 'Xem ma trận quyền',
    group: FunctionGroup.SYSTEM_ADMIN,
    source: 'M-10',
    cells: { R1: X },
  },
  {
    code: PERMISSIONS.PERMISSION_MANAGE,
    name: 'Sửa ma trận quyền của vai trò có sẵn',
    group: FunctionGroup.SYSTEM_ADMIN,
    source: 'F02-02',
    cells: { R1: X },
  },
  {
    code: PERMISSIONS.DIRECTOR_ASSIGN,
    name: 'Phân công Giám đốc CTĐT',
    group: FunctionGroup.SYSTEM_ADMIN,
    source: '3.4',
    cells: { R1: X },
  },
  {
    code: PERMISSIONS.DELEGATION_MANAGE,
    name: 'Ủy quyền phê duyệt',
    group: FunctionGroup.SYSTEM_ADMIN,
    source: 'FR-09, US-114',
    cells: { R1: X, R3: P, R4: P },
  },
  {
    code: PERMISSIONS.INTEGRATION_CLIENT_MANAGE,
    name: 'Quản lý bên tích hợp và khóa truy cập',
    group: FunctionGroup.SYSTEM_ADMIN,
    source: 'FR-94, US-098',
    cells: { R1: X },
  },
  {
    code: PERMISSIONS.SYNC_CONFIGURE,
    name: 'Cấu hình kết nối và lịch đồng bộ, xem nhật ký đồng bộ',
    group: FunctionGroup.SYSTEM_ADMIN,
    source: 'FR-98, FR-99, FR-100, US-102',
    cells: { R1: X },
  },
  {
    code: PERMISSIONS.BACKUP_VIEW,
    name: 'Xem sao lưu và diễn tập phục hồi',
    group: FunctionGroup.SYSTEM_ADMIN,
    source: 'NFR-12, NFR-13, NFR-14, F26-01..03',
    cells: { R1: X },
  },
  {
    code: PERMISSIONS.AUDIT_LOG_VIEW,
    name: 'Xem nhật ký hệ thống',
    group: FunctionGroup.SYSTEM_ADMIN,
    source: '3.4',
    cells: { R1: X, R2: X },
  },
  {
    code: PERMISSIONS.COURSE_VIEW,
    name: 'Xem danh mục học phần',
    group: FunctionGroup.COURSE_CATALOG,
    source: '3.4',
    cells: { ...ALL_STAFF_VIEW, R6: X },
  },
  {
    code: PERMISSIONS.COURSE_EDIT,
    name: 'Thêm/sửa học phần',
    group: FunctionGroup.COURSE_CATALOG,
    source: '3.4, U-1',
    cells: { R1: X, R3: D, R4: DP, R5: DP },
  },
  {
    code: PERMISSIONS.COURSE_RELATION_EDIT,
    name: 'Khai báo quan hệ học phần, nhóm tương đương',
    group: FunctionGroup.COURSE_CATALOG,
    source: '3.4, U-1',
    cells: { R1: X, R3: D, R4: DP, R5: DP },
  },
  {
    code: PERMISSIONS.PROGRAM_VIEW,
    name: 'Xem CTĐT',
    group: FunctionGroup.PROGRAM,
    source: '3.4, G-8',
    cells: { ...ALL_STAFF_VIEW, R6: P },
  },
  {
    code: PERMISSIONS.PROGRAM_EDIT_INFO,
    name: 'Sửa thông tin CTĐT',
    group: FunctionGroup.PROGRAM,
    source: '3.4',
    cells: { R1: X, R3: P },
  },
  {
    code: PERMISSIONS.PROGRAM_CLONE,
    name: 'Nhân bản CTĐT',
    group: FunctionGroup.PROGRAM,
    source: 'FR-25, US-022',
    cells: { R1: X },
  },
  {
    code: PERMISSIONS.CURRICULUM_EDIT,
    name: 'Sửa khung chương trình',
    group: FunctionGroup.PROGRAM,
    source: '3.4',
    cells: { R1: X, R3: DP, R4: DP, R5: DP },
  },
  {
    code: PERMISSIONS.CURRICULUM_IMPORT_EXPORT_EXCEL,
    name: 'Nhập/xuất Excel khung chương trình',
    group: FunctionGroup.PROGRAM,
    source: '3.4',
    cells: { R1: X, R3: P },
  },
  {
    code: PERMISSIONS.VERSION_ASSIGN_COHORT,
    name: 'Gán phiên bản cho khóa tuyển sinh',
    group: FunctionGroup.PROGRAM,
    source: 'FR-74, US-080',
    cells: { R1: X },
  },
  {
    code: PERMISSIONS.OUTCOME_VIEW,
    name: 'Xem PLO/CLO',
    group: FunctionGroup.LEARNING_OUTCOME,
    source: '3.4, G-3',
    cells: { ...ALL_STAFF_VIEW, R6: P },
  },
  {
    code: PERMISSIONS.PLO_EDIT,
    name: 'Sửa PLO',
    group: FunctionGroup.LEARNING_OUTCOME,
    source: '3.4',
    cells: { R1: X, R3: DP },
  },
  {
    code: PERMISSIONS.CLO_EDIT,
    name: 'Sửa CLO, ma trận CLO–PLO',
    group: FunctionGroup.LEARNING_OUTCOME,
    source: '3.4, U-1',
    cells: SCOPED_EDIT,
  },
  {
    code: PERMISSIONS.SYLLABUS_VIEW,
    name: 'Xem đề cương',
    group: FunctionGroup.SYLLABUS,
    source: '3.4, G-8',
    cells: { ...ALL_STAFF_VIEW, R6: X },
  },
  {
    code: PERMISSIONS.SYLLABUS_EDIT,
    name: 'Sửa nội dung đề cương',
    group: FunctionGroup.SYLLABUS,
    source: '3.4, U-1',
    cells: SCOPED_EDIT,
  },
  {
    code: PERMISSIONS.GRADING_FORMULA_EDIT,
    name: 'Sửa công thức điểm',
    group: FunctionGroup.SYLLABUS,
    source: '3.4, U-1',
    cells: SCOPED_EDIT,
  },
  {
    code: PERMISSIONS.CHANGE_REQUEST_VIEW,
    name: 'Xem đề xuất và lịch sử duyệt',
    group: FunctionGroup.APPROVAL,
    source: 'FR-62, FR-65',
    cells: { R1: X, R2: P, R3: P, R4: P, R5: P },
  },
  {
    code: PERMISSIONS.CHANGE_REQUEST_CREATE,
    name: 'Tạo đề xuất thay đổi dữ liệu đào tạo',
    group: FunctionGroup.APPROVAL,
    source: '3.4',
    cells: { R1: X, R3: X, R4: X, R5: X },
  },
  {
    code: PERMISSIONS.CHANGE_REQUEST_CREATE_ORGANIZATIONAL,
    name: 'Tạo đề xuất thay đổi tổ chức / phân công',
    group: FunctionGroup.APPROVAL,
    source: 'S-1, E-4',
    cells: { R2: P, R4: P },
  },
  {
    code: PERMISSIONS.CHANGE_REQUEST_OVERRIDE,
    name: 'Duyệt thay ở cấp 1 và 2',
    group: FunctionGroup.APPROVAL,
    source: '3.4, BR-31',
    cells: { R1: X },
  },
  {
    code: PERMISSIONS.CHANGE_REQUEST_COMMENT,
    name: 'Bình luận trên đề xuất',
    group: FunctionGroup.APPROVAL,
    source: '3.4',
    cells: ALL_STAFF_VIEW,
  },
  {
    code: PERMISSIONS.CHANGE_REQUEST_STATISTICS,
    name: 'Thống kê đề xuất',
    group: FunctionGroup.APPROVAL,
    source: 'FR-107, US-109',
    cells: { R1: X, R2: X, R3: P, R4: P },
  },
  {
    code: PERMISSIONS.VERSION_PUBLISH,
    name: 'Ban hành phiên bản',
    group: FunctionGroup.VERSION,
    source: '3.4',
    cells: { R1: X },
  },
  {
    code: PERMISSIONS.VERSION_CORRECT,
    name: 'Đính chính phiên bản đã ban hành',
    group: FunctionGroup.VERSION,
    source: 'US-076, MH-49',
    cells: { R1: X },
  },
  {
    code: PERMISSIONS.VERSION_VIEW_HISTORY,
    name: 'Xem lịch sử phiên bản',
    group: FunctionGroup.VERSION,
    source: '3.4',
    cells: ALL_STAFF_VIEW,
  },
  {
    code: PERMISSIONS.VERSION_COMPARE,
    name: 'So sánh hai phiên bản',
    group: FunctionGroup.VERSION,
    source: '3.4',
    cells: ALL_STAFF_VIEW,
  },
  {
    code: PERMISSIONS.SEMESTER_MANAGE,
    name: 'Quản lý học kỳ và khóa tuyển sinh',
    group: FunctionGroup.VERSION,
    source: 'US-071, MH-10',
    cells: { R1: X },
  },
  {
    code: PERMISSIONS.DATA_IMPORT_EXCEL,
    name: 'Nhập dữ liệu từ Excel',
    group: FunctionGroup.DATA_REPORT,
    source: '3.4',
    cells: { R1: X, R3: P },
  },
  {
    code: PERMISSIONS.REPORT_EXPORT_ACCREDITATION,
    name: 'Xuất báo cáo kiểm định',
    group: FunctionGroup.DATA_REPORT,
    source: '3.4',
    cells: { R1: X, R2: X, R3: P },
  },
  {
    code: PERMISSIONS.REPORT_BENCHMARK,
    name: 'Đối sánh chương trình, phân bổ tín chỉ',
    group: FunctionGroup.DATA_REPORT,
    source: 'FR-102, FR-103, US-105',
    cells: { R1: X, R2: X, R3: X, R4: X },
  },
  {
    code: PERMISSIONS.STUDENT_VIEW_PROGRESS,
    name: 'Xem tiến độ học tập',
    group: FunctionGroup.STUDENT_LOOKUP,
    source: '3.4, L-10',
    cells: { R1: X, R3: P, R6: P },
  },
  {
    code: PERMISSIONS.STUDENT_VIEW_REGISTRATION_ELIGIBILITY,
    name: 'Xem điều kiện đăng ký học phần',
    group: FunctionGroup.STUDENT_LOOKUP,
    source: '3.4, L-10',
    cells: { R1: X, R3: P, R6: P },
  },
  {
    code: PERMISSIONS.GRADUATION_VIEW,
    name: 'Xem kết quả xét tốt nghiệp',
    group: FunctionGroup.STUDENT_LOOKUP,
    source: '3.4, L-10',
    cells: { R1: X, R3: P, R6: P },
  },
  {
    code: PERMISSIONS.GRADUATION_AUDIT,
    name: 'Xét tốt nghiệp một sinh viên hoặc theo lô',
    group: FunctionGroup.STUDENT_LOOKUP,
    source: 'FR-84, FR-87, US-087, US-090',
    cells: { R1: X, R3: P },
  },
];

export { LOCKED_CELLS };
