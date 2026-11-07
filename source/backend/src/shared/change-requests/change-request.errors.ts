import { HttpStatus } from '@nestjs/common';
import type { ErrorDefinition } from '../exception/error-definition.js';

// Shared by the guards of every feature that edits a request's working copy, so the copy and the request answer alike.
export const REQUEST_DRAFT_ERRORS = {
  NOT_CREATOR: {
    status: HttpStatus.FORBIDDEN,
    code: 'REQUEST_NOT_CREATOR',
    message: 'Chỉ người tạo đề xuất được sửa bản nháp của đề xuất.',
  },
  NOT_DRAFT: {
    status: HttpStatus.CONFLICT,
    code: 'REQUEST_NOT_DRAFT',
    message:
      'Đề xuất không còn ở trạng thái Nháp; không sửa được bản nháp của nó.',
  },
  WRONG_REQUEST_TYPE: {
    status: HttpStatus.CONFLICT,
    code: 'REQUEST_COPY_WRONG_TYPE',
    message:
      'Đề xuất sửa thông tin chương trình chỉ sửa được thông tin chung. Hãy tạo đề xuất khung chương trình hoặc chuẩn đầu ra cho thay đổi này.',
  },
  COPY_HAS_NO_ATTACHMENTS: {
    status: HttpStatus.CONFLICT,
    code: 'REQUEST_COPY_NO_ATTACHMENTS',
    message:
      'Bản nháp của đề xuất không nhận tệp đính kèm; hãy đính kèm hồ sơ vào chính đề xuất.',
  },
  COPY_DELETED_WITH_REQUEST: {
    status: HttpStatus.CONFLICT,
    code: 'REQUEST_COPY_DELETED_WITH_REQUEST',
    message: 'Bản nháp của đề xuất chỉ bị xóa cùng đề xuất.',
  },
} as const satisfies Record<string, ErrorDefinition>;
