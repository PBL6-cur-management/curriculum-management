import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { CURRICULUM_SHEET } from './curriculum.sheet.js';
import { COURSE_CATALOG_SHEET } from './course-catalog.sheet.js';
import { writeSheet, writeTemplate } from './sheet-writer.js';

describe('sheet writer', () => {
  it('writes the exact curriculum column order, program pairs, widths and frozen heading', async () => {
    const bytes = await writeSheet(
      CURRICULUM_SHEET,
      { programCode: '1024034', programName: 'CNTT' },
      [{ courseCode: '3190111', registrable: '' }],
    );
    expect(bytes).toBeInstanceOf(Uint8Array);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(new Uint8Array(bytes).buffer);
    const sheet = workbook.getWorksheet(CURRICULUM_SHEET.sheetName)!;
    expect(sheet.getRow(1).getCell(1).value).toBe('Mã chương trình');
    expect(sheet.getRow(1).getCell(2).value).toBe('1024034');
    expect(sheet.getRow(2).getCell(2).value).toBe('CNTT');
    expect(sheet.getRow(9).values).toEqual([
      undefined,
      ...CURRICULUM_SHEET.columns.map((column) => column.label),
    ]);
    expect(sheet.getRow(9).font.bold).toBe(true);
    expect(sheet.views[0]).toMatchObject({ state: 'frozen', ySplit: 9 });
    expect(sheet.getColumn(4).width).toBe(40);
    expect(sheet.getRow(10).getCell(12).value).toBe('');
  });

  it('writes a catalog template without a program block', async () => {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(
      new Uint8Array(await writeTemplate(COURSE_CATALOG_SHEET)).buffer,
    );
    expect(workbook.worksheets[0].getRow(1).values).toEqual([
      undefined,
      ...COURSE_CATALOG_SHEET.columns.map((column) => column.label),
    ]);
    expect(workbook.worksheets[0].rowCount).toBe(1);
  });
});
