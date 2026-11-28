import { HttpStatus } from '@nestjs/common';
import type { ErrorDefinition } from '../../shared/exception/error-definition.js';

export const APPROVAL_FEATURE_ERRORS = {
  FINAL_APPROVAL_REQUIRED: {
    status: HttpStatus.CONFLICT,
    code: 'FINAL_APPROVAL_REQUIRED',
    message:
      'Phê duyệt cuối cấp Phòng Đào tạo cần số quyết định và học kỳ hiệu lực; dùng màn hình ban hành.',
  },
  FINAL_APPROVAL_NOT_APPLICABLE: {
    status: HttpStatus.CONFLICT,
    code: 'FINAL_APPROVAL_NOT_APPLICABLE',
    message:
      'Loại đề xuất này không ban hành phiên bản; duyệt bằng nút Đồng ý.',
  },
  ORGANIZATION_APPLY_FAILED: {
    status: HttpStatus.CONFLICT,
    code: 'ORGANIZATION_APPLY_FAILED',
    message: 'Không áp dụng được thay đổi tổ chức; đề xuất vẫn chờ duyệt.',
  },
  OVERRIDE_LEVEL: {
    status: HttpStatus.CONFLICT,
    code: 'OVERRIDE_LEVEL',
    message:
      'Chỉ duyệt thay được khi đề xuất đang chờ cấp Điều phối, Giám đốc CTĐT hoặc Ban lãnh đạo khoa.',
  },
} as const satisfies Record<string, ErrorDefinition>;
