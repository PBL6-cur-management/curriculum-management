import type {
  AcademicResult,
  StudentEnrollment,
  StudentSummary,
} from '../api/students';

export const STUDENT_SEARCH_DEBOUNCE_MS = 300;
export const STUDENT_BASIS_MAX_LENGTH = 1000;
export const STUDENT_STATUS_LABELS = {
  STUDYING: 'Đang học',
  ON_LEAVE: 'Bảo lưu',
  WITHDRAWN: 'Thôi học',
  GRADUATED: 'Đã tốt nghiệp',
} satisfies Record<StudentSummary['status'], string>;
export const STUDENT_STATUS_COLORS = {
  STUDYING: 'success',
  ON_LEAVE: 'warning',
  WITHDRAWN: 'default',
  GRADUATED: 'blue',
} satisfies Record<StudentSummary['status'], string>;
export const STUDENT_SOURCE_LABELS = {
  EXCEL: 'Excel',
  SCHOOL_DB: 'Cơ sở dữ liệu Trường',
} satisfies Record<StudentSummary['dataSource'], string>;
export const ENROLLMENT_STATUS_LABELS = {
  ACTIVE: 'Đang áp dụng',
  TRANSFERRED: 'Đã chuyển chương trình',
  ENDED: 'Đã kết thúc',
} satisfies Record<StudentEnrollment['status'], string>;
export const ENROLLMENT_STATUS_COLORS = {
  ACTIVE: 'success',
  TRANSFERRED: 'blue',
  ENDED: 'default',
} satisfies Record<StudentEnrollment['status'], string>;
export const ENROLLMENT_TYPE_LABELS = {
  PRIMARY: 'Chương trình chính',
  SECOND_MAJOR: 'Song ngành',
} satisfies Record<StudentEnrollment['enrollmentType'], string>;
export const RESULT_STATUS_LABELS = {
  PASSED: 'Đạt',
  FAILED: 'Không đạt',
  IN_PROGRESS: 'Đang học',
  EXEMPT: 'Miễn',
} satisfies Record<AcademicResult['status'], string>;
export const RESULT_STATUS_COLORS = {
  PASSED: 'success',
  FAILED: 'error',
  IN_PROGRESS: 'processing',
  EXEMPT: 'default',
} satisfies Record<AcademicResult['status'], string>;
export const ENROLLMENT_OPERATION_LABELS = {
  ASSIGN_EXCEPTION: 'Gán chương trình ngoại lệ',
  TRANSFER: 'Chuyển chương trình',
  ADD_SECOND_MAJOR: 'Thêm song ngành',
} as const;
