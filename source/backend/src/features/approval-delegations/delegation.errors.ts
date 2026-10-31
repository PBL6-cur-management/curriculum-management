import { HttpStatus } from '@nestjs/common';

export const DELEGATION_ERRORS = {
  INVALID_RANGE: {
    status: HttpStatus.BAD_REQUEST,
    code: 'DELEGATION_INVALID_RANGE',
    message: 'Ngày kết thúc không được trước ngày bắt đầu.',
  },
  PAST_RANGE: {
    status: HttpStatus.BAD_REQUEST,
    code: 'DELEGATION_PAST_RANGE',
    message:
      'Ngày kết thúc đã qua; ủy quyền phải còn hiệu lực ít nhất đến hôm nay.',
  },
  SELF: {
    status: HttpStatus.BAD_REQUEST,
    code: 'DELEGATION_SELF',
    message: 'Không thể ủy quyền cho chính mình.',
  },
  OUT_OF_SCOPE: {
    status: HttpStatus.FORBIDDEN,
    code: 'DELEGATION_OUT_OF_SCOPE',
    message: 'Bạn không thể ủy quyền phần việc này.',
  },
  NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    code: 'DELEGATION_NOT_FOUND',
    message: 'Không tìm thấy ủy quyền.',
  },
  ACCOUNT_INACTIVE: {
    status: HttpStatus.CONFLICT,
    code: 'DELEGATION_ACCOUNT_INACTIVE',
    message: 'Tài khoản ủy quyền hoặc nhận ủy quyền không còn hoạt động.',
  },
  SCOPE_UNAVAILABLE: {
    status: HttpStatus.CONFLICT,
    code: 'DELEGATION_SCOPE_UNAVAILABLE',
    message:
      'Người ủy quyền không giữ cấp duyệt này; chỉ ủy quyền được cấp Điều phối nhóm chuyên môn hoặc Giám đốc CTĐT đang giữ.',
  },
} as const;
