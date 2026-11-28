import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { SubmitPreview } from '../api/changeRequests';
import { detail } from '../testFixtures';
import { json, renderRequestPage } from '../testRender';
import { SubmitConfirmModal } from './SubmitConfirmModal';

const PREVIEW: SubmitPreview = {
  itemCount: 3,
  affectedPrograms: [
    { id: 'p1', programCode: '1024034', programName: 'Kỹ thuật máy tính' },
    { id: 'p2', programCode: '1024035', programName: 'Khoa học dữ liệu' },
    { id: 'p3', programCode: '1024036', programName: 'An toàn thông tin' },
  ],
  levels: [
    {
      approvalLevel: 1,
      levelName: 'Điều phối nhóm chuyên môn',
      approvers: [{ name: 'Điều phối An', scope: 'G1', skipReason: null }],
    },
    {
      approvalLevel: 2,
      levelName: 'Giám đốc CTĐT',
      approvers: [
        { name: 'Giám đốc Bình', scope: '1024034', skipReason: null },
        {
          name: 'Người tạo',
          scope: '1024035',
          skipReason: 'Người duyệt là người tạo đề xuất',
        },
      ],
    },
    {
      approvalLevel: 3,
      levelName: 'Ban lãnh đạo khoa',
      approvers: [
        { name: 'Ban lãnh đạo khoa', scope: 'KHOA_CNTT', skipReason: null },
      ],
    },
    {
      approvalLevel: 4,
      levelName: 'Phòng Đào tạo',
      approvers: [{ name: 'Phòng Đào tạo', scope: null, skipReason: null }],
    },
  ],
  blockingIssues: [],
};

function renderModal(preview: SubmitPreview) {
  return renderRequestPage({
    path: '/change-requests/:requestId/edit',
    entry: '/change-requests/r1/edit',
    element: <SubmitConfirmModal requestId="r1" onClose={() => undefined} />,
    reads: { '/api/change-requests/r1/submit-preview': preview },
    writeResponse: () => json(detail({ status: 'PENDING_COORDINATOR' })),
    extraRoutes: [
      { path: '/change-requests/:requestId', element: <p>Chi tiết đề xuất</p> },
    ],
  });
}

describe('SubmitConfirmModal', () => {
  it('lists the affected programs and every approver before the user confirms, a skipped one with its reason (US-057 AC7)', async () => {
    renderModal(PREVIEW);
    expect(await screen.findByText('3 thay đổi')).toBeInTheDocument();
    for (const code of [
      '1024034 — Kỹ thuật máy tính',
      '1024035 — Khoa học dữ liệu',
      '1024036 — An toàn thông tin',
    ])
      expect(screen.getByText(code)).toBeInTheDocument();
    expect(screen.getByText('Cấp 2 — Giám đốc CTĐT')).toBeInTheDocument();
    expect(
      screen.getByText(/Người duyệt là người tạo đề xuất/),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Gửi' })).toBeEnabled();
  });

  it('submits and moves to the detail page', async () => {
    const { writes } = renderModal(PREVIEW);
    await screen.findByText('3 thay đổi');
    const send = screen.getByRole('button', { name: 'Gửi' });
    await waitFor(() => expect(send).toBeEnabled());
    fireEvent.click(send);
    expect(await screen.findByText('Chi tiết đề xuất')).toBeInTheDocument();
    expect(writes).toEqual([
      expect.objectContaining({
        method: 'POST',
        url: '/api/change-requests/r1/submit',
      }),
    ]);
  });

  it('disables "Gửi" while a blocking issue stands and shows it first', async () => {
    renderModal({
      ...PREVIEW,
      blockingIssues: [
        {
          code: 'STALE_BASE',
          message: 'Dữ liệu gốc đã thay đổi sau khi đề xuất được soạn.',
        },
      ],
    });
    expect(
      await screen.findByText(/Dữ liệu gốc đã thay đổi/),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Gửi' })).toBeDisabled(),
    );
  });

  it('does not render empty levels for an organisational request', async () => {
    renderModal({
      ...PREVIEW,
      affectedPrograms: [],
      levels: [PREVIEW.levels[3]],
    });
    await screen.findByText('Cấp 4 — Phòng Đào tạo');
    expect(screen.queryByText(/Cấp 1/)).not.toBeInTheDocument();
    expect(
      screen.queryByText('Chương trình bị ảnh hưởng'),
    ).not.toBeInTheDocument();
  });
});
