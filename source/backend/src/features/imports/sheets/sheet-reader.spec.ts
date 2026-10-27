import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { IMPORT_LIMITS } from '../import.constants.js';
import { COURSE_CATALOG_SHEET } from './course-catalog.sheet.js';
import { CURRICULUM_SHEET } from './curriculum.sheet.js';
import { cellText, FORMAT_MESSAGE, readSheet } from './sheet-reader.js';
import { writeSheet, writeTemplate } from './sheet-writer.js';

async function catalogFile(
  edit: (sheet: ExcelJS.Worksheet) => void,
): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(COURSE_CATALOG_SHEET.sheetName);
  sheet.addRow(COURSE_CATALOG_SHEET.columns.map((column) => column.label));
  sheet.addRow(['3190111', 'Giải tích', '', '2.5', 'THEORY', '', '']);
  edit(sheet);
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}

describe('sheet reader', () => {
  it('refuses an empty template with NO_DATA_ROWS', async () => {
    const parsed = await readSheet(
      await writeTemplate(CURRICULUM_SHEET),
      CURRICULUM_SHEET,
    );
    expect(parsed.formatErrors).toEqual([
      { column: null, message: FORMAT_MESSAGE.NO_DATA_ROWS },
    ]);
  });
  it('finds row 9 under the program block and normalizes header whitespace and case', async () => {
    const bytes = await writeSheet(
      CURRICULUM_SHEET,
      { programCode: '1024034' },
      [{ courseCode: '3190111', plannedSemester: '2' }],
    );
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(new Uint8Array(bytes).buffer);
    workbook.worksheets[0].getRow(9).getCell(6).value = '  Học  Kỳ ';
    const parsed = await readSheet(
      new Uint8Array(await workbook.xlsx.writeBuffer()),
      CURRICULUM_SHEET,
    );
    expect(parsed.header.programCode).toBe('1024034');
    expect(parsed.rows[0]).toMatchObject({
      rowNumber: 10,
      cells: { courseCode: '3190111', plannedSemester: '2' },
    });
    expect(parsed.formatErrors).toEqual([]);
  });
  it('names a missing or misnamed required column', async () => {
    const parsed = await readSheet(
      await catalogFile((sheet) => {
        sheet.getRow(1).getCell(1).value = 'Mã môn';
      }),
      COURSE_CATALOG_SHEET,
    );
    expect(parsed.formatErrors).toEqual([
      { column: 'Mã HP', message: FORMAT_MESSAGE.MISSING_COLUMN('Mã HP') },
    ]);
  });
  it('reports unknown columns while converting number, rich text and formula results', async () => {
    const parsed = await readSheet(
      await catalogFile((sheet) => {
        sheet.getRow(1).getCell(8).value = 'Ghi chú riêng';
        sheet.getRow(2).getCell(1).value = 3190111;
        sheet.getRow(2).getCell(2).value = {
          richText: [{ text: 'Giải ' }, { text: 'tích' }],
        };
        sheet.getRow(2).getCell(4).value = { formula: '5/2', result: 2.5 };
      }),
      COURSE_CATALOG_SHEET,
    );
    expect(parsed.unknownColumns).toEqual(['Ghi chú riêng']);
    expect(parsed.rows[0].cells).toMatchObject({
      courseCode: '3190111',
      courseName: 'Giải tích',
      credits: '2.5',
    });
  });
  it('refuses more than 2000 data rows', async () => {
    const bytes = await writeSheet(
      COURSE_CATALOG_SHEET,
      {},
      Array.from({ length: IMPORT_LIMITS.ROWS_MAX + 1 }, () => ({
        courseCode: 'A',
      })),
    );
    expect(
      (await readSheet(bytes, COURSE_CATALOG_SHEET)).formatErrors,
    ).toContainEqual({
      column: null,
      message: FORMAT_MESSAGE.TOO_MANY_ROWS(IMPORT_LIMITS.ROWS_MAX),
    });
  });
  it('rejects non-xlsx content', async () => {
    expect(
      (
        await readSheet(
          Buffer.from('not a workbook.docx'),
          COURSE_CATALOG_SHEET,
        )
      ).formatErrors,
    ).toEqual([{ column: null, message: FORMAT_MESSAGE.NOT_XLSX }]);
  });
  it('handles scalar, date, hyperlink, formula without result and error cells', () => {
    expect(cellText(null)).toBe('');
    expect(cellText(true)).toBe('true');
    expect(cellText(new Date('2026-10-26T00:00:00Z'))).toBe(
      '2026-10-26T00:00:00.000Z',
    );
    expect(
      cellText({ text: ' Link ', hyperlink: 'https://example.test' }),
    ).toBe('Link');
    expect(cellText({ formula: '1+1' })).toBe('');
    expect(cellText({ error: '#N/A' })).toBe('');
  });
});
