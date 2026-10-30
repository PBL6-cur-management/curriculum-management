import { HttpStatus } from '@nestjs/common';
import type { ErrorDefinition } from '../../shared/exception/error-definition.js';

export const SCHOOL_SYNC_ERRORS = {
  OFFICE_ONLY: {
    status: HttpStatus.FORBIDDEN,
    code: 'SCHOOL_SYNC_OFFICE_ONLY',
    message: 'Chỉ Phòng Đào tạo được cấu hình đồng bộ CSDL Trường.',
  },
  STALE_CONFIGURATION: {
    status: HttpStatus.CONFLICT,
    code: 'SCHOOL_SYNC_STALE',
    message: 'Cấu hình vừa được người khác thay đổi. Tải lại rồi thử lại.',
  },
  RUN_IN_PROGRESS: {
    status: HttpStatus.CONFLICT,
    code: 'SCHOOL_SYNC_RUNNING',
    message: 'Đang có một lần đồng bộ chạy. Chờ lần đó kết thúc rồi thử lại.',
  },
  NOT_READY: {
    status: HttpStatus.CONFLICT,
    code: 'SCHOOL_SYNC_NOT_READY',
    message:
      'Chưa đồng bộ được: chọn nguồn CSDL Trường và kiểm tra kết nối đã lưu trước.',
  },
  HOST_NOT_ALLOWED: {
    status: HttpStatus.BAD_REQUEST,
    code: 'SCHOOL_SYNC_HOST_NOT_ALLOWED',
    message:
      'Máy chủ này chưa được quản trị hệ thống cho phép. Bản mô phỏng chỉ chạy trên máy này.',
  },
  INCOMPLETE_CONNECTION: {
    status: HttpStatus.BAD_REQUEST,
    code: 'SCHOOL_SYNC_INCOMPLETE_CONNECTION',
    message: 'Cần đủ máy chủ, cổng, tên CSDL, tài khoản và mật khẩu.',
  },
  KEY_UNAVAILABLE: {
    status: HttpStatus.SERVICE_UNAVAILABLE,
    code: 'SCHOOL_SYNC_KEY_UNAVAILABLE',
    message:
      'Máy chủ chưa có khóa mã hóa mật khẩu kết nối (SCHOOL_SYNC_ENCRYPTION_KEY).',
  },
  SOURCE_IDENTITY_LOCKED: {
    status: HttpStatus.CONFLICT,
    code: 'SCHOOL_SYNC_SOURCE_IDENTITY_LOCKED',
    message: 'Không đổi được mã nguồn dữ liệu sau khi đã đồng bộ thành công.',
  },
  MAPPING_TARGET_UNKNOWN: {
    status: HttpStatus.BAD_REQUEST,
    code: 'SCHOOL_SYNC_MAPPING_TARGET_UNKNOWN',
    message: 'Có mã đích không tồn tại trong hệ thống.',
  },
  MAPPING_DUPLICATE: {
    status: HttpStatus.BAD_REQUEST,
    code: 'SCHOOL_SYNC_MAPPING_DUPLICATE',
    message: 'Một mã nguồn chỉ được ánh xạ một lần trong mỗi loại.',
  },
  RUN_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    code: 'SCHOOL_SYNC_RUN_NOT_FOUND',
    message: 'Không tìm thấy lần đồng bộ.',
  },
  RETRY_NOT_ALLOWED: {
    status: HttpStatus.CONFLICT,
    code: 'SCHOOL_SYNC_RETRY_NOT_ALLOWED',
    message: 'Chỉ chạy lại được lần đồng bộ thất bại.',
  },
} as const satisfies Record<string, ErrorDefinition>;

// Codes a run or a connection test ends with. The message beside them never carries driver text.
export const SYNC_FAILURE = {
  CONNECTION_FAILED:
    'Không kết nối được CSDL Trường (máy chủ, cổng hoặc tài khoản).',
  READ_ONLY_REQUIRED:
    'Tài khoản kết nối có quyền ghi. Hãy dùng tài khoản chỉ đọc.',
  SOURCE_CONTRACT_INVALID:
    'CSDL Trường không có đúng các view cms_sync_v1 cần đọc.',
  CONNECTOR_UNAVAILABLE:
    'Chưa dùng được kết nối: thiếu cấu hình hoặc khóa mã hóa.',
  SOURCE_TOO_LARGE: 'Dữ liệu nguồn vượt giới hạn một lần đồng bộ.',
  SOURCE_DATA_INVALID: 'Dữ liệu nguồn có dòng không hợp lệ; không ghi gì.',
  LOCAL_STATE_CHANGED:
    'Dữ liệu trong hệ thống đổi trong lúc đồng bộ; không ghi gì.',
  TIMED_OUT: 'Lần đồng bộ quá thời hạn và đã dừng; không ghi gì.',
  DISPATCH_FAILED: 'Không đưa được lần đồng bộ vào hàng đợi.',
  UNEXPECTED: 'Lỗi ngoài dự kiến khi đồng bộ; không ghi gì.',
} as const;
export type SyncFailureCode = keyof typeof SYNC_FAILURE;

export class SyncFailure extends Error {
  constructor(
    readonly failure: SyncFailureCode,
    // Safe, PII-free addition to the fixed message (row numbers, counts).
    readonly detail?: string,
  ) {
    super(SYNC_FAILURE[failure]);
  }

  get summary(): string {
    return this.detail ? `${this.message} ${this.detail}` : this.message;
  }
}
