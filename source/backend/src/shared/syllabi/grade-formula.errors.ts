import { HttpStatus } from '@nestjs/common';
import type { ErrorDefinition } from '../exception/error-definition.js';

export const ASSESSMENT_ERRORS = {
  WEIGHT_TOTAL_INVALID: {
    status: HttpStatus.BAD_REQUEST,
    code: 'ASSESSMENT_WEIGHT_TOTAL_INVALID',
    message: 'Tổng trọng số các thành phần đánh giá phải bằng 100%.',
  },
  COMPONENT_INVALID: {
    status: HttpStatus.BAD_REQUEST,
    code: 'ASSESSMENT_COMPONENT_INVALID',
    message: 'Thành phần đánh giá không hợp lệ; kiểm tra các trường được nêu.',
  },
  CODE_DUPLICATE: {
    status: HttpStatus.BAD_REQUEST,
    code: 'ASSESSMENT_CODE_DUPLICATE',
    message: 'Mã thành phần đánh giá bị trùng trong công thức.',
  },
  ID_INVALID: {
    status: HttpStatus.BAD_REQUEST,
    code: 'ASSESSMENT_ID_INVALID',
    message:
      'Thành phần đánh giá không thuộc bản đề cương này; tải lại trang rồi thử lại.',
  },
  CONDITION_THRESHOLD_REQUIRED: {
    status: HttpStatus.BAD_REQUEST,
    code: 'ASSESSMENT_CONDITION_THRESHOLD_REQUIRED',
    message: 'Thành phần điều kiện phải có ngưỡng điều kiện.',
  },
  MAPPING_INVALID: {
    status: HttpStatus.BAD_REQUEST,
    code: 'ASSESSMENT_MAPPING_INVALID',
    message:
      'Ánh xạ đánh giá–CLO không hợp lệ; kiểm tra thành phần, CLO và tỷ trọng.',
  },
  STALE: {
    status: HttpStatus.CONFLICT,
    code: 'ASSESSMENT_STALE',
    message:
      'Đề cương đã được thay đổi sau lần tải gần nhất; tải lại dữ liệu rồi thử lại.',
  },
  NOT_READY: {
    status: HttpStatus.CONFLICT,
    code: 'ASSESSMENT_NOT_READY',
    message:
      'Công thức điểm hoặc ánh xạ CLO chưa đủ điều kiện để gửi duyệt hoặc ban hành.',
  },
} as const satisfies Record<string, ErrorDefinition>;
