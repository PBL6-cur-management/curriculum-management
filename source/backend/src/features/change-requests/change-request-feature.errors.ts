import { HttpStatus } from '@nestjs/common';
import type { ErrorDefinition } from '../../shared/exception/error-definition.js';

export const CHANGE_REQUEST_ERRORS = {
  REQUEST_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    code: 'REQUEST_NOT_FOUND',
    message: 'Không tìm thấy đề xuất.',
  },
  TARGET_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    code: 'TARGET_NOT_FOUND',
    message: 'Không tìm thấy đối tượng của đề xuất.',
  },
  TYPE_TARGET_MISMATCH: {
    status: HttpStatus.BAD_REQUEST,
    code: 'TYPE_TARGET_MISMATCH',
    message: 'Loại đề xuất này không áp dụng cho đối tượng đã chọn.',
  },
  TARGET_NOT_RELEASED: {
    status: HttpStatus.CONFLICT,
    code: 'TARGET_NOT_RELEASED',
    message: 'Đối tượng chưa ban hành; hãy sửa trực tiếp, không cần đề xuất.',
  },
  REQUEST_NOT_DELETABLE: {
    status: HttpStatus.CONFLICT,
    code: 'REQUEST_NOT_DELETABLE',
    message:
      'Chỉ xóa được đề xuất Nháp chưa gửi lần nào; đề xuất đã gửi chỉ có thể rút.',
  },
  NOT_WORKSPACE_TYPE: {
    status: HttpStatus.CONFLICT,
    code: 'NOT_WORKSPACE_TYPE',
    message: 'Loại đề xuất này không có bản nháp để làm lại.',
  },
  BASIS_REQUIRED: {
    status: HttpStatus.BAD_REQUEST,
    code: 'BASIS_REQUIRED',
    message: 'Đề xuất theo yêu cầu của Trường phải có số văn bản căn cứ.',
  },
} as const satisfies Record<string, ErrorDefinition>;

export const AUTHORED_ITEM_ERRORS = {
  ITEMS_NOT_AUTHORED: {
    status: HttpStatus.CONFLICT,
    code: 'ITEMS_NOT_AUTHORED',
    message:
      'Loại đề xuất này soạn thay đổi trên bản nháp, không nhập từng mục.',
  },
  OPERATION_NOT_FOR_TYPE: {
    status: HttpStatus.BAD_REQUEST,
    code: 'OPERATION_NOT_FOR_TYPE',
    message: 'Thay đổi này không thuộc loại đề xuất đã chọn.',
  },
  OPERATION_TARGET_MISMATCH: {
    status: HttpStatus.BAD_REQUEST,
    code: 'OPERATION_TARGET_MISMATCH',
    message: 'Thay đổi này không áp dụng cho đối tượng của đề xuất.',
  },
  ITEM_REFERENCE_NOT_FOUND: {
    status: HttpStatus.BAD_REQUEST,
    code: 'ITEM_REFERENCE_NOT_FOUND',
    message: 'Không tìm thấy bản ghi mà thay đổi nhắc tới.',
  },
  ITEM_UNCHANGED: {
    status: HttpStatus.BAD_REQUEST,
    code: 'ITEM_UNCHANGED',
    message: 'Giá trị mới trùng giá trị hiện tại.',
  },
  ITEM_INVALID: {
    status: HttpStatus.BAD_REQUEST,
    code: 'ITEM_INVALID',
    message: 'Giá trị của thay đổi không hợp lệ.',
  },
  ITEM_DUPLICATE: {
    status: HttpStatus.BAD_REQUEST,
    code: 'ITEM_DUPLICATE',
    message: 'Hai thay đổi trùng nhau trong cùng đề xuất.',
  },
} as const satisfies Record<string, ErrorDefinition>;

export const SUBMISSION_ERRORS = {
  NO_CHANGES: {
    status: HttpStatus.CONFLICT,
    code: 'NO_CHANGES',
    message: 'Đề xuất chưa có thay đổi nào so với bản đang áp dụng.',
  },
  STALE_BASE: {
    status: HttpStatus.CONFLICT,
    code: 'STALE_BASE',
    message:
      'Dữ liệu gốc đã thay đổi sau khi đề xuất được soạn; hãy làm lại bản nháp trên dữ liệu mới.',
  },
  NO_OTHER_ACADEMIC_OFFICE: {
    status: HttpStatus.CONFLICT,
    code: 'NO_OTHER_ACADEMIC_OFFICE',
    message:
      'Không có cán bộ Phòng Đào tạo nào khác để phê duyệt đề xuất do bạn tạo.',
  },
  NO_COORDINATOR: {
    status: HttpStatus.CONFLICT,
    code: 'NO_COORDINATOR',
    message:
      'Nhóm chuyên môn chưa có Điều phối nên chưa gửi duyệt được. Liên hệ Phòng Đào tạo để phân công.',
  },
  NO_DIRECTOR: {
    status: HttpStatus.CONFLICT,
    code: 'NO_DIRECTOR',
    message:
      'Chương trình chưa có Giám đốc CTĐT nên chưa gửi duyệt được. Liên hệ Phòng Đào tạo để phân công.',
  },
  WITHDRAW_NOT_ALLOWED: {
    status: HttpStatus.CONFLICT,
    code: 'WITHDRAW_NOT_ALLOWED',
    message:
      'Không rút được: đã có người phê duyệt đề xuất ở lần gửi này, hoặc đề xuất đã kết thúc.',
  },
} as const satisfies Record<string, ErrorDefinition>;

export const DOCUMENT_ERRORS = {
  DOCUMENT_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    code: 'DOCUMENT_NOT_FOUND',
    message: 'Không tìm thấy hồ sơ.',
  },
  DOCUMENT_LOCKED: {
    status: HttpStatus.CONFLICT,
    code: 'DOCUMENT_LOCKED',
    message:
      'Hồ sơ đã gửi kèm đề xuất cho người duyệt; không xóa được, chỉ thêm hồ sơ mới.',
  },
  DOCUMENTS_LIMIT: {
    status: HttpStatus.CONFLICT,
    code: 'DOCUMENTS_LIMIT',
    message: 'Đề xuất đã đủ số hồ sơ tối đa.',
  },
  REQUEST_CLOSED: {
    status: HttpStatus.CONFLICT,
    code: 'REQUEST_CLOSED',
    message: 'Đề xuất đã kết thúc; không thêm hồ sơ được.',
  },
  ATTACHMENT_FILE_REQUIRED: {
    status: HttpStatus.BAD_REQUEST,
    code: 'ATTACHMENT_FILE_REQUIRED',
    message: 'Chưa chọn tệp để tải lên.',
  },
  ATTACHMENT_TYPE_NOT_ALLOWED: {
    status: HttpStatus.BAD_REQUEST,
    code: 'ATTACHMENT_TYPE_NOT_ALLOWED',
    message: 'Chỉ nhận tệp PDF, DOCX, XLSX hoặc ảnh PNG/JPG.',
  },
} as const satisfies Record<string, ErrorDefinition>;
