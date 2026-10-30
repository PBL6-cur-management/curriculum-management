import { fileURLToPath } from 'node:url';

export const accounts = {
  R1: process.env.E2E_ADMIN_USERNAME || 'admin',
  R2: 'e2e.r2.lanhdao',
  R3: 'e2e.r3.giamdoc',
  R3b: 'e2e.r3.giamdoc2',
  R4: 'e2e.r4.dieuphoi',
  R4b: 'e2e.r4.dieuphoi2',
  R5: 'e2e.r5.giangvien',
  R5b: 'e2e.r5.giangvien2',
  R6: 'e2e.r6.sinhvien',
} as const;

export type AccountRole = keyof typeof accounts;

export function authStatePath(role: AccountRole): string {
  const username = accounts[role];
  if (!/^[a-zA-Z0-9._-]+$/.test(username)) {
    throw new Error('Tên đăng nhập E2E chỉ được chứa chữ, số, dấu chấm, gạch dưới và gạch ngang.');
  }
  return fileURLToPath(new URL(`../.auth/${username}.json`, import.meta.url));
}

export function asRole(role: AccountRole) {
  return { storageState: authStatePath(role) };
}
