import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ROUTES } from '../../../routes';
import { ApiError } from '../../../shared/api/client';
import * as api from '../api/graduation';
import {
  graduationBatch,
  graduationItem,
  jsonGraduation,
  renderGraduationPage,
} from '../testRender';
import { GraduationBatchPage } from './GraduationBatchPage';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
describe('graduation batch progress and immutable results', () => {
  it('distinguishes pending/error rows from academic rejection and links only saved reviews', async () => {
    renderGraduationPage({
      element: <GraduationBatchPage />,
      path: ROUTES.graduationBatch,
      entry: '/graduation/batches/batch',
      reads: {
        '/api/graduation-batches/batch/items?page=1&pageSize=20': {
          items: [
            graduationItem,
            {
              ...graduationItem,
              id: 'pending',
              studentCode: 'SYN002',
              status: 'PENDING',
              conclusion: null,
              auditId: null,
              shortfallCount: null,
              finishedAt: null,
            },
            {
              ...graduationItem,
              id: 'error',
              studentCode: 'SYN003',
              status: 'ERROR',
              conclusion: null,
              auditId: null,
              shortfallCount: null,
              error: {
                code: 'GRADUATION_INPUT_INVALID',
                message: 'Cần kiểm tra mapping.',
              },
            },
          ],
          total: 3,
          page: 1,
          pageSize: 20,
        },
      },
    });
    expect(
      await screen.findByText('SYN003 — Sinh viên tổng hợp'),
    ).toBeInTheDocument();
    expect(screen.getByText(/GRADUATION_INPUT_INVALID/)).toBeInTheDocument();
    expect(screen.getAllByText('Chưa có kết luận')).toHaveLength(2);
    expect(screen.getAllByRole('link', { name: 'Xem lần xét' })).toHaveLength(
      1,
    );
    expect(screen.getByRole('link', { name: 'Xem lần xét' })).toHaveAttribute(
      'href',
      '/graduation/audits/audit',
    );
    expect(
      screen.getByText(/Kết quả tại thời điểm đợt xét/),
    ).toBeInTheDocument();
  });
  it('uses server-side filters and exports exactly the committed filters without pagination', async () => {
    const download = vi
      .spyOn(api, 'downloadGraduationBatch')
      .mockResolvedValue();
    const { fetchMock } = renderGraduationPage({
      element: <GraduationBatchPage />,
      path: ROUTES.graduationBatch,
      entry: '/graduation/batches/batch',
      readResponse: (path) =>
        path.includes('/items?') && path.includes('outcome=ERROR')
          ? jsonGraduation({ items: [], total: 0, page: 1, pageSize: 20 })
          : undefined,
    });
    await screen.findByRole('link', { name: 'Xem lần xét' });
    fireEvent.mouseDown(
      screen.getByRole('combobox', { name: 'Trạng thái lượt xét' }),
    );
    fireEvent.click(
      await screen.findByText('Không thể xét', {
        selector: '.ant-select-item-option-content',
      }),
    );
    expect(
      await screen.findByText('Không có lượt xét phù hợp bộ lọc hiện tại'),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/graduation-batches/batch/items?outcome=ERROR&page=1&pageSize=20',
      expect.any(Object),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Xuất Excel' }));
    await waitFor(() =>
      expect(download).toHaveBeenCalledWith('batch', { outcome: 'ERROR' }),
    );
  });
  it('shows download errors without replacing the saved batch result', async () => {
    vi.spyOn(api, 'downloadGraduationBatch').mockRejectedValue(
      new ApiError(503, {
        code: 'GRADUATION_JOB_FAILED',
        message: 'Chưa tải được tệp, thử lại sau.',
      }),
    );
    renderGraduationPage({
      element: <GraduationBatchPage />,
      path: ROUTES.graduationBatch,
      entry: '/graduation/batches/batch',
    });
    await screen.findByRole('link', { name: 'Xem lần xét' });
    fireEvent.click(screen.getByRole('button', { name: 'Xuất Excel' }));
    expect(await screen.findByText(/Chưa tải được tệp/)).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Xem lần xét' }),
    ).toBeInTheDocument();
  });
  it.each(['QUEUED', 'RUNNING', 'FAILED'] as const)(
    'keeps %s visible but does not permit export',
    async (status) => {
      renderGraduationPage({
        element: <GraduationBatchPage />,
        path: ROUTES.graduationBatch,
        entry: '/graduation/batches/batch',
        reads: {
          '/api/graduation-batches/batch': {
            ...graduationBatch,
            status,
            processedCount: 1,
            failure:
              status === 'FAILED'
                ? {
                    code: 'GRADUATION_JOB_FAILED',
                    message: 'Bộ xử lý tạm ngừng.',
                  }
                : null,
          },
        },
      });
      await screen.findByRole('button', { name: 'Xuất Excel' });
      expect(screen.getByRole('button', { name: 'Xuất Excel' })).toBeDisabled();
      const processed = screen
        .getByText('Đã xử lý', { selector: '.ant-descriptions-item-label' })
        .closest<HTMLElement>('.ant-descriptions-item-container');
      expect(processed).not.toBeNull();
      expect(within(processed!).getByText('1 / 2')).toBeInTheDocument();
    },
  );
});
