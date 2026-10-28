import ExcelJS from 'exceljs';
import { ACADEMIC_RESULT_SHEET, RESULT_IDENTITY_COLUMNS } from './academic-result.sheet.js';
import { findNonTextIdentityCells } from './identity-cells.js';
import { readSheet } from './sheet-reader.js';
import { writeSheet, writeTemplate } from './sheet-writer.js';
import { STUDENT_IDENTITY_COLUMNS, STUDENT_LIST_SHEET } from './student-list.sheet.js';

describe('student sheets', () => {
  it('round-trips a generated student template with synthetic rows', async () => {
    const blank = await readSheet(await writeTemplate(STUDENT_LIST_SHEET), STUDENT_LIST_SHEET);
    expect(blank.formatErrors.map((item) => item.message)).toEqual(['Tệp không có dòng dữ liệu.']);
    const content = await writeSheet(STUDENT_LIST_SHEET, {}, [
      {
        studentCode: '0012',
        fullName: 'Sinh viên giả lập 001',
        cohortCode: 'SYN-COHORT-A',
        major: 'SYN-MAJOR',
        programCode: 'SYN-PROG-A',
        admissionSemesterCode: 'SYN-TERM-A',
        statusSemesterCode: 'SYN-TERM-A',
        status: 'Đang học',
      },
    ]);
    const parsed = await readSheet(content, STUDENT_LIST_SHEET);
    expect(parsed.formatErrors).toEqual([]);
    expect(parsed.rows[0]!.cells.studentCode).toBe('0012');
    expect(await findNonTextIdentityCells(content, STUDENT_LIST_SHEET, STUDENT_IDENTITY_COLUMNS)).toEqual(new Map());
  });

  it('round-trips the academic result template and rows', async () => {
    const content = await writeSheet(ACADEMIC_RESULT_SHEET, {}, [
      {
        studentCode: 'SYN-STU-0001',
        courseCode: 'SYN-COURSE-A',
        semesterCode: 'SYN-TERM-A',
        score10: '8.5',
        score4: '3.5',
        letterGrade: 'B+',
        status: 'Đạt',
      },
    ]);
    const parsed = await readSheet(content, ACADEMIC_RESULT_SHEET);
    expect(parsed.formatErrors).toEqual([]);
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0]!.cells.status).toBe('Đạt');
  });

  it('finds student codes typed as numbers or formulas', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(ACADEMIC_RESULT_SHEET.sheetName);
    sheet.addRow(ACADEMIC_RESULT_SHEET.columns.map((column) => column.label));
    sheet.addRow(['SYN-STU-0001', 'C', 'T', '', '', '', 'Đang học']);
    sheet.addRow([12, 'C', 'T', '', '', '', 'Đang học']);
    sheet.addRow([{ formula: '"A"&"B"', result: 'AB' }, 'C', 'T', '', '', '', 'Đang học']);
    const content = new Uint8Array(await workbook.xlsx.writeBuffer());
    const found = await findNonTextIdentityCells(content, ACADEMIC_RESULT_SHEET, RESULT_IDENTITY_COLUMNS);
    expect([...found.keys()]).toEqual([3, 4]);
    expect(found.get(3)).toEqual(['studentCode']);
  });

  it('returns nothing for a file that is not a workbook', async () => {
    const found = await findNonTextIdentityCells(new Uint8Array([1, 2, 3]), ACADEMIC_RESULT_SHEET, RESULT_IDENTITY_COLUMNS);
    expect(found.size).toBe(0);
  });
});
