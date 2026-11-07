import { describe, expect, it } from 'vitest';
import {
  ChangeRequestType,
  ChangeTargetType,
} from '../../generated/prisma/client.js';
import { PERMISSIONS } from '../authz/permission-codes.js';
import { editPermissionsFor } from './request-kinds.js';

describe('editPermissionsFor', () => {
  it('lets either outcome permission open a programme outcome request', () => {
    expect(
      editPermissionsFor(ChangeRequestType.OUTCOME, ChangeTargetType.PROGRAM),
    ).toEqual([PERMISSIONS.PLO_EDIT, PERMISSIONS.CLO_EDIT]);
  });

  it('keeps a course outcome request on the CLO permission', () => {
    expect(
      editPermissionsFor(ChangeRequestType.OUTCOME, ChangeTargetType.COURSE),
    ).toEqual([PERMISSIONS.CLO_EDIT]);
  });
});
