import ExcelJS from 'exceljs';
import { IMPORT_LIMITS } from '../import.constants.js';
import { normalizeLabel, type SheetSpec } from './sheet-spec.js';

export interface SheetRow<K extends string> {
  rowNumber: number;
  cells: Record<K, string>;
}
export interface FormatError {
  column: string | null;
  message: string;
}
export interface ParsedSheet<K extends string, H extends string> {
  header: Partial<Record<H, string>>;
  rows: SheetRow<K>[];
  unknownColumns: string[];
  formatErrors: FormatError[];
}
export const FORMAT_MESSAGE = {
  NOT_XLSX: 'Tệp không phải bảng tính Excel (.xlsx).',
  NO_HEADER: 'Không tìm thấy dòng tiêu đề của bảng.',
  MISSING_COLUMN: (label: string) =>
    `Thiếu cột "${label}" hoặc tên cột không đúng mẫu.`,
  NO_DATA_ROWS: 'Tệp không có dòng dữ liệu.',
  TOO_MANY_ROWS: (max: number) =>
    `Tệp có quá ${max} dòng dữ liệu; hãy tách thành nhiều tệp.`,
} as const;

export function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value !== 'object') return String(value).trim();
  if ('richText' in value)
    return value.richText
      .map((part) => part.text)
      .join('')
      .trim();
  if ('result' in value) return cellText(value.result);
  if ('text' in value) return value.text.trim();
  return '';
}

function textAt(row: ExcelJS.Row, column: number): string {
  const cell = row.getCell(column);
  return cell.isMerged && cell.master !== cell ? '' : cellText(cell.value);
}

export async function readSheet<K extends string, H extends string>(
  content: Uint8Array,
  spec: SheetSpec<K, H>,
): Promise<ParsedSheet<K, H>> {
  const parsed: ParsedSheet<K, H> = {
    header: {},
    rows: [],
    unknownColumns: [],
    formatErrors: [],
  };
  const fail = (message: string, column: string | null = null) => {
    parsed.formatErrors.push({ column, message });
  };
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(new Uint8Array(content).buffer);
  } catch {
    fail(FORMAT_MESSAGE.NOT_XLSX);
    return parsed;
  }
  const sheet = workbook.getWorksheet(spec.sheetName) ?? workbook.worksheets[0];
  if (!sheet) {
    fail(FORMAT_MESSAGE.NO_HEADER);
    return parsed;
  }
  const required = spec.columns.filter((column) => column.required);
  let heading = 0;
  let best = 0;
  let labels = new Map<string, number>();
  for (
    let rowNumber = 1;
    rowNumber <= Math.min(sheet.rowCount, IMPORT_LIMITS.HEADER_SCAN_ROWS);
    rowNumber++
  ) {
    const row = sheet.getRow(rowNumber);
    const found = new Map<string, number>();
    row.eachCell((_, column) => {
      const text = normalizeLabel(textAt(row, column));
      if (text && !found.has(text)) found.set(text, column);
    });
    const matches = required.filter((column) =>
      found.has(normalizeLabel(column.label)),
    ).length;
    if (matches > best) {
      best = matches;
      heading = rowNumber;
      labels = found;
    }
    if (matches === required.length) break;
  }
  if (!heading) {
    fail(FORMAT_MESSAGE.NO_HEADER);
    return parsed;
  }
  for (const column of required)
    if (!labels.has(normalizeLabel(column.label)))
      fail(FORMAT_MESSAGE.MISSING_COLUMN(column.label), column.label);
  if (parsed.formatErrors.length) return parsed;
  const known = new Set(
    spec.columns.map((column) => normalizeLabel(column.label)),
  );
  for (const [label, index] of labels)
    if (!known.has(label))
      parsed.unknownColumns.push(textAt(sheet.getRow(heading), index));
  for (let rowNumber = 1; rowNumber < heading; rowNumber++) {
    const row = sheet.getRow(rowNumber);
    row.eachCell((_, column) => {
      const field = spec.headerFields.find(
        (entry) =>
          normalizeLabel(entry.label) === normalizeLabel(textAt(row, column)),
      );
      if (!field) return;
      for (let next = column + 1; next <= row.cellCount; next++) {
        const text = textAt(row, next);
        if (text) {
          parsed.header[field.key] = text;
          break;
        }
      }
    });
  }
  for (let rowNumber = heading + 1; rowNumber <= sheet.rowCount; rowNumber++) {
    const row = sheet.getRow(rowNumber);
    const cells = {} as Record<K, string>;
    let nonempty = false;
    for (const column of spec.columns) {
      const index = labels.get(normalizeLabel(column.label));
      const text = index ? textAt(row, index) : '';
      if (!column.ignoredOnRead && text) nonempty = true;
      cells[column.key] = column.ignoredOnRead ? '' : text;
    }
    if (!nonempty) continue;
    parsed.rows.push({ rowNumber, cells });
    if (parsed.rows.length > IMPORT_LIMITS.ROWS_MAX) {
      fail(FORMAT_MESSAGE.TOO_MANY_ROWS(IMPORT_LIMITS.ROWS_MAX));
      break;
    }
  }
  if (!parsed.rows.length) fail(FORMAT_MESSAGE.NO_DATA_ROWS);
  return parsed;
}
