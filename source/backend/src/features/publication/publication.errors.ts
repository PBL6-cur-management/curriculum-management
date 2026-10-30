import { HttpStatus } from '@nestjs/common';

export const PUBLICATION_ERRORS = {
  VERSION_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    code: 'PROGRAM_VERSION_NOT_FOUND',
    message: 'Không tìm thấy phiên bản của chương trình này.',
  },
  PROGRAM_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    code: 'PROGRAM_NOT_FOUND',
    message: 'Không tìm thấy chương trình đào tạo.',
  },
  PDF_EXPORT_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    code: 'PDF_EXPORT_NOT_FOUND',
    message: 'Không tìm thấy yêu cầu xuất PDF.',
  },
  PDF_NOT_READY: {
    status: HttpStatus.CONFLICT,
    code: 'PDF_NOT_READY',
    message: 'File PDF chưa sẵn sàng.',
  },
  PDF_EXPORT_EXPIRED: {
    status: HttpStatus.GONE,
    code: 'PDF_EXPORT_EXPIRED',
    message: 'File PDF đã hết hạn, hãy xuất lại.',
  },
  PDF_QUEUE_UNAVAILABLE: {
    status: HttpStatus.SERVICE_UNAVAILABLE,
    code: 'PDF_QUEUE_UNAVAILABLE',
    message: 'Chưa thể nhận yêu cầu xuất PDF, hãy thử lại sau.',
  },
} as const;
