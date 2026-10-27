export interface SheetColumn<K extends string = string> {
  key: K;
  label: string;
  required: boolean;
  ignoredOnRead?: boolean;
  width: number;
}
export interface SheetSpec<
  K extends string = string,
  H extends string = string,
> {
  sheetName: string;
  columns: readonly SheetColumn<K>[];
  headerFields: readonly { key: H; label: string }[];
}
export function normalizeLabel(text: string): string {
  return text
    .normalize('NFC')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('vi');
}
