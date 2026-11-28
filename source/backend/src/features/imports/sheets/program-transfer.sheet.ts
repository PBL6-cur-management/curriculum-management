import type { SheetSpec } from './sheet-spec.js';

export const TRANSFER_SHEET_WIDTHS = {
  CODE: 16,
  PROGRAM: 18,
  VERSION: 14,
  TRACK: 18,
  SEMESTER: 18,
  BASIS: 40,
} as const;

export const PROGRAM_TRANSFER_SHEET = {
  sheetName: 'Chuyển chương trình',
  headerFields: [],
  columns: [
    {
      key: 'studentCode',
      label: 'Mã SV',
      required: true,
      width: TRANSFER_SHEET_WIDTHS.CODE,
    },
    {
      key: 'programCode',
      label: 'Mã CTĐT đích',
      required: true,
      width: TRANSFER_SHEET_WIDTHS.PROGRAM,
    },
    {
      key: 'versionNumber',
      label: 'Phiên bản đích',
      required: false,
      width: TRANSFER_SHEET_WIDTHS.VERSION,
    },
    {
      key: 'trackCode',
      label: 'Mã định hướng',
      required: false,
      width: TRANSFER_SHEET_WIDTHS.TRACK,
    },
    {
      key: 'semesterCode',
      label: 'Mã học kỳ áp dụng',
      required: true,
      width: TRANSFER_SHEET_WIDTHS.SEMESTER,
    },
    {
      key: 'basisDecision',
      label: 'Số quyết định / căn cứ',
      required: true,
      width: TRANSFER_SHEET_WIDTHS.BASIS,
    },
  ],
} as const satisfies SheetSpec;

export type ProgramTransferColumn =
  (typeof PROGRAM_TRANSFER_SHEET.columns)[number]['key'];

export const PROGRAM_TRANSFER_IDENTITY_COLUMNS = [
  'studentCode',
] as const satisfies readonly ProgramTransferColumn[];

export const PROGRAM_TRANSFER_INSTRUCTIONS = [
  'Mỗi dòng chuyển chương trình đào tạo chính của một sinh viên; mỗi sinh viên chỉ xuất hiện một lần trong tệp.',
  'Cột Mã SV phải là văn bản (Text). Ô dạng số hoặc công thức bị từ chối vì đã mất số 0 đầu.',
  'Phiên bản đích để trống nghĩa là phiên bản mới nhất đã ban hành của chương trình đích.',
  'Mã định hướng để trống nghĩa là chưa chọn định hướng; nếu điền, phải thuộc phiên bản đích.',
  'Học kỳ áp dụng có thể là học kỳ sắp tới, nhưng không trước học kỳ có hiệu lực của phiên bản đích và không trước học kỳ bắt đầu chương trình hiện tại.',
  'Quá trình theo học cũ được giữ lại làm lịch sử; sinh viên có thể quay lại chương trình đã học trước đó.',
] as const;
