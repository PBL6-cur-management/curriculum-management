import { HttpStatus } from '@nestjs/common';
import type { ErrorDefinition } from '../exception/error-definition.js';

export const APPLIED_VERSION_ERRORS = {
  VERSION_NOT_ISSUED: {
    status: HttpStatus.CONFLICT,
    code: 'VERSION_NOT_ISSUED',
    message: 'Chỉ chọn phiên bản đã ban hành.',
  },
  SNAPSHOT_INCOMPLETE: {
    status: HttpStatus.CONFLICT,
    code: 'VERSION_SNAPSHOT_INCOMPLETE',
    message: 'Ảnh chụp phiên bản chưa đầy đủ; không thể so sánh an toàn.',
  },
  PINNED_SYLLABUS_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    code: 'PINNED_SYLLABUS_NOT_FOUND',
    message:
      'Không tìm thấy hai bản đề cương được ghim trong các phiên bản đã chọn.',
  },
  ASSIGNMENT_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    code: 'COHORT_ASSIGNMENT_NOT_FOUND',
    message: 'Không tìm thấy dòng gán phiên bản cho khóa.',
  },
  COHORT_VERSION_EXISTS: {
    status: HttpStatus.CONFLICT,
    code: 'COHORT_VERSION_EXISTS',
    message:
      'Khóa đã có dòng áp dụng phiên bản này; hãy sửa học kỳ của dòng hiện có.',
  },
  ASSIGNMENT_START_CONFLICT: {
    status: HttpStatus.CONFLICT,
    code: 'ASSIGNMENT_START_CONFLICT',
    message:
      'Khóa đã có phiên bản bắt đầu trong học kỳ này; hãy kiểm tra các dòng áp dụng.',
  },
  ASSIGNMENT_BEFORE_VERSION: {
    status: HttpStatus.CONFLICT,
    code: 'ASSIGNMENT_BEFORE_VERSION',
    message: 'Học kỳ áp dụng không được sớm hơn học kỳ hiệu lực của phiên bản.',
  },
  ASSIGNMENT_STATE_CHANGED: {
    status: HttpStatus.CONFLICT,
    code: 'ASSIGNMENT_STATE_CHANGED',
    message:
      'Dữ liệu gán khóa hoặc lịch học kỳ đã thay đổi; tải lại và xác nhận lại.',
  },
  INVALID_COHORT_ASSIGNMENT: {
    status: HttpStatus.CONFLICT,
    code: 'INVALID_COHORT_ASSIGNMENT',
    message:
      'Dữ liệu gán khóa chưa hợp lệ; cần kiểm tra trước khi xác định phiên bản áp dụng.',
  },
} as const satisfies Record<string, ErrorDefinition>;
