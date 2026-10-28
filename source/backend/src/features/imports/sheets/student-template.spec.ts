import ExcelJS from 'exceljs';
import {
  STUDENT_IDENTITY_COLUMNS,
  STUDENT_LIST_SHEET,
} from './student-list.sheet.js';
import {
  ACADEMIC_RESULT_INSTRUCTIONS,
  writeIdentityTemplate,
} from './student-template.js';

describe('writeIdentityTemplate', () => {
  it('formats identity columns as text and adds the instruction sheet', async () => {
    const bytes = await writeIdentityTemplate(
      STUDENT_LIST_SHEET,
      STUDENT_IDENTITY_COLUMNS,
      ACADEMIC_RESULT_INSTRUCTIONS,
    );
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(new Uint8Array(bytes).buffer);
    expect(
      workbook.getWorksheet(STUDENT_LIST_SHEET.sheetName)?.getColumn(1).numFmt,
    ).toBe('@');
    expect(
      workbook.getWorksheet(STUDENT_LIST_SHEET.sheetName)?.getColumn(2).numFmt,
    ).not.toBe('@');
    expect(workbook.getWorksheet('Hướng dẫn')?.rowCount).toBe(
      ACADEMIC_RESULT_INSTRUCTIONS.length,
    );
  });
});
