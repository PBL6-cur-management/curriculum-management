import { HttpStatus } from '@nestjs/common';

export const INTEGRATION_ERRORS = {
  // Missing, unknown and locked keys share one answer: the response is not a key-status oracle.
  KEY_INVALID: {
    status: HttpStatus.UNAUTHORIZED,
    code: 'API_KEY_INVALID',
    message: 'Khóa API không hợp lệ hoặc đã bị khóa.',
  },
  RATE_LIMITED: {
    status: HttpStatus.TOO_MANY_REQUESTS,
    code: 'API_RATE_LIMITED',
    message: 'Vượt giới hạn số lần gọi trong một phút. Thử lại sau.',
  },
  STUDENT_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    code: 'API_STUDENT_NOT_FOUND',
    message: 'Không tìm thấy sinh viên.',
  },
  SEMESTER_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    code: 'API_SEMESTER_NOT_FOUND',
    message: 'Không tìm thấy học kỳ.',
  },
  NO_CONTEXT: {
    status: HttpStatus.CONFLICT,
    code: 'API_NO_ACADEMIC_CONTEXT',
    message:
      'Sinh viên chưa có ngành chính hoặc chưa xác định được phiên bản chương trình áp dụng trong học kỳ này.',
  },
  PROGRAM_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    code: 'API_PROGRAM_VERSION_NOT_FOUND',
    message: 'Không tìm thấy phiên bản chương trình đã ban hành.',
  },
  COURSE_NOT_IN_PROGRAM: {
    status: HttpStatus.NOT_FOUND,
    code: 'API_COURSE_NOT_IN_PROGRAM',
    message: 'Học phần không thuộc phiên bản chương trình được chọn.',
  },
  SYLLABUS_NOT_ISSUED: {
    status: HttpStatus.NOT_FOUND,
    code: 'API_SYLLABUS_NOT_ISSUED',
    message: 'Học phần chưa có đề cương đã ban hành trong phiên bản này.',
  },
  SELECTOR_REQUIRED: {
    status: HttpStatus.BAD_REQUEST,
    code: 'API_SYLLABUS_SELECTOR_REQUIRED',
    message:
      'Cần chỉ rõ sinh viên (mssv) hoặc chương trình và phiên bản (program, programVersion), không dùng cả hai.',
  },
  CLIENT_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    code: 'INTEGRATION_CLIENT_NOT_FOUND',
    message: 'Không tìm thấy bên tích hợp.',
  },
  CLIENT_NAME_TAKEN: {
    status: HttpStatus.CONFLICT,
    code: 'INTEGRATION_CLIENT_NAME_TAKEN',
    message: 'Tên bên tích hợp đã tồn tại.',
  },
} as const;
