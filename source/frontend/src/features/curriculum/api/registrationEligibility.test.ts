import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fetchEligibilityStudents,
  fetchRegistrationEligibility,
} from './registrationEligibility';
import { eligibilityAnswerFixture } from '../eligibilityTestFixtures';

afterEach(() => vi.unstubAllGlobals());
describe('eligibility API adapters', () => {
  it('encodes the full explicit context without a version override', async () => {
    const answer = eligibilityAnswerFixture();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify(answer))),
    );
    expect(
      await fetchRegistrationEligibility({
        studentId: 's/a',
        programId: 'p & b',
        semesterId: 's 1',
      }),
    ).toEqual(answer);
    expect(fetch).toHaveBeenCalledWith(
      '/api/students/s%2Fa/registration-eligibility?programId=p+%26+b&semesterId=s+1',
      expect.any(Object),
    );
  });
  it('sends scoped search and pagination, and preserves API refusals', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ code: 'OUT_OF_SCOPE', message: 'Ngoài phạm vi.' }),
            { status: 403 },
          ),
        ),
    );
    await expect(
      fetchEligibilityStudents({
        programId: 'p/a',
        semesterId: 's',
        q: 'SYN &',
        page: 2,
        pageSize: 20,
      }),
    ).rejects.toMatchObject({ status: 403, code: 'OUT_OF_SCOPE' });
    expect(fetch).toHaveBeenCalledWith(
      '/api/programs/p%2Fa/registration-eligibility/students?semesterId=s&q=SYN+%26&page=2&pageSize=20',
      expect.any(Object),
    );
  });
});
