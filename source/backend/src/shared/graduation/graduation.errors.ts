import { HttpStatus } from '@nestjs/common';
import type { ErrorDefinition } from '../exception/error-definition.js';
import { RELEASE_ERRORS } from '../releases/release.errors.js';
import { STUDENT_ERRORS } from '../students/student.errors.js';

export const GRADUATION_ERRORS = {
  APPLIED_VERSION_UNRESOLVED: STUDENT_ERRORS.APPLIED_VERSION_UNRESOLVED,
  ENROLLMENT_AMBIGUOUS: STUDENT_ERRORS.ENROLLMENT_AMBIGUOUS,
  SEMESTER_START_UNKNOWN: RELEASE_ERRORS.SEMESTER_START_UNKNOWN,
  SNAPSHOT_INCOMPLETE: {
    status: HttpStatus.CONFLICT,
    code: 'GRADUATION_SNAPSHOT_INCOMPLETE',
    message:
      'Ảnh chụp khung chương trình chưa đầy đủ; cần Phòng Đào tạo kiểm tra trước khi xét tốt nghiệp.',
  },
  INPUT_INVALID: {
    status: HttpStatus.CONFLICT,
    code: 'GRADUATION_INPUT_INVALID',
    message:
      'Dữ liệu xét tốt nghiệp không hợp lệ; cần kiểm tra học kỳ, quá trình theo học và kết quả học tập.',
  },
  EQUIVALENCE_ALLOCATION_AMBIGUOUS: {
    status: HttpStatus.CONFLICT,
    code: 'EQUIVALENCE_ALLOCATION_AMBIGUOUS',
    message:
      'Học phần tương đương cạnh tranh giữa nhiều nhóm yêu cầu; cần Khoa xác nhận cách phân bổ trước khi xét.',
  },
  EXEMPTION_POLICY_UNCONFIRMED: {
    status: HttpStatus.CONFLICT,
    code: 'EXEMPTION_POLICY_UNCONFIRMED',
    message:
      'Chưa xác nhận căn cứ tín chỉ của học phần được miễn; cần Khoa bổ sung chính sách hoặc minh chứng.',
  },
  POLICY_UNCONFIRMED: {
    status: HttpStatus.CONFLICT,
    code: 'GRADUATION_POLICY_UNCONFIRMED',
    message:
      'Điều kiện tốt nghiệp này chưa có chính sách đã xác nhận; cần Khoa làm rõ trước khi chứng nhận.',
  },
  STATE_CHANGED: {
    status: HttpStatus.CONFLICT,
    code: 'GRADUATION_STATE_CHANGED',
    message:
      'Dữ liệu xét tốt nghiệp đã thay đổi; tải lại bản xem trước và xác nhận lại.',
  },
  JOB_FAILED: {
    status: HttpStatus.SERVICE_UNAVAILABLE,
    code: 'GRADUATION_JOB_FAILED',
    message:
      'Chưa thể thực hiện tác vụ hoặc xuất kết quả xét tốt nghiệp; vui lòng thử lại sau.',
  },
  ACCESS_REVOKED: {
    status: HttpStatus.NOT_FOUND,
    code: 'GRADUATION_ACCESS_REVOKED',
    message:
      'Không tìm thấy kết quả xét tốt nghiệp trong phạm vi truy cập hiện tại; kiểm tra lại quyền được cấp.',
  },
  UNSUPPORTED_SCHEMA_VERSION: {
    status: HttpStatus.CONFLICT,
    code: 'GRADUATION_UNSUPPORTED_SCHEMA_VERSION',
    message:
      'Phiên bản kết quả xét tốt nghiệp chưa được hỗ trợ; cần cập nhật bộ đọc kết quả, không xét lại thay lịch sử.',
  },
} as const satisfies Record<string, ErrorDefinition>;
