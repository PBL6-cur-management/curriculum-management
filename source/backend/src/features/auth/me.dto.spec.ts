import { describe, expect, it } from 'vitest';
import type { AuthenticatedUser } from '../../shared/auth/authenticated-user.js';
import type { AccessContext } from '../../shared/authz/access-context.js';
import { toMeDto } from './me.dto.js';

const user = {
  id: 'u1',
  username: 'gv01',
  userCode: 'GV01',
  fullName: 'Giảng viên',
  email: null,
  mustChangePassword: false,
} as unknown as AuthenticatedUser;

function access(...roleCodes: string[]): AccessContext {
  return {
    assignments: roleCodes.map((roleCode) => ({
      assignmentId: null,
      roleCode,
      roleName: roleCode,
      scopeType: 'NONE',
      scopeUnit: null,
    })),
    heldPermissions: () => [],
  } as unknown as AccessContext;
}

describe('toMeDto canApprove', () => {
  it('is true for R1, R3 and R4 holders', () => {
    for (const role of ['R1', 'R3', 'R4'])
      expect(toMeDto(user, null, access('R5', role), false).canApprove).toBe(
        true,
      );
  });

  it('is false for a lecturer, the faculty board or a student without a delegation', () => {
    expect(toMeDto(user, null, access('R5'), false).canApprove).toBe(false);
    expect(toMeDto(user, null, access('R2'), false).canApprove).toBe(false);
    expect(toMeDto(user, null, access('R6'), false).canApprove).toBe(false);
    expect(toMeDto(user, null, access(), false).canApprove).toBe(false);
  });

  it('is true for a lecturer who holds a usable delegation today', () => {
    expect(toMeDto(user, null, access('R5'), true).canApprove).toBe(true);
  });
});
