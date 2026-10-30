import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { batch, json, renderImport } from '../testFixtures';
import { ImportPage } from './ImportPage';

afterEach(() => vi.unstubAllGlobals());
function setup(
  options: {
    types?: unknown[];
    status?: number;
    batchStatus?: 'VALIDATING' | 'DRY_RUN' | 'ABORTED';
  } = {},
) {
  let reads = 0;
  const fetchMock = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input);
      if (path.endsWith('/imports/types'))
        return json(
          options.types ?? [
            { importType: 'COURSE_CATALOG', needsVersion: false },
          ],
        );
      if (path.endsWith('/imports/curriculum-targets'))
        return json([
          {
            versionId: 'v1',
            programId: 'p1',
            programCode: 'CT01',
            programName: 'Chương trình thử',
          },
        ]);
      if (path.endsWith('/imports/b1/commit'))
        return json(batch({ status: 'COMMITTING', canCommit: false }));
      if (path.endsWith('/imports/b1')) {
        reads++;
        return json(batch({ status: reads > 1 ? 'COMMITTED' : 'DRY_RUN' }));
      }
      if (path.endsWith('/imports') && init?.method === 'POST')
        return options.status
          ? json(
              { message: 'Thiếu cột Học kỳ.', code: 'IMPORT_HEADER_INVALID' },
              options.status,
            )
          : json(batch({ status: options.batchStatus ?? 'DRY_RUN' }));
      return json({});
    },
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}
async function upload(file = new File(['sheet'], 'Khung.xlsx')) {
  await screen.findByRole('button', { name: 'Chọn tệp Excel' });
  const input = document.querySelector('input[type=file]');
  if (!input) throw new Error('Thiếu ô chọn tệp.');
  fireEvent.change(input, { target: { files: [file] } });
  if (file.name.endsWith('.xlsx') && file.size <= 5 * 1024 * 1024)
    await screen.findByText(file.name);
}
describe('ImportPage', () => {
  it.each(['STUDENT_LIST', 'ACADEMIC_RESULT'] as const)(
    'uploads %s without a version and invalidates student/user roots once',
    async (importType) => {
      let committed = false;
      const wave = (status: 'DRY_RUN' | 'COMMITTED') =>
        batch({
          importType,
          program: null,
          versionId: null,
          status,
          canCommit: status === 'DRY_RUN',
        });
      const fetchMock = vi.fn(
        async (input: RequestInfo | URL, init?: RequestInit) => {
          const path = String(input);
          if (path.endsWith('/auth/me'))
            return json({
              roles: [{ roleCode: 'R1' }],
              permissions: ['data.importExcel'],
            });
          if (path.endsWith('/imports/types'))
            return json([{ importType, needsVersion: false }]);
          if (path.endsWith('/student-credentials'))
            return json({
              available: false,
              accountCount: 0,
              expiresAt: null,
              downloadedAt: null,
            });
          if (path.endsWith('/commit')) {
            committed = true;
            return json(wave('COMMITTED'));
          }
          if (init?.method === 'POST') return json(wave('DRY_RUN'));
          return json(wave(committed ? 'COMMITTED' : 'DRY_RUN'));
        },
      );
      vi.stubGlobal('fetch', fetchMock);
      const { client } = renderImport(
        <ImportPage />,
        `/imports?type=${importType}`,
      );
      const invalidate = vi.spyOn(client, 'invalidateQueries');
      await upload(new File(['synthetic'], 'Tong-hop.xlsx'));
      expect(
        screen.queryByLabelText('Bản nháp chương trình'),
      ).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Chạy thử' }));
      fireEvent.click(
        await screen.findByRole('button', { name: 'Xác nhận nhập' }),
      );
      fireEvent.click(
        await screen.findByRole('button', { name: 'Ghi dữ liệu' }),
      );
      await screen.findByText('Đã ghi', { exact: true });
      const form = fetchMock.mock.calls.find(
        ([path, init]) =>
          String(path).endsWith('/imports') && init?.method === 'POST',
      )?.[1]?.body;
      expect(form).toBeInstanceOf(FormData);
      if (!(form instanceof FormData)) throw new Error('Thiếu form');
      expect(form.get('importType')).toBe(importType);
      expect(form.has('versionId')).toBe(false);
      await waitFor(() =>
        expect(
          invalidate.mock.calls.filter(
            ([options]) => JSON.stringify(options?.queryKey) === '["students"]',
          ),
        ).toHaveLength(1),
      );
      expect(
        invalidate.mock.calls.filter(
          ([options]) => JSON.stringify(options?.queryKey) === '["users"]',
        ),
      ).toHaveLength(1);
    },
  );
  it('resets a crafted student type to the server-authorized catalog before template download', async () => {
    const fetchMock = setup();
    vi.stubGlobal(
      'URL',
      class extends URL {
        static createObjectURL = vi.fn(() => 'blob:synthetic');
        static revokeObjectURL = vi.fn();
      },
    );
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    renderImport(<ImportPage />, '/imports?type=STUDENT_LIST');
    fireEvent.click(await screen.findByRole('button', { name: 'Tải tệp mẫu' }));
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([path]) =>
          String(path).includes('/templates/COURSE_CATALOG'),
        ),
      ).toBe(true),
    );
    expect(
      fetchMock.mock.calls.some(([path]) =>
        String(path).includes('/templates/STUDENT_LIST'),
      ),
    ).toBe(false);
    click.mockRestore();
  });
  it('offers only types returned by the server and explains an empty result', async () => {
    setup({ types: [] });
    renderImport(<ImportPage />);
    expect(
      await screen.findByText('Bạn chưa có loại dữ liệu nào được phép nhập.'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Chạy thử' }),
    ).not.toBeInTheDocument();
  });
  it('rejects non-xlsx and oversized uploads before sending a request', async () => {
    const fetchMock = setup();
    renderImport(<ImportPage />);
    await upload(new File(['wrong'], 'wrong.csv'));
    expect(
      await screen.findByText('Chỉ nhận tệp Excel (.xlsx).'),
    ).toBeInTheDocument();
    await upload(new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'large.xlsx'));
    expect(
      await screen.findByText('Tệp Excel không được lớn hơn 5 MB.'),
    ).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some(([, init]) => init?.method === 'POST'),
    ).toBe(false);
  });
  it('uploads multipart, confirms explicitly and follows the committed batch', async () => {
    const fetchMock = setup();
    const { client } = renderImport(<ImportPage />);
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    await upload();
    fireEvent.click(screen.getByRole('button', { name: 'Chạy thử' }));
    const confirm = await screen.findByRole('button', {
      name: 'Xác nhận nhập',
    });
    const call = fetchMock.mock.calls.find(
      ([, init]) => init?.method === 'POST',
    );
    const form = call?.[1]?.body;
    expect(form).toBeInstanceOf(FormData);
    if (!(form instanceof FormData)) throw new Error('Thiếu multipart form.');
    expect(form.get('importType')).toBe('COURSE_CATALOG');
    expect(
      fetchMock.mock.calls.some(([path]) => String(path).endsWith('/commit')),
    ).toBe(false);
    fireEvent.click(confirm);
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Ghi 2 dòng vào CT01');
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Ghi dữ liệu' }),
    );
    expect(
      await screen.findByText('Đã ghi', {}, { timeout: 6000 }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Xác nhận nhập' }),
    ).toBeDisabled();
    await waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ['curriculum'] }),
    );
    const finalCount = fetchMock.mock.calls.length;
    await new Promise((resolve) => setTimeout(resolve, 1700));
    expect(fetchMock.mock.calls).toHaveLength(finalCount);
  }, 12000);
  it('prints the synchronous backend header error rather than a success report', async () => {
    setup({ status: 400 });
    renderImport(<ImportPage />);
    await upload();
    fireEvent.click(screen.getByRole('button', { name: 'Chạy thử' }));
    expect(await screen.findByText('Thiếu cột Học kỳ.')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Xác nhận nhập' }),
    ).not.toBeInTheDocument();
  });
  it('preselects the curriculum target from the URL and sends the version id', async () => {
    const fetchMock = setup({
      types: [{ importType: 'CURRICULUM', needsVersion: true }],
    });
    renderImport(<ImportPage />, '/imports?type=CURRICULUM&versionId=v1');
    await screen.findByText('CT01 — Chương trình thử');
    await upload();
    fireEvent.click(screen.getByRole('button', { name: 'Chạy thử' }));
    await screen.findByRole('button', { name: 'Xác nhận nhập' });
    const body = fetchMock.mock.calls.find(
      ([, init]) => init?.method === 'POST',
    )?.[1]?.body;
    if (!(body instanceof FormData)) throw new Error('Thiếu multipart form.');
    expect(body.get('versionId')).toBe('v1');
  });
});
