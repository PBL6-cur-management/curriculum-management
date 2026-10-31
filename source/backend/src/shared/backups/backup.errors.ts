import { HttpStatus } from '@nestjs/common';
import type { ErrorDefinition } from '../exception/error-definition.js';

// Persisted on run/drill records as {code, message}; only the catalog failure is ever an HTTP answer (503).
export const BACKUP_ERRORS = {
  NOT_CONFIGURED: {
    status: HttpStatus.SERVICE_UNAVAILABLE,
    code: 'BACKUP_NOT_CONFIGURED',
    message:
      'Sao lưu chưa được cấu hình. Hãy đặt BACKUP_ENABLED và BACKUP_ROOT theo sổ tay vận hành.',
  },
  ROOT_INVALID: {
    status: HttpStatus.SERVICE_UNAVAILABLE,
    code: 'BACKUP_ROOT_INVALID',
    message:
      'Thư mục sao lưu không hợp lệ (trùng, nằm trong thư mục tệp, là liên kết hoặc gốc ổ đĩa). Hãy chọn thư mục riêng trên ổ khác.',
  },
  TOOL_UNAVAILABLE: {
    status: HttpStatus.SERVICE_UNAVAILABLE,
    code: 'BACKUP_TOOL_UNAVAILABLE',
    message:
      'Không chạy được công cụ PostgreSQL (pg_dump/pg_restore). Hãy cài bộ công cụ PostgreSQL 18 và kiểm tra đường dẫn.',
  },
  TOOL_VERSION_MISMATCH: {
    status: HttpStatus.SERVICE_UNAVAILABLE,
    code: 'BACKUP_TOOL_VERSION_MISMATCH',
    message:
      'Phiên bản công cụ PostgreSQL không khớp máy chủ cơ sở dữ liệu. Hãy dùng công cụ PostgreSQL 18.',
  },
  DATABASE_OPTIONS_UNSUPPORTED: {
    status: HttpStatus.SERVICE_UNAVAILABLE,
    code: 'BACKUP_DATABASE_OPTIONS_UNSUPPORTED',
    message:
      'Chuỗi kết nối cơ sở dữ liệu có tùy chọn sao lưu không hỗ trợ. Hãy dùng chuỗi kết nối chuẩn theo sổ tay vận hành.',
  },
  BUSY: {
    status: HttpStatus.CONFLICT,
    code: 'BACKUP_BUSY',
    message:
      'Một lần sao lưu hoặc diễn tập khác đang chạy. Hệ thống sẽ tự thử lại.',
  },
  TIMEOUT: {
    status: HttpStatus.SERVICE_UNAVAILABLE,
    code: 'BACKUP_TIMEOUT',
    message:
      'Sao lưu chạy quá thời gian cho phép và đã dừng. Hãy kiểm tra tải máy chủ và dung lượng ổ đĩa.',
  },
  DUMP_FAILED: {
    status: HttpStatus.SERVICE_UNAVAILABLE,
    code: 'BACKUP_DUMP_FAILED',
    message:
      'Không tạo được bản sao cơ sở dữ liệu. Hãy kiểm tra kết nối, quyền và dung lượng ổ đĩa rồi chạy lại.',
  },
  SOURCE_CHANGED: {
    status: HttpStatus.SERVICE_UNAVAILABLE,
    code: 'BACKUP_SOURCE_CHANGED',
    message: 'Tệp thay đổi trong lúc sao chép. Hệ thống sẽ tự thử lại sao lưu.',
  },
  FILE_MISSING: {
    status: HttpStatus.SERVICE_UNAVAILABLE,
    code: 'BACKUP_FILE_MISSING',
    message:
      'Thiếu tệp được cơ sở dữ liệu tham chiếu. Hãy kiểm tra thư mục tệp và chạy lại sao lưu.',
  },
  CHECKSUM_MISMATCH: {
    status: HttpStatus.SERVICE_UNAVAILABLE,
    code: 'BACKUP_CHECKSUM_MISMATCH',
    message:
      'Mã kiểm tra của bản sao lưu không khớp. Không dùng bộ này để phục hồi; hãy chọn bộ khác.',
  },
  CATALOG_INVALID: {
    status: HttpStatus.SERVICE_UNAVAILABLE,
    code: 'BACKUP_CATALOG_INVALID',
    message:
      'Danh mục sao lưu bị hỏng hoặc sai định dạng. Hãy kiểm tra thư mục sao lưu theo sổ tay vận hành.',
  },
  CATALOG_UNAVAILABLE: {
    status: HttpStatus.SERVICE_UNAVAILABLE,
    code: 'BACKUP_CATALOG_UNAVAILABLE',
    message:
      'Không đọc được danh mục sao lưu. Hãy kiểm tra ổ đĩa sao lưu và quyền truy cập.',
  },
  RETENTION_FAILED: {
    status: HttpStatus.SERVICE_UNAVAILABLE,
    code: 'BACKUP_RETENTION_FAILED',
    message:
      'Không xóa được bộ sao lưu cũ. Các bộ mới vẫn an toàn; hãy kiểm tra quyền thư mục sao lưu.',
  },
  DRILL_TARGET_UNSAFE: {
    status: HttpStatus.BAD_REQUEST,
    code: 'DRILL_TARGET_UNSAFE',
    message:
      'Đích diễn tập không an toàn (không trống, trùng cơ sở dữ liệu đang chạy hoặc sai tên/vùng ngôn ngữ). Hãy chuẩn bị đích sạch theo sổ tay.',
  },
  DRILL_RESTORE_FAILED: {
    status: HttpStatus.SERVICE_UNAVAILABLE,
    code: 'DRILL_RESTORE_FAILED',
    message:
      'Phục hồi vào đích diễn tập thất bại. Đích được giữ nguyên để kiểm tra; không tự xóa.',
  },
  DRILL_VERIFICATION_FAILED: {
    status: HttpStatus.SERVICE_UNAVAILABLE,
    code: 'DRILL_VERIFICATION_FAILED',
    message:
      'Dữ liệu phục hồi không khớp bản sao lưu. Xem các mục kiểm tra không đạt.',
  },
  DRILL_ACCEPTANCE_FAILED: {
    status: HttpStatus.CONFLICT,
    code: 'DRILL_ACCEPTANCE_FAILED',
    message:
      'Người vận hành ghi nhận diễn tập không đạt nghiệm thu. Xem ghi chú nghiệm thu.',
  },
} as const satisfies Record<string, ErrorDefinition>;

export type BackupErrorKey = keyof typeof BACKUP_ERRORS;

// A failure that is safe to persist and show: a stable code and its Vietnamese message, never raw stderr.
export class BackupFailure extends Error {
  constructor(
    readonly definition: (typeof BACKUP_ERRORS)[BackupErrorKey],
    readonly retryable = false,
  ) {
    super(definition.code);
    this.name = 'BackupFailure';
  }

  toRecord(): { code: string; message: string } {
    return { code: this.definition.code, message: this.definition.message };
  }
}

export function failureOf(error: unknown): { code: string; message: string } {
  if (error instanceof BackupFailure) return error.toRecord();
  if ((error as { name?: string })?.name === 'AbortError') {
    return new BackupFailure(BACKUP_ERRORS.TIMEOUT).toRecord();
  }
  return new BackupFailure(BACKUP_ERRORS.DUMP_FAILED).toRecord();
}
