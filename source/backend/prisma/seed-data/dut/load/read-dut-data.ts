import { readFileSync } from 'node:fs';
import {
  DUT_DATA_FILES,
  type DutCatalogFile,
  type DutProgramsFile,
} from '../dut-data.js';

export function readDutData(): {
  catalog: DutCatalogFile;
  programs: DutProgramsFile;
} {
  const read = <Data>(file: string): Data =>
    JSON.parse(
      readFileSync(new URL(`../data/${file}`, import.meta.url), 'utf8'),
    ) as Data;
  return {
    catalog: read<DutCatalogFile>(DUT_DATA_FILES.CATALOG),
    programs: read<DutProgramsFile>(DUT_DATA_FILES.PROGRAMS),
  };
}
