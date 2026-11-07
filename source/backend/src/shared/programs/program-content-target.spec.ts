import { describe, expect, it, vi } from 'vitest';
import { ProgramVersionStatus } from '../../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { programContentTarget } from './program-content-target.js';

describe('programContentTarget', () => {
  const findMany = vi.fn();
  const db = { curriculumItem: { findMany } } as unknown as PrismaService;
  const program = { id: 'p1', facultyId: 'f1' };

  it('adds the distinct groups of in-force, non-copy versions to the programme scope', async () => {
    findMany.mockResolvedValue([
      { course: { ownerGroupId: 'g1' } },
      { course: { ownerGroupId: 'g2' } },
      { course: { ownerGroupId: 'g1' } },
      { course: { ownerGroupId: null } },
    ]);
    const target = await programContentTarget(db, program);
    expect(target).toEqual({
      programIds: ['p1'],
      orgUnitIds: ['f1'],
      subjectGroupIds: ['g1', 'g2'],
    });
    expect(findMany.mock.calls[0][0].where).toMatchObject({
      version: {
        programId: 'p1',
        sourceRequestId: null,
        status: {
          in: [ProgramVersionStatus.ACTIVE, ProgramVersionStatus.PENDING],
        },
      },
      course: { ownerGroupId: { not: null } },
    });
  });

  it('keeps only the programme scope when no course has a group', async () => {
    findMany.mockResolvedValue([]);
    const target = await programContentTarget(db, program);
    expect(target.subjectGroupIds).toEqual([]);
  });
});
