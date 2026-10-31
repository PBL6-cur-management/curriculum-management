import { ApprovalDelegationStatus } from '../../generated/prisma/client.js';
import { derivedStatus } from '../approval-delegations/approval-delegations.service.js';
import { subjectOf } from './email-pump.service.js';
import { reminderCycle } from './reminder-rules.js';

describe('reminderCycle (US-116)', () => {
  it('is silent up to and including the limit, then counts cycles of repeatDays', () => {
    expect(reminderCycle(0, 7, 3)).toBeNull();
    expect(reminderCycle(7, 7, 3)).toBeNull();
    expect(reminderCycle(8, 7, 3)).toBe(0);
    expect(reminderCycle(10, 7, 3)).toBe(0);
    expect(reminderCycle(11, 7, 3)).toBe(1);
    // After downtime only the latest cycle is due, not every missed one.
    expect(reminderCycle(40, 7, 3)).toBe(10);
  });
});

describe('subjectOf (US-115)', () => {
  it('prefixes the first line and cuts long content', () => {
    expect(subjectOf('Đề xuất DX-1 chờ bạn duyệt\nchi tiết')).toBe(
      '[CTĐT] Đề xuất DX-1 chờ bạn duyệt',
    );
    const long = subjectOf('x'.repeat(300));
    expect(long).toHaveLength(120);
    expect(long.endsWith('…')).toBe(true);
  });
});

describe('derivedStatus (US-114 AC4)', () => {
  const today = new Date('2026-10-31T00:00:00Z');
  it('reads an active grant past its last day as expired before the nightly job runs', () => {
    const active = ApprovalDelegationStatus.ACTIVE;
    expect(
      derivedStatus(
        { status: active, validTo: new Date('2026-10-30T00:00:00Z') },
        today,
      ),
    ).toBe(ApprovalDelegationStatus.EXPIRED);
    expect(derivedStatus({ status: active, validTo: today }, today)).toBe(
      active,
    );
    expect(
      derivedStatus(
        {
          status: ApprovalDelegationStatus.REVOKED,
          validTo: new Date('2020-01-01T00:00:00Z'),
        },
        today,
      ),
    ).toBe(ApprovalDelegationStatus.REVOKED);
  });
});
