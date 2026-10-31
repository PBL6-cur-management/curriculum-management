import { describe, expect, it } from 'vitest';
import {
  PERMISSION_CODES,
  PERMISSIONS,
} from '../../src/shared/authz/permission-codes.js';
import { CELL, PERMISSION_CATALOG } from './permission-catalog.js';

describe('permission catalog', () => {
  it('contains each of the 43 permissions exactly once and in canonical order', () => {
    const codes = PERMISSION_CATALOG.map((entry) => entry.code);

    expect(codes).toHaveLength(44);
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes).toEqual(PERMISSION_CODES);
  });

  it('uses valid cell symbols and keeps locked R1 cells present', () => {
    const allowedCells = Object.values(CELL);
    for (const entry of PERMISSION_CATALOG) {
      for (const cell of Object.values(entry.cells)) {
        expect(allowedCells).toContain(cell);
      }
    }
    expect(
      PERMISSION_CATALOG.find(
        (entry) => entry.code === PERMISSIONS.PERMISSION_MANAGE,
      )?.cells.R1,
    ).toBe(CELL.X);
    expect(
      PERMISSION_CATALOG.find((entry) => entry.code === PERMISSIONS.USER_MANAGE)
        ?.cells.R1,
    ).toBe(CELL.X);
  });

  it('matches representative matrix cells', () => {
    const cell = (
      code: string,
      role: 'R1' | 'R2' | 'R3' | 'R4' | 'R5' | 'R6',
    ) => PERMISSION_CATALOG.find((entry) => entry.code === code)?.cells[role];

    expect(cell(PERMISSIONS.COURSE_EDIT, 'R3')).toBe(CELL.D);
    expect(cell(PERMISSIONS.CURRICULUM_EDIT, 'R3')).toBe(CELL.DP);
    expect(cell(PERMISSIONS.CURRICULUM_EDIT, 'R4')).toBe(CELL.DP);
    expect(cell(PERMISSIONS.PROGRAM_VIEW, 'R6')).toBe(CELL.P);
  });
});
