import { HttpStatus } from '@nestjs/common';
import type { ErrorDefinition } from '../exception/error-definition.js';
export const ELIGIBILITY_ERRORS = {
  SNAPSHOT_INCOMPLETE: {
    status: HttpStatus.CONFLICT,
    code: 'ELIGIBILITY_SNAPSHOT_INCOMPLETE',
    message:
      'Ảnh chụp khung chương trình chưa đầy đủ; chưa thể tính điều kiện đăng ký an toàn.',
  },
  DATA_INVALID: {
    status: HttpStatus.CONFLICT,
    code: 'ELIGIBILITY_DATA_INVALID',
    message:
      'Dữ liệu điều kiện đăng ký chưa hợp lệ; cần kiểm tra trước khi tính.',
  },
} as const satisfies Record<string, ErrorDefinition>;
