import {
  AccessContext,
  type ActiveAssignment,
} from '../../shared/authz/access-context.js';
import { PERMISSIONS } from '../../shared/authz/permission-codes.js';
import { EligibilityStudentsQueryDto } from './dto/registration-eligibility-query.dto.js';
import { EligibilityStudentsService } from './eligibility-students.service.js';

function actor(roleCode: string, programs: string[] = []) {
  return new AccessContext('actor', [
    {
      assignmentId: 'assignment',
      roleId: roleCode,
      roleName: roleCode,
      scopeSource: 'NONE',
      scopeType: 'SYSTEM',
      scopeUnit: null,
      roleCode,
      permissions: new Map([
        [
          PERMISSIONS.STUDENT_VIEW_REGISTRATION_ELIGIBILITY,
          { mode: 'DIRECT', scope: 'ALL' },
        ],
      ]),
      scope:
        roleCode === 'R1'
          ? { all: true }
          : {
              all: false,
              programIds: new Set(programs),
              studentIds: new Set(),
              subjectGroupIds: new Set(),
              orgUnitIds: new Set(),
            },
    } satisfies ActiveAssignment,
  ]);
}
function fixture() {
  const db = {
    semester: {
      findUnique: vi
        .fn()
        .mockResolvedValue({ id: 's', startDate: new Date('2026-01-01') }),
    },
    program: { findUnique: vi.fn().mockResolvedValue({ id: 'p' }) },
    student: {
      findMany: vi
        .fn()
        .mockResolvedValue([
          { id: 'student', studentCode: 'SYN', fullName: 'Synthetic' },
        ]),
      count: vi.fn().mockResolvedValue(1),
    },
  };
  const prisma = {
    $transaction: vi.fn((read: (tx: typeof db) => unknown) => read(db)),
  };
  const service = new EligibilityStudentsService(prisma as never);
  const query = Object.assign(new EligibilityStudentsQueryDto(), {
    semesterId: 's',
    q: ' SYN ',
  });
  return { service, query, db, prisma };
}
describe('eligibility scoped student picker', () => {
  it('uses the same scoped temporal search predicate for count and page', async () => {
    const test = fixture();
    const result = await test.service.list('p', test.query, actor('R3', ['p']));
    const where = test.db.student.findMany.mock.calls[0][0].where;
    expect(test.db.student.count).toHaveBeenCalledWith({ where });
    expect(JSON.stringify(where)).toContain('SYN');
    expect(JSON.stringify(where)).toContain('untilSemester');
    expect(result).toMatchObject({ total: 1, page: 1, pageSize: 20 });
    expect(test.db.student.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: { id: true, studentCode: true, fullName: true },
        orderBy: [{ fullName: 'asc' }, { id: 'asc' }],
      }),
    );
  });
  it('denies R6 before any directory query', async () => {
    const test = fixture();
    await expect(
      test.service.list('p', test.query, actor('R6')),
    ).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    expect(test.prisma.$transaction).not.toHaveBeenCalled();
  });
  it('rejects a named program outside the director scope', async () => {
    const test = fixture();
    await expect(
      test.service.list('p', test.query, actor('R3', ['other'])),
    ).rejects.toMatchObject({ code: 'OUT_OF_SCOPE' });
    expect(test.prisma.$transaction).not.toHaveBeenCalled();
  });
});
