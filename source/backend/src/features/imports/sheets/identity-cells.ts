import ExcelJS from 'exceljs';
import { IMPORT_LIMITS } from '../import.constants.js';
import { normalizeLabel, type SheetSpec } from './sheet-spec.js';

// Row number -> identity columns whose cell is a number, formula or error instead of text.
export type NonTextCells<K extends string> = ReadonlyMap<number, readonly K[]>;

function isLiteralText(value: ExcelJS.CellValue): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return true;
  return typeof value === 'object' && 'richText' in value;
}

// The shared sheet reader flattens every cell to a string, which hides the cell type; this scans the same workbook for identity cells that were not typed as text.
export async function findNonTextIdentityCells<K extends string>(
  content: Uint8Array,
  spec: SheetSpec<K>,
  identityKeys: readonly K[],
): Promise<NonTextCells<K>> {
  const found = new Map<number, K[]>();
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(new Uint8Array(content).buffer);
  } catch {
    return found;
  }
  const sheet = workbook.getWorksheet(spec.sheetName) ?? workbook.worksheets[0];
  if (!sheet) return found;
  const wanted = spec.columns.filter((column) => identityKeys.includes(column.key));
  for (const column of wanted) {
    const label = normalizeLabel(column.label);
    let headingRow = 0;
    let columnIndex = 0;
    for (
      let rowNumber = 1;
      rowNumber <= Math.min(sheet.rowCount, IMPORT_LIMITS.HEADER_SCAN_ROWS) && !headingRow;
      rowNumber++
    ) {
      sheet.getRow(rowNumber).eachCell((cell, index) => {
        const value = cell.value;
        if (!headingRow && typeof value === 'string' && normalizeLabel(value) === label) {
          headingRow = rowNumber;
          columnIndex = index;
        }
      });
    }
    if (!headingRow) continue;
    for (let rowNumber = headingRow + 1; rowNumber <= sheet.rowCount; rowNumber++) {
      const cell = sheet.getRow(rowNumber).getCell(columnIndex);
      if (isLiteralText(cell.value)) continue;
      const keys = found.get(rowNumber) ?? [];
      keys.push(column.key);
      found.set(rowNumber, keys);
    }
  }
  return found;
}
