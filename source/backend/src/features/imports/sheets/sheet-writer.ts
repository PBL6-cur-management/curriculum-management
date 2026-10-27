import ExcelJS from 'exceljs';
import type { SheetSpec } from './sheet-spec.js';

export async function writeTemplate(spec: SheetSpec): Promise<Uint8Array> {
  return writeSheet(spec, {}, []);
}

export async function writeSheet<K extends string, H extends string>(
  spec: SheetSpec<K, H>,
  header: Partial<Record<H, string>>,
  rows: readonly Partial<Record<K, string>>[],
): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(spec.sheetName);
  for (const field of spec.headerFields)
    worksheet.addRow([field.label, header[field.key] ?? '']);
  if (spec.headerFields.length) worksheet.addRow([]);
  const heading = worksheet.addRow(spec.columns.map((column) => column.label));
  heading.font = { bold: true };
  worksheet.views = [{ state: 'frozen', ySplit: heading.number }];
  spec.columns.forEach((column, index) => {
    worksheet.getColumn(index + 1).width = column.width;
  });
  for (const row of rows)
    worksheet.addRow(spec.columns.map((column) => row[column.key] ?? ''));
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}
