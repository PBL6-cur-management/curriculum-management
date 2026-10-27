import { HttpStatus } from '@nestjs/common';
import type { ErrorDefinition } from '../../shared/exception/error-definition.js';

export const IMPORT_ERRORS = {
  FILE_REQUIRED: {
    status: HttpStatus.BAD_REQUEST,
    code: 'IMPORT_FILE_REQUIRED',
    message: 'Chưa chọn tệp để nhập.',
  },
  FILE_NOT_XLSX: {
    status: HttpStatus.BAD_REQUEST,
    code: 'IMPORT_FILE_NOT_XLSX',
    message: 'Chỉ nhận tệp Excel (.xlsx).',
  },
  VERSION_REQUIRED: {
    status: HttpStatus.BAD_REQUEST,
    code: 'IMPORT_VERSION_REQUIRED',
    message: 'Nhập khung chương trình cần chọn phiên bản bản nháp.',
  },
  VERSION_NOT_ALLOWED: {
    status: HttpStatus.BAD_REQUEST,
    code: 'IMPORT_VERSION_NOT_ALLOWED',
    message: 'Loại dữ liệu này không gắn với phiên bản chương trình.',
  },
  TYPE_UNAVAILABLE: {
    status: HttpStatus.NOT_FOUND,
    code: 'IMPORT_TYPE_UNAVAILABLE',
    message: 'Loại dữ liệu này chưa hỗ trợ nhập.',
  },
  VERSION_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    code: 'PROGRAM_VERSION_NOT_FOUND',
    message: 'Không tìm thấy phiên bản chương trình.',
  },
  VERSION_NOT_DRAFT: {
    status: HttpStatus.CONFLICT,
    code: 'IMPORT_VERSION_NOT_DRAFT',
    message: 'Chỉ nhập vào phiên bản đang là bản nháp.',
  },
  BATCH_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    code: 'IMPORT_BATCH_NOT_FOUND',
    message: 'Không tìm thấy lần nhập.',
  },
  NOT_COMMITTABLE: {
    status: HttpStatus.CONFLICT,
    code: 'IMPORT_NOT_COMMITTABLE',
    message: 'Lần nhập này không thể ghi vào hệ thống.',
  },
  HAS_ERRORS: {
    status: HttpStatus.CONFLICT,
    code: 'IMPORT_HAS_ERRORS',
    message: 'Báo cáo còn LỖI; sửa tệp và nhập lại.',
  },
  NOT_OWNER: {
    status: HttpStatus.FORBIDDEN,
    code: 'IMPORT_NOT_OWNER',
    message: 'Chỉ người tải tệp lên mới được xác nhận ghi.',
  },
  FILE_EXPIRED: {
    status: HttpStatus.GONE,
    code: 'IMPORT_FILE_EXPIRED',
    message: 'Tệp gốc đã hết hạn lưu trữ.',
  },
} as const satisfies Record<string, ErrorDefinition>;
export const IMPORT_ABORT_MESSAGE = {
  JOB_FAILED: 'Xử lý tệp gặp sự cố; hãy nhập lại.',
  STALE: 'Lần nhập bị gián đoạn quá lâu; hãy nhập lại.',
  CHANGED_SINCE_DRY_RUN:
    'Dữ liệu đã thay đổi kể từ lần chạy thử và tệp nay có LỖI; xem báo cáo mới.',
  VERSION_GONE:
    'Phiên bản đích không còn là bản nháp hoặc chương trình đã ban hành.',
} as const;
