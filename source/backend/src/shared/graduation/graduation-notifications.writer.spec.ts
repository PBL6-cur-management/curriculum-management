import { Logger } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Prisma } from '../../generated/prisma/client.js';
import { activeAcademicOfficeWhere } from '../change-requests/academic-office.js';
import { GraduationNotificationsWriter } from './graduation-notifications.writer.js';
import type { GraduationContextValue } from './graduation.types.js';

const context: GraduationContextValue = {
  studentId: 'student-synthetic',
  studentCode: '000123',
  fullName: 'Sinh viên tổng hợp',
  programId: 'program-synthetic',
  programCode: 'SYN-P',
  programName: 'Chương trình tổng hợp',
  semesterId: 'semester-synthetic',
  semesterCode: 'SYN-2026-1',
  semesterStartDate: '2026-09-01',
  enrollmentId: 'enrollment-synthetic',
  cohortId: 'cohort-synthetic',
  cohortCode: 'SYN-C',
  programVersionId: 'version-synthetic',
  versionNumber: '1.0',
  versionSource: 'COHORT',
  cohortAssignmentId: 'assignment-synthetic',
};

describe('GraduationNotificationsWriter', () => {
  const findMany = vi.fn();
  const createMany = vi.fn();
  const tx = {
    roleAssignment: { findMany },
    notification: { createMany },
  } as unknown as Prisma.TransactionClient;
  const input = {
    auditId: 'audit-synthetic',
    context,
    previous: 'ELIGIBLE' as const,
    next: 'NOT_ELIGIBLE' as const,
  };
  let writer: GraduationNotificationsWriter;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-30T18:00:00.000Z'));
    findMany.mockReset().mockResolvedValue([{ userId: 'office-synthetic' }]);
    createMany.mockReset().mockResolvedValue({ count: 1 });
    writer = new GraduationNotificationsWriter();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('uses the caller transaction and the current Vietnamese day for active R1 holders', async () => {
    await expect(writer.conclusionChanged(tx, input)).resolves.toBe(1);
    expect(findMany).toHaveBeenCalledExactlyOnceWith({
      where: activeAcademicOfficeWhere(new Date('2026-10-31T00:00:00.000Z')),
      select: { userId: true },
    });
    expect(findMany.mock.calls[0][0].where).toMatchObject({
      revokedAt: null,
      role: { roleCode: 'R1' },
      user: { status: 'ACTIVE' },
      validFrom: { lte: new Date('2026-10-31T00:00:00.000Z') },
      OR: [
        { validTo: null },
        { validTo: { gte: new Date('2026-10-31T00:00:00.000Z') } },
      ],
    });
  });

  it('deduplicates assignments without excluding the historical initiating R1', async () => {
    findMany.mockResolvedValue([
      { userId: 'office-synthetic' },
      { userId: 'office-synthetic' },
      { userId: 'historical-initiator-synthetic' },
    ]);
    createMany.mockResolvedValue({ count: 2 });
    await expect(writer.conclusionChanged(tx, input)).resolves.toBe(2);
    expect(
      createMany.mock.calls[0][0].data.map(
        (row: { recipientId: string }) => row.recipientId,
      ),
    ).toEqual(['office-synthetic', 'historical-initiator-synthetic']);
  });

  it('snapshots the precise contextual conclusion change without an actor or request link', async () => {
    await writer.conclusionChanged(tx, input);
    expect(createMany).toHaveBeenCalledExactlyOnceWith({
      data: [
        {
          recipientId: 'office-synthetic',
          notificationType: 'GRADUATION_CONCLUSION_CHANGED',
          changeRequestId: null,
          content:
            'Kết luận tốt nghiệp của sinh viên 000123 — Sinh viên tổng hợp, chương trình SYN-P, học kỳ SYN-2026-1 đã đổi từ “Đủ điều kiện” sang “Chưa đủ điều kiện”.',
        },
      ],
    });
  });

  it('labels the reverse conclusion change correctly', async () => {
    await writer.conclusionChanged(tx, {
      ...input,
      previous: 'NOT_ELIGIBLE',
      next: 'ELIGIBLE',
    });
    expect(createMany.mock.calls[0][0].data[0].content).toContain(
      'từ “Chưa đủ điều kiện” sang “Đủ điều kiện”',
    );
  });

  it.each(['ELIGIBLE', 'NOT_ELIGIBLE'] as const)(
    'does not query or insert when the conclusion remains %s',
    async (conclusion) => {
      await expect(
        writer.conclusionChanged(tx, {
          ...input,
          previous: conclusion,
          next: conclusion,
        }),
      ).resolves.toBe(0);
      expect(findMany).not.toHaveBeenCalled();
      expect(createMany).not.toHaveBeenCalled();
    },
  );

  it('logs a zero-recipient count without student identifiers', async () => {
    findMany.mockResolvedValue([]);
    const warn = vi
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    await expect(writer.conclusionChanged(tx, input)).resolves.toBe(0);
    expect(createMany).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledExactlyOnceWith(
      'Không có người nhận thông báo đổi kết luận tốt nghiệp: 0.',
    );
  });

  it('logs an inserted count of zero rather than claiming delivery', async () => {
    createMany.mockResolvedValue({ count: 0 });
    const warn = vi
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    await expect(writer.conclusionChanged(tx, input)).resolves.toBe(0);
    expect(warn).toHaveBeenCalledExactlyOnceWith(
      'Số thông báo đổi kết luận tốt nghiệp được ghi: 0.',
    );
  });

  it('propagates insertion failure so the caller rolls back the audit and task', async () => {
    const failure = new Error('Synthetic transaction write failure');
    createMany.mockRejectedValue(failure);
    await expect(writer.conclusionChanged(tx, input)).rejects.toBe(failure);
    expect(createMany).toHaveBeenCalledTimes(1);
  });

  it('propagates recipient lookup failure without inserting notices', async () => {
    const failure = new Error('Synthetic role lookup failure');
    findMany.mockRejectedValue(failure);
    await expect(writer.conclusionChanged(tx, input)).rejects.toBe(failure);
    expect(createMany).not.toHaveBeenCalled();
  });
});
