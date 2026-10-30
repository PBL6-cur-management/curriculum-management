import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import * as api from './graduation';
import type {
  GraduationOutcome,
  GraduationResult,
  GraduationItemQuery,
  GraduationExportFilters,
} from '../schema/graduation';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
const lookup = {
  studentId: 'student/one',
  programId: 'program & one',
  semesterId: 'semester/one',
};
function stubJson() {
  const fetchMock = vi.fn(
    async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(JSON.stringify({ synthetic: true }), { status: 200 }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}
describe('graduation generated adapters', () => {
  it('uses discriminated wire branches, literal shortfall codes and nullable minima', () => {
    expectTypeOf<
      Extract<GraduationOutcome, { status: 'CANNOT_AUDIT' }>['result']
    >().toEqualTypeOf<null>();
    expectTypeOf<
      Extract<GraduationOutcome, { status: 'REVIEWED' }>['result']
    >().toEqualTypeOf<GraduationResult>();
    expectTypeOf<
      GraduationResult['credits']['recognizedTotal']
    >().toEqualTypeOf<string>();
    expectTypeOf<
      GraduationResult['electiveGroups'][number]['requiredCredits']
    >().toEqualTypeOf<string | null>();
    expectTypeOf<
      Extract<GraduationResult['shortfalls'][number]['code'], 'OBSOLETE'>
    >().toEqualTypeOf<never>();
    expectTypeOf<GraduationExportFilters>().toEqualTypeOf<
      Pick<GraduationItemQuery, 'q' | 'outcome' | 'conclusion'>
    >();
  });
  it.each([
    {
      run: () => api.fetchGraduation(lookup),
      path: '/api/students/student%2Fone/graduation?programId=program+%26+one&semesterId=semester%2Fone',
    },
    {
      run: () => api.fetchGraduationHistory(lookup, { page: 2, pageSize: 10 }),
      path: '/api/students/student%2Fone/graduation-audits?programId=program+%26+one&semesterId=semester%2Fone&page=2&pageSize=10',
    },
    {
      run: () => api.fetchGraduationAudit('audit/one'),
      path: '/api/graduation-audits/audit%2Fone',
    },
    {
      run: () => api.fetchGraduationPrograms('semester/one'),
      path: '/api/graduation/program-options?semesterId=semester%2Fone',
    },
    {
      run: () =>
        api.fetchGraduationStudents({
          programId: 'p',
          semesterId: 's',
          q: 'Tên & mã',
          page: 2,
          pageSize: 10,
        }),
      path: '/api/graduation/student-options?programId=p&semesterId=s&q=T%C3%AAn+%26+m%C3%A3&page=2&pageSize=10',
    },
    {
      run: () => api.fetchGraduationTasks(lookup, { page: 1, pageSize: 20 }),
      path: '/api/students/student%2Fone/graduation-reaudit-tasks?programId=program+%26+one&semesterId=semester%2Fone&page=1&pageSize=20',
    },
    {
      run: () => api.fetchGraduationBatches({ page: 3, pageSize: 50 }),
      path: '/api/graduation-batches?page=3&pageSize=50',
    },
    {
      run: () => api.fetchGraduationBatch('batch/one'),
      path: '/api/graduation-batches/batch%2Fone',
    },
    {
      run: () =>
        api.fetchGraduationItems('batch/one', {
          q: 'SYN & 1',
          outcome: 'ERROR',
          page: 2,
          pageSize: 10,
        }),
      path: '/api/graduation-batches/batch%2Fone/items?q=SYN+%26+1&outcome=ERROR&page=2&pageSize=10',
    },
  ])('encodes the complete read URL $path', async ({ run, path }) => {
    const fetchMock = stubJson();
    await run();
    expect(fetchMock).toHaveBeenCalledWith(
      path,
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          'X-Requested-With': 'XMLHttpRequest',
        }),
      }),
    );
  });
  it('sends exactly the generated save body and retains an explicit replay key', async () => {
    const fetchMock = stubJson();
    await api.saveGraduation(lookup, 'same-key');
    await api.saveGraduation(lookup, 'same-key');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    for (const call of vi.mocked(fetch).mock.calls)
      expect(call[1]).toMatchObject({
        method: 'POST',
        body: JSON.stringify({
          programId: lookup.programId,
          semesterId: lookup.semesterId,
          requestKey: 'same-key',
        }),
        headers: expect.objectContaining({
          'X-Requested-With': 'XMLHttpRequest',
        }),
      });
  });
  it('keeps preview, creation and retry as separate explicit POST operations', async () => {
    const fetchMock = stubJson();
    await api.previewGraduationBatch({ semesterId: 's', programId: 'p' });
    await api.createGraduationBatch({
      semesterId: 's',
      programId: 'p',
      previewRevision: 'a'.repeat(64),
      requestKey: 'key',
    });
    await api.retryGraduationTask('task/one');
    expect(fetchMock.mock.calls.map((call) => String(call[0]))).toEqual([
      '/api/graduation-batches/preview',
      '/api/graduation-batches',
      '/api/graduation-reaudit-tasks/task%2Fone/retry',
    ]);
    expect(vi.mocked(fetch).mock.calls[2][1]?.body).toBeUndefined();
  });
  it('downloads only committed filters, preserves the server filename and revokes its object URL', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response('synthetic workbook', {
          headers: {
            'Content-Disposition': "attachment; filename*=UTF-8''ket-qua.xlsx",
          },
        }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const create = vi.fn(() => 'blob:synthetic');
    const revoke = vi.fn();
    class DownloadUrl extends URL {
      static createObjectURL = create;
      static revokeObjectURL = revoke;
    }
    vi.stubGlobal('URL', DownloadUrl);
    let filename = '';
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      filename = this.download;
    });
    await api.downloadGraduationBatch('batch/one', {
      q: 'SYN & 1',
      outcome: 'ERROR',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/graduation-batches/batch%2Fone/export?q=SYN+%26+1&outcome=ERROR',
      expect.any(Object),
    );
    expect(filename).toBe('ket-qua.xlsx');
    expect(revoke).toHaveBeenCalledWith('blob:synthetic');
  });
  it('surfaces JSON and export transport errors instead of inventing a conclusion', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              code: 'GRADUATION_ACCESS_REVOKED',
              message: 'Quyền đã thay đổi.',
            }),
            { status: 403 },
          ),
      ),
    );
    await expect(api.fetchGraduation(lookup)).rejects.toMatchObject({
      status: 403,
      code: 'GRADUATION_ACCESS_REVOKED',
    });
    await expect(
      api.downloadGraduationBatch('batch', {}),
    ).rejects.toMatchObject({ status: 403 });
  });
});
