import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { batch, json, renderImport } from '../testFixtures';
import { ImportHistoryPage } from './ImportHistoryPage';
import { ImportDetailPage } from './ImportDetailPage';

afterEach(() => vi.unstubAllGlobals());
vi.mock('../hooks/useImports', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../hooks/useImports')>()),
  useImportTypes: () => ({
    data: [{ importType: 'CURRICULUM', needsVersion: true }],
  }),
}));
describe('ImportHistoryPage', () => {
  it('polls a validating history row until dry-run and displays three statuses', async () => {
    let reads = 0;
    const fetchMock = vi.fn(async () => {
      reads++;
      return json({
        items: [
          batch({ status: reads === 1 ? 'VALIDATING' : 'DRY_RUN' }),
          batch({ id: 'b2', fileName: 'Da-ghi.xlsx', status: 'COMMITTED' }),
          batch({ id: 'b3', fileName: 'Loi.xlsx', status: 'ABORTED' }),
        ],
        total: 3,
        page: 1,
        pageSize: 20,
      });
    });
    vi.stubGlobal('fetch', fetchMock);
    renderImport(<ImportHistoryPage />, '/imports/history', '/imports/history');
    expect(await screen.findByText('Đang chạy thử')).toBeInTheDocument();
    expect(screen.getByText('Đã ghi')).toBeInTheDocument();
    expect(screen.getByText('Không ghi do lỗi')).toBeInTheDocument();
    expect(
      await screen.findByText('Chạy thử', {}, { timeout: 5000 }),
    ).toBeInTheDocument();
    const settled = reads;
    await new Promise((resolve) => setTimeout(resolve, 1700));
    expect(reads).toBe(settled);
  }, 10000);

  it('writes the selected status into the URL and resets the page', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockImplementation(() =>
          Promise.resolve(json({ items: [], total: 0, page: 1, pageSize: 20 })),
        ),
    );
    const { router } = renderImport(
      <ImportHistoryPage />,
      '/imports/history?page=2',
      '/imports/history',
    );
    await screen.findByText(
      'Chưa có lần nhập nào khớp bộ lọc trong phạm vi của bạn.',
    );
    fireEvent.mouseDown(
      screen.getByRole('combobox', { name: 'Lọc trạng thái' }),
    );
    fireEvent.click(
      await screen.findByText('Đã ghi', {
        selector: '.ant-select-item-option-content',
      }),
    );
    await waitFor(() =>
      expect(router.state.location.search).toBe('?status=COMMITTED'),
    );
  });
  it('restores filters and pagination from the URL and links to the detail', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(
          json({ items: [batch()], total: 41, page: 2, pageSize: 20 }),
        ),
      );
    vi.stubGlobal('fetch', fetchMock);
    const { router } = renderImport(
      <ImportHistoryPage />,
      '/imports/history?importType=CURRICULUM&status=DRY_RUN&mine=true&page=2',
      '/imports/history',
    );
    const link = await screen.findByRole('link', { name: 'Khung.xlsx' });
    expect(link).toHaveAttribute('href', '/imports/history/b1');
    const url = new URL(String(fetchMock.mock.calls[0][0]), 'http://local');
    expect(url.searchParams.get('page')).toBe('2');
    expect(url.searchParams.get('importType')).toBe('CURRICULUM');
    expect(url.searchParams.get('mine')).toBe('true');
    fireEvent.click(
      screen.getByRole('switch', { name: 'Chỉ lần nhập của tôi' }),
    );
    await waitFor(() =>
      expect(router.state.location.search).not.toContain('page='),
    );
    expect(router.state.location.search).not.toContain('mine=');
  });
  it('normalizes invalid URL filters and explains an empty history', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(json({ items: [], total: 0, page: 1, pageSize: 20 }));
    vi.stubGlobal('fetch', fetchMock);
    renderImport(
      <ImportHistoryPage />,
      '/imports/history?importType=BAD&status=BAD&page=-1&pageSize=999',
      '/imports/history',
    );
    expect(
      await screen.findByText(
        'Chưa có lần nhập nào khớp bộ lọc trong phạm vi của bạn.',
      ),
    ).toBeInTheDocument();
    expect(String(fetchMock.mock.calls[0][0])).toContain('page=1&pageSize=20');
    expect(String(fetchMock.mock.calls[0][0])).not.toContain('BAD');
  });
  it('shows a scoped refusal and provides retry', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockImplementation(() =>
          Promise.resolve(
            json({ message: 'Bạn không có quyền xem lịch sử.' }, 403),
          ),
        ),
    );
    renderImport(<ImportHistoryPage />, '/imports/history', '/imports/history');
    expect(
      await screen.findByText('Bạn không có quyền xem lịch sử.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeEnabled();
  });
  it('retains the report but disables an expired original file and commit', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockImplementation(() =>
          Promise.resolve(
            json(batch({ fileAvailable: false, canCommit: false })),
          ),
        ),
    );
    renderImport(
      <ImportDetailPage />,
      '/imports/history/b1',
      '/imports/history/:batchId',
    );
    expect(
      await screen.findByRole('button', { name: 'Tải tệp gốc' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Xác nhận nhập' }),
    ).toBeDisabled();
    expect(
      screen.getByText('Tệp không có lỗi, cảnh báo hoặc lưu ý.'),
    ).toBeInTheDocument();
    expect(screen.getAllByText('Người nhập')).toHaveLength(2);
  });
  it('reopens an aborted batch with its row report and no confirmation', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() =>
        Promise.resolve(
          json(
            batch({
              status: 'ABORTED',
              canCommit: false,
              errorRows: 1,
              report: {
                formatErrors: [],
                issues: [
                  {
                    rowNumber: 15,
                    column: 'Mã HP',
                    severity: 'ERROR',
                    code: 'COURSE_UNKNOWN',
                    message: 'Mã HP ABC không tồn tại.',
                  },
                ],
              },
            }),
          ),
        ),
      ),
    );
    renderImport(
      <ImportDetailPage />,
      '/imports/history/b1',
      '/imports/history/:batchId',
    );
    expect(
      await screen.findByText('Dòng 15: LỖI — Mã HP ABC không tồn tại.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Không ghi do lỗi')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Xác nhận nhập' }),
    ).toBeDisabled();
  });
});
