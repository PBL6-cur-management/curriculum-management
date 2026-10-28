import ExcelJS from 'exceljs';
import type { SheetSpec } from './sheet-spec.js';
import { writeTemplate } from './sheet-writer.js';

const TEXT_FORMAT = '@';
const INSTRUCTION_SHEET = 'Hướng dẫn';
const INSTRUCTION_WIDTH = 100;

// writeSheet stays generic; the personal-data templates add what only they need: identity columns formatted as text and a sheet that explains the rules.
export async function writeIdentityTemplate<K extends string>(
  spec: SheetSpec<K>,
  identityKeys: readonly K[],
  instructions: readonly string[],
): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(new Uint8Array(await writeTemplate(spec)).buffer);
  const sheet = workbook.getWorksheet(spec.sheetName);
  spec.columns.forEach((column, index) => {
    if (identityKeys.includes(column.key) && sheet) {
      sheet.getColumn(index + 1).numFmt = TEXT_FORMAT;
    }
  });
  const guide = workbook.addWorksheet(INSTRUCTION_SHEET);
  guide.getColumn(1).width = INSTRUCTION_WIDTH;
  for (const line of instructions) guide.addRow([line]);
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}

export const STUDENT_LIST_INSTRUCTIONS = [
  'Mỗi dòng là một sinh viên; mã sinh viên là khóa nhận diện, được chuẩn hóa về chữ in hoa.',
  'Cột Mã sinh viên phải là văn bản (Text). Ô dạng số hoặc công thức bị từ chối vì đã mất số 0 đầu.',
  'Trạng thái: Đang học, Bảo lưu, Thôi học, Đã tốt nghiệp; để trống nghĩa là Đang học.',
  'Học kỳ nhập học và Học kỳ trạng thái dùng mã học kỳ đã có ngày bắt đầu; học kỳ trạng thái không trước học kỳ nhập học.',
  'Sinh viên mới được tạo tài khoản; mật khẩu ban đầu có trong tệp tải về một lần sau khi nhập xong.',
  'Hồ sơ đã có từ dữ liệu của Trường được giữ nguyên, không bị ghi đè bởi tệp Excel.',
] as const;

export const ACADEMIC_RESULT_INSTRUCTIONS = [
  'Mỗi dòng là một lần học: sinh viên, học phần và học kỳ xác định duy nhất một dòng; học lại ở học kỳ khác là một dòng mới.',
  'Cột Mã sinh viên phải là văn bản (Text). Ô dạng số hoặc công thức bị từ chối.',
  'Điểm dùng dấu chấm, tối đa 2 chữ số thập phân: thang 10 từ 0 đến 10, thang 4 từ 0 đến 4.',
  'Trạng thái: Đạt, Không đạt cần đủ điểm hai thang và điểm chữ; Đang học để trống cả ba; Miễn để trống hoặc điền đủ ba.',
  'Kết quả đã có từ dữ liệu của Trường được giữ nguyên, không bị ghi đè bởi tệp Excel.',
] as const;
