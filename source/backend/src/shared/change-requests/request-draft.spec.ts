import { describe, expect, it, vi } from 'vitest';
import {
  ChangeRequestStatus,
  ChangeRequestType,
  ScopeSource,
  ScopeType,
  type PermissionMode,
} from '../../generated/prisma/client.js';
import {
  AccessContext,
  type ActiveAssignment,
} from '../authz/access-context.js';
import { PERMISSIONS, type PermissionCode } from '../authz/permission-codes.js';
import {
  assertEditPath,
  canEditCopy,
  toRequestRef,
  type RequestDraftRef,
} from './request-draft.js';

function access(
  userId: string,
  code: PermissionCode,
  mode: PermissionMode,
  groupIds: string[] = ['g1'],
): AccessContext {
  const assignment: ActiveAssignment = {
    assignmentId: null,
    roleId: 'r',
    roleCode: 'R',
    roleName: 'R',
    scopeSource: ScopeSource.NONE,
    scopeType: ScopeType.ASSIGNMENT,
    scopeUnit: null,
    scope: {
      all: false,
      orgUnitIds: new Set(),
      subjectGroupIds: new Set(groupIds),
      programIds: new Set(),
      studentIds: new Set(),
    },
    permissions: new Map([[code, { mode, scope: 'SCOPED' as const }]]),
  };
  return new AccessContext(userId, [assignment]);
}

const TARGET = { subjectGroupIds: ['g1'] };
const REQUEST: RequestDraftRef = {
  id: 'cr1',
  requestCode: 'DX-2026-0001',
  status: ChangeRequestStatus.DRAFT,
  createdById: 'creator',
  requestType: ChangeRequestType.SYLLABUS_CONTENT,
};
const CODE = PERMISSIONS.SYLLABUS_EDIT;

describe('assertEditPath', () => {
  it('without a request keeps the direct-edit rule and awaits the state', async () => {
    const state = vi.fn().mockResolvedValue({
      released: true,
      draftOpenToRequestHolders: true,
    });
    await expect(
      assertEditPath(
        access('creator', CODE, 'DIRECT'),
        CODE,
        TARGET,
        null,
        state,
      ),
    ).rejects.toMatchObject({ code: 'CHANGE_REQUEST_REQUIRED' });
    expect(state).toHaveBeenCalledOnce();
    await expect(
      assertEditPath(
        access('creator', CODE, 'DIRECT'),
        CODE,
        TARGET,
        null,
        () =>
          Promise.resolve({ released: false, draftOpenToRequestHolders: true }),
      ),
    ).resolves.toBeUndefined();
  });

  it('lets the creator write the copy of a Draft request and never reads the release state', async () => {
    const state = vi.fn();
    await expect(
      assertEditPath(
        access('creator', CODE, 'VIA_REQUEST'),
        CODE,
        TARGET,
        REQUEST,
        state,
      ),
    ).resolves.toBeUndefined();
    expect(state).not.toHaveBeenCalled();
  });

  it('tells a colleague holding the permission that the copy is not theirs', async () => {
    await expect(
      assertEditPath(
        access('other', CODE, 'DIRECT'),
        CODE,
        TARGET,
        REQUEST,
        vi.fn(),
      ),
    ).rejects.toMatchObject({ code: 'REQUEST_NOT_CREATOR' });
  });

  it('refuses a creator who lost the permission or the scope', async () => {
    const lost = new AccessContext('creator', []);
    await expect(
      assertEditPath(lost, CODE, TARGET, REQUEST, vi.fn()),
    ).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    await expect(
      assertEditPath(
        access('creator', CODE, 'VIA_REQUEST', ['elsewhere']),
        CODE,
        TARGET,
        REQUEST,
        vi.fn(),
      ),
    ).rejects.toMatchObject({ code: 'OUT_OF_SCOPE' });
  });

  it.each([
    ChangeRequestStatus.PENDING_COORDINATOR,
    ChangeRequestStatus.WITHDRAWN,
    ChangeRequestStatus.APPROVED,
  ])('refuses the copy of a %s request', async (status) => {
    await expect(
      assertEditPath(
        access('creator', CODE, 'VIA_REQUEST'),
        CODE,
        TARGET,
        { ...REQUEST, status },
        vi.fn(),
      ),
    ).rejects.toMatchObject({ code: 'REQUEST_NOT_DRAFT' });
  });
});

describe('programme-info copy', () => {
  const INFO_REQUEST: RequestDraftRef = {
    ...REQUEST,
    requestType: ChangeRequestType.PROGRAM_INFO,
  };

  it('accepts general-info writes', async () => {
    const code = PERMISSIONS.PROGRAM_EDIT_INFO;
    await expect(
      assertEditPath(
        access('creator', code, 'VIA_REQUEST'),
        code,
        TARGET,
        INFO_REQUEST,
        vi.fn(),
      ),
    ).resolves.toBeUndefined();
    expect(
      canEditCopy(
        access('creator', code, 'VIA_REQUEST'),
        code,
        TARGET,
        INFO_REQUEST,
      ),
    ).toBe(true);
  });

  it.each([PERMISSIONS.CURRICULUM_EDIT, PERMISSIONS.PLO_EDIT])(
    'refuses %s writes',
    async (code) => {
      const creator = access('creator', code, 'VIA_REQUEST');
      await expect(
        assertEditPath(creator, code, TARGET, INFO_REQUEST, vi.fn()),
      ).rejects.toMatchObject({ code: 'REQUEST_COPY_WRONG_TYPE' });
      expect(canEditCopy(creator, code, TARGET, INFO_REQUEST)).toBe(false);
    },
  );
});

describe('canEditCopy', () => {
  it('needs the creator, a Draft request and the permission on the target', () => {
    const creator = access('creator', CODE, 'VIA_REQUEST');
    expect(canEditCopy(creator, CODE, TARGET, REQUEST)).toBe(true);
    expect(
      canEditCopy(access('other', CODE, 'VIA_REQUEST'), CODE, TARGET, REQUEST),
    ).toBe(false);
    expect(
      canEditCopy(creator, CODE, TARGET, {
        ...REQUEST,
        status: ChangeRequestStatus.PENDING_DIRECTOR,
      }),
    ).toBe(false);
    expect(
      canEditCopy(creator, CODE, { subjectGroupIds: ['x'] }, REQUEST),
    ).toBe(false);
  });
});

describe('toRequestRef', () => {
  it('hides the creator and keeps null', () => {
    expect(toRequestRef(null)).toBeNull();
    expect(toRequestRef(REQUEST)).toEqual({
      id: 'cr1',
      requestCode: 'DX-2026-0001',
      status: ChangeRequestStatus.DRAFT,
    });
  });
});
