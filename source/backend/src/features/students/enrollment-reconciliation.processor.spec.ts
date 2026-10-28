import type { PrismaService } from '../../shared/prisma/prisma.service.js';
import type { EnrollmentReconciler } from '../../shared/students/enrollment-reconciler.js';
import { EnrollmentReconciliationProcessor } from './enrollment-reconciliation.processor.js';

function build(reconcileProgram: ReturnType<typeof vi.fn>) {
  const findMany = vi
    .fn()
    .mockResolvedValue([{ programId: 'p1' }, { programId: 'p2' }]);
  const processor = new EnrollmentReconciliationProcessor(
    { programEnrollment: { findMany } } as unknown as PrismaService,
    { reconcileProgram } as unknown as EnrollmentReconciler,
  );
  return { processor, findMany };
}
const counts = { transitioned: 1, unchanged: 2, blocked: 0 };

describe('EnrollmentReconciliationProcessor', () => {
  it('reconciles every program with an open enrollment and sums the counts', async () => {
    const reconcileProgram = vi.fn().mockResolvedValue(counts);
    const { processor } = build(reconcileProgram);
    await expect(processor.reconcile()).resolves.toEqual({
      transitioned: 2,
      unchanged: 4,
      blocked: 0,
    });
    expect(reconcileProgram).toHaveBeenCalledTimes(2);
  });

  it('reconciles only the named program', async () => {
    const reconcileProgram = vi.fn().mockResolvedValue(counts);
    const { processor, findMany } = build(reconcileProgram);
    await processor.process({
      name: 'reconcile-enrollments',
      data: { programId: 'p9' },
    });
    expect(findMany).not.toHaveBeenCalled();
    expect(reconcileProgram).toHaveBeenCalledWith('p9');
  });

  it('keeps going after a failing program, then fails the job for a retry', async () => {
    const reconcileProgram = vi
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValue(counts);
    const { processor } = build(reconcileProgram);
    await expect(processor.reconcile()).rejects.toThrow(/p1/);
    expect(reconcileProgram).toHaveBeenCalledTimes(2);
  });

  it('ignores a job of another name', async () => {
    const reconcileProgram = vi.fn();
    const { processor } = build(reconcileProgram);
    await processor.process({ name: 'other' });
    expect(reconcileProgram).not.toHaveBeenCalled();
  });
});
