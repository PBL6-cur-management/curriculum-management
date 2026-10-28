import { STUDENT_CODE_PATTERN, STUDENT_LIMITS } from './student.constants.js';

export function normalizeStudentCode(value: string): string {
  return value.trim().toUpperCase();
}

export function isValidStudentCode(code: string): boolean {
  return (
    code.length >= STUDENT_LIMITS.CODE_MIN &&
    code.length <= STUDENT_LIMITS.CODE_MAX &&
    STUDENT_CODE_PATTERN.test(code)
  );
}
