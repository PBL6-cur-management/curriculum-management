import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderRequestPage } from '../testRender';
import { ApprovalQueuePage } from './ApprovalQueuePage';

const item = (patch: object) => ({
  requestId: 'r1',
  requestCode: 'DX-2026-0001',
  title: 'Cập nhật mục tiêu',
  requestType: 'SYLLABUS_CONTENT',
  status: 'PENDING_COORDINATOR',
  approvalLevel: 1,
  standsFor: 'G1',
  createdBy: { id: 'u2', fullName: 'Giảng viên B' },
  submittedAt: '2026-10-15T03:00:00.000Z',
  daysWaiting: 4,
  delegatedFor: [],
  ...patch,
});

function renderQueue(reads: Record<string, unknown>) {
  return renderRequestPage({
    path: '/approval-queue',
    entry: '/approval-queue',
    element: <ApprovalQueuePage />,
    reads,
  });
}

afterEach(() => vi.unstubAllGlobals());

describe('ApprovalQueuePage', () => {
  it('lists code, title, level, group, creator, sent date and days waiting, longest first (US-061 AC3)', async () => {
    renderQueue({
      '/api/approval-queue': [
        item({ requestId: 'r1', daysWaiting: 1 }),
        item({
          requestId: 'r2',
          requestCode: 'DX-2026-0002',
          standsFor: null,
          status: 'PENDING_ACADEMIC_OFFICE',
          approvalLevel: 3,
          daysWaiting: 9,
        }),
      ],
    });
    const link = await screen.findByRole('link', { name: 'DX-2026-0002' });
    expect(link).toHaveAttribute('href', '/change-requests/r2');
    const rows = screen.getAllByRole('row').slice(1);
    expect(within(rows[0]).getByText('DX-2026-0002')).toBeInTheDocument();
    expect(within(rows[0]).getByText('9')).toBeInTheDocument();
    expect(within(rows[0]).getByText('Chính mình')).toBeInTheDocument();
    expect(within(rows[1]).getByText('G1')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Giảng viên B')).toBeInTheDocument();
  });

  it('names whose level a delegated row belongs to (F-25 US-114)', async () => {
    renderQueue({
      '/api/approval-queue': [
        item({
          delegatedFor: [
            {
              delegationId: 'd1',
              delegator: { id: 'u9', fullName: 'Trưởng nhóm A' },
            },
          ],
        }),
      ],
    });
    expect(
      await screen.findByText('Duyệt thay Trưởng nhóm A'),
    ).toBeInTheDocument();
  });

  it('asks the server for the chosen type', async () => {
    const { reads } = renderQueue({ '/api/approval-queue': [item({})] });
    await screen.findByRole('link', { name: 'DX-2026-0001' });
    fireEvent.mouseDown(screen.getByLabelText('Loại đề xuất'));
    fireEvent.click(
      await screen.findByText('Khung chương trình', {
        selector: '.ant-select-item-option-content',
      }),
    );
    await waitFor(() =>
      expect(reads.some((url) => url.includes('requestType=CURRICULUM'))).toBe(
        true,
      ),
    );
  });

  it('says so when nothing waits', async () => {
    renderQueue({ '/api/approval-queue': [] });
    expect(
      await screen.findByText('Không có đề xuất nào chờ bạn duyệt.'),
    ).toBeInTheDocument();
  });
});
