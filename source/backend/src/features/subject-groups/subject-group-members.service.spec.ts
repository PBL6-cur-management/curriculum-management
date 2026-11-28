import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SubjectGroupMemberRole,
  SubjectGroupStatus,
  UserStatus,
} from '../../generated/prisma/client.js';
import { PrismaService } from '../../shared/prisma/prisma.service.js';
import { fromIsoDay } from '../../shared/time/today.js';
import type { AddSubjectGroupMemberDto } from './add-subject-group-member.dto.js';
import { SubjectGroupMembersService } from './subject-group-members.service.js';

const START = fromIsoDay('2026-01-01');
const END = fromIsoDay('2026-12-31');
const MID = '2026-06-30';
const MEMBER = {
  id: 'member',
  subjectGroupId: 'group',
  lecturerId: 'lecturer',
  memberRole: SubjectGroupMemberRole.MEMBER,
  validFrom: START,
  validTo: null,
  revokedAt: null,
  createdAt: START,
  lecturer: {
    id: 'lecturer',
    userCode: 'LECTURER',
    fullName: 'Lecturer',
    status: UserStatus.ACTIVE,
  },
  assignedBy: null,
  revokedBy: null,
};
const DTO = {
  lecturerId: MEMBER.lecturerId,
  memberRole: SubjectGroupMemberRole.MEMBER,
  validFrom: '2026-01-01',
} satisfies AddSubjectGroupMemberDto;

describe('SubjectGroupMembersService', () => {
  let group: ReturnType<typeof vi.fn>;
  let user: ReturnType<typeof vi.fn>;
  let findFirst: ReturnType<typeof vi.fn>;
  let findMany: ReturnType<typeof vi.fn>;
  let create: ReturnType<typeof vi.fn>;
  let update: ReturnType<typeof vi.fn>;
  let transaction: ReturnType<typeof vi.fn>;
  let service: SubjectGroupMembersService;

  beforeEach(() => {
    group = vi.fn().mockResolvedValue({
      id: 'group',
      groupCode: 'GROUP',
      status: SubjectGroupStatus.ACTIVE,
    });
    user = vi.fn().mockResolvedValue(MEMBER.lecturer);
    findFirst = vi.fn().mockResolvedValue(null);
    findMany = vi.fn().mockResolvedValue([]);
    create = vi
      .fn()
      .mockImplementation(({ data }) =>
        Promise.resolve({ ...MEMBER, ...data }),
      );
    update = vi
      .fn()
      .mockImplementation(({ where, data }) =>
        Promise.resolve({ ...MEMBER, id: where.id, ...data }),
      );
    const client = {
      subjectGroup: { findUnique: group },
      user: { findUnique: user },
      subjectGroupMember: { findFirst, findMany, create, update },
    };
    // The interactive form: the callback gets the same mocked client as its transaction.
    transaction = vi.fn(async (run: (tx: typeof client) => Promise<unknown>) =>
      run(client),
    );
    service = new SubjectGroupMembersService({
      ...client,
      $transaction: transaction,
    } as unknown as PrismaService);
  });

  it('rejects missing/inactive groups and disabled lecturers', async () => {
    group.mockResolvedValueOnce(null);
    await expect(service.add('group', DTO, 'actor')).rejects.toMatchObject({
      code: 'SUBJECT_GROUP_NOT_FOUND',
    });
    group.mockResolvedValueOnce({ status: SubjectGroupStatus.INACTIVE });
    await expect(service.add('group', DTO, 'actor')).rejects.toMatchObject({
      code: 'SUBJECT_GROUP_INACTIVE',
    });
    user.mockResolvedValue({ ...MEMBER.lecturer, status: UserStatus.DISABLED });
    await expect(service.add('group', DTO, 'actor')).rejects.toMatchObject({
      code: 'LECTURER_INVALID',
    });
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects duplicate open-ended rows and ignores revoked or non-overlapping periods', async () => {
    findFirst.mockResolvedValueOnce(MEMBER);
    await expect(service.add('group', DTO, 'actor')).rejects.toMatchObject({
      code: 'MEMBERSHIP_OVERLAP',
    });
    expect(findFirst).toHaveBeenCalledWith({
      where: {
        subjectGroupId: 'group',
        lecturerId: 'lecturer',
        memberRole: SubjectGroupMemberRole.MEMBER,
        revokedAt: null,
        OR: [{ validTo: null }, { validTo: { gte: START } }],
      },
    });
    await expect(service.add('group', DTO, 'actor')).resolves.toMatchObject({
      id: MEMBER.id,
    });
    await expect(
      service.add('group', { ...DTO, validFrom: '2027-01-01' }, 'actor'),
    ).resolves.toMatchObject({ validFrom: '2027-01-01' });
  });

  it('requires one membership covering the whole coordinator period', async () => {
    const dto = {
      ...DTO,
      memberRole: SubjectGroupMemberRole.COORDINATOR,
      validTo: MID,
    };
    await expect(service.add('group', dto, 'actor')).rejects.toMatchObject({
      code: 'COORDINATOR_NOT_MEMBER',
    });
    findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ ...MEMBER, validTo: END });
    await expect(service.add('group', dto, 'actor')).resolves.toMatchObject({
      memberRole: SubjectGroupMemberRole.COORDINATOR,
    });
    expect(findFirst).toHaveBeenLastCalledWith({
      where: {
        subjectGroupId: 'group',
        lecturerId: 'lecturer',
        memberRole: SubjectGroupMemberRole.MEMBER,
        revokedAt: null,
        validFrom: { lte: START },
        OR: [{ validTo: null }, { validTo: { gte: fromIsoDay(MID) } }],
      },
    });
  });

  it('requires an open membership for an open coordinator and allows several people', async () => {
    const dto = { ...DTO, memberRole: SubjectGroupMemberRole.COORDINATOR };
    await expect(service.add('group', dto, 'actor')).rejects.toMatchObject({
      code: 'COORDINATOR_NOT_MEMBER',
    });
    expect(findFirst).toHaveBeenLastCalledWith({
      where: {
        subjectGroupId: 'group',
        lecturerId: 'lecturer',
        memberRole: SubjectGroupMemberRole.MEMBER,
        revokedAt: null,
        validFrom: { lte: START },
        validTo: null,
      },
    });
    for (const lecturerId of ['lecturer', 'second']) {
      user.mockResolvedValue({ ...MEMBER.lecturer, id: lecturerId });
      findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ ...MEMBER, lecturerId });
      await expect(
        service.add('group', { ...dto, lecturerId }, 'actor'),
      ).resolves.toMatchObject({
        memberRole: SubjectGroupMemberRole.COORDINATOR,
      });
    }
  });

  it('rejects reversed ends and extensions, including an unchanged end', async () => {
    findFirst.mockResolvedValue(MEMBER);
    await expect(
      service.end('group', 'member', { validTo: '2025-12-31' }, 'actor'),
    ).rejects.toMatchObject({ code: 'VALIDITY_INVALID' });
    findFirst.mockResolvedValue({ ...MEMBER, validTo: fromIsoDay(MID) });
    for (const validTo of [MID, '2026-07-01'])
      await expect(
        service.end('group', 'member', { validTo }, 'actor'),
      ).rejects.toMatchObject({ code: 'END_DATE_NOT_EARLIER' });
  });

  it('atomically ends the membership and trims or revokes dependent coordinators', async () => {
    findFirst.mockResolvedValue(MEMBER);
    findMany.mockResolvedValue([
      {
        ...MEMBER,
        id: 'coordinator',
        memberRole: SubjectGroupMemberRole.COORDINATOR,
      },
      {
        ...MEMBER,
        id: 'future',
        memberRole: SubjectGroupMemberRole.COORDINATOR,
        validFrom: fromIsoDay('2026-07-01'),
      },
      {
        ...MEMBER,
        id: 'already-ended',
        memberRole: SubjectGroupMemberRole.COORDINATOR,
        validTo: fromIsoDay('2026-05-01'),
      },
    ]);
    const changed = await service.end(
      'group',
      'member',
      { validTo: MID },
      'actor',
    );
    expect(changed.map((row) => row.id)).toEqual([
      'member',
      'future',
      'coordinator',
    ]);
    expect(changed[0].validTo).toBe(MID);
    expect(changed[2].validTo).toBe(MID);
    expect(changed[1].state).toBe('REVOKED');
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledTimes(3);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'future' },
        data: { revokedAt: expect.any(Date), revokedById: 'actor' },
      }),
    );
  });

  it('refuses revoking a member with a non-revoked coordinator', async () => {
    findFirst.mockResolvedValue(MEMBER);
    findMany.mockResolvedValue([{ ...MEMBER, id: 'coordinator' }]);
    await expect(
      service.revoke('group', 'member', 'actor'),
    ).rejects.toMatchObject({ code: 'MEMBER_HAS_COORDINATOR' });
    expect(update).not.toHaveBeenCalled();
  });

  it('revokes a row and refuses repeated revocation or a row from another group', async () => {
    findFirst
      .mockResolvedValueOnce(MEMBER)
      .mockResolvedValueOnce({ ...MEMBER, revokedAt: START })
      .mockResolvedValueOnce(null);
    await expect(
      service.revoke('group', 'member', 'actor'),
    ).resolves.toMatchObject({ state: 'REVOKED' });
    await expect(
      service.revoke('group', 'member', 'actor'),
    ).rejects.toMatchObject({ code: 'MEMBER_ALREADY_REVOKED' });
    await expect(
      service.revoke('other-group', 'member', 'actor'),
    ).rejects.toMatchObject({ code: 'MEMBER_NOT_FOUND' });
    expect(findFirst).toHaveBeenLastCalledWith({
      where: { id: 'member', subjectGroupId: 'other-group' },
    });
  });

  it('returns an empty history for an unknown user', async () => {
    expect(await service.membershipsOf('missing')).toEqual([]);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { lecturerId: 'missing' },
        orderBy: { validFrom: 'desc' },
      }),
    );
  });

  it('promotes a non-member lecturer to coordinator in 1 step by creating both MEMBER and COORDINATOR rows', async () => {
    findFirst.mockResolvedValue(null);
    const promoted = await service.promoteCoordinator(
      'group',
      'lecturer',
      { validFrom: '2026-01-01' },
      'actor',
    );
    expect(promoted.memberRole).toBe(SubjectGroupMemberRole.COORDINATOR);
    expect(transaction).toHaveBeenCalledOnce();
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[0][0].data).toMatchObject({
      subjectGroupId: 'group',
      lecturerId: 'lecturer',
      memberRole: SubjectGroupMemberRole.MEMBER,
    });
    expect(create.mock.calls[1][0].data).toMatchObject({
      subjectGroupId: 'group',
      lecturerId: 'lecturer',
      memberRole: SubjectGroupMemberRole.COORDINATOR,
    });
  });

  it('promotes an existing covering member without duplicating the MEMBER row', async () => {
    findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(MEMBER);
    const promoted = await service.promoteCoordinator(
      'group',
      'lecturer',
      { validFrom: '2026-01-01' },
      'actor',
    );
    expect(promoted.memberRole).toBe(SubjectGroupMemberRole.COORDINATOR);
    expect(create).toHaveBeenCalledOnce();
    expect(create.mock.calls[0][0].data.memberRole).toBe(
      SubjectGroupMemberRole.COORDINATOR,
    );
  });

  it('demotes an active coordinator while keeping membership intact', async () => {
    findMany.mockResolvedValueOnce([
      {
        ...MEMBER,
        id: 'coord-past',
        memberRole: SubjectGroupMemberRole.COORDINATOR,
        validFrom: fromIsoDay('2025-01-01'),
      },
      {
        ...MEMBER,
        id: 'coord-future',
        memberRole: SubjectGroupMemberRole.COORDINATOR,
        validFrom: fromIsoDay('2099-01-01'),
      },
    ]);
    const demoted = await service.demoteCoordinator(
      'group',
      'lecturer',
      {},
      'actor',
    );
    expect(demoted).toHaveLength(2);
    expect(demoted[0].state).toBe('EXPIRED');
    expect(demoted[1].state).toBe('REVOKED');
    await expect(
      service.demoteCoordinator('group', 'lecturer', {}, 'actor'),
    ).rejects.toMatchObject({ code: 'MEMBER_NOT_FOUND' });
  });
});
