import { Prisma } from '../../generated/prisma/client.js';
import { AccessContext } from '../authz/access-context.js';
import { readEligibilityContext } from './eligibility-context.reader.js';
import { eligibilityFixture } from './eligibility.test-fixtures.js';
import { RegistrationEligibilityReader } from './registration-eligibility.reader.js';

vi.mock('./eligibility-context.reader.js');
describe('authorized registration eligibility reader', () => {
  function fixture() {
    const context = eligibilityFixture();
    const tx = {} as Prisma.TransactionClient;
    const prisma = {
      $transaction: vi.fn((read: (db: Prisma.TransactionClient) => unknown) =>
        read(tx),
      ),
    };
    const resolveForStudent = vi.fn().mockResolvedValue(context.resolution);
    const forStudent = vi.fn().mockResolvedValue([]);
    const versions = {
      forAccess: vi.fn().mockReturnValue({ resolveForStudent }),
    };
    const results = { forAccess: vi.fn().mockReturnValue({ forStudent }) };
    vi.mocked(readEligibilityContext).mockResolvedValue(context);
    const reader = new RegistrationEligibilityReader(
      prisma as never,
      versions as never,
      results as never,
      { get: () => 20 } as never,
    );
    const access = new AccessContext('actor', []);
    const input = {
      studentId: 'student',
      programId: 'program',
      semesterId: 'semester',
    };
    return {
      reader,
      access,
      input,
      tx,
      prisma,
      versions,
      results,
      resolveForStudent,
      forStudent,
    };
  }
  it('binds both F-17 readers to the actor and ELIGIBILITY purpose in one repeatable snapshot', async () => {
    const test = fixture();
    const answer = await test.reader
      .forAccess(test.access)
      .evaluate(test.input);
    expect(test.prisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: 'RepeatableRead' },
    );
    expect(test.versions.forAccess).toHaveBeenCalledWith(
      test.access,
      'ELIGIBILITY',
    );
    expect(test.results.forAccess).toHaveBeenCalledWith(
      test.access,
      'ELIGIBILITY',
    );
    expect(test.resolveForStudent).toHaveBeenCalledWith(test.input, test.tx);
    expect(test.forStudent).toHaveBeenCalledWith(test.input, test.tx);
    expect(answer.context.programVersionId).toBe('version');
    expect(Number.isNaN(Date.parse(answer.evaluatedAt))).toBe(false);
  });
  it('reuses a supplied transaction without opening another', async () => {
    const test = fixture();
    await test.reader.forAccess(test.access).evaluate(test.input, test.tx);
    expect(test.prisma.$transaction).not.toHaveBeenCalled();
    expect(readEligibilityContext).toHaveBeenCalledWith(
      test.tx,
      expect.objectContaining({ programVersionId: 'version' }),
      [],
    );
  });
  it('propagates authorization or assignment failures unchanged before reading other facts', async () => {
    const test = fixture();
    const error = new Error('scoped subject unavailable');
    test.resolveForStudent.mockRejectedValue(error);
    await expect(
      test.reader.forAccess(test.access).evaluate(test.input),
    ).rejects.toBe(error);
    expect(test.forStudent).not.toHaveBeenCalled();
  });
});
