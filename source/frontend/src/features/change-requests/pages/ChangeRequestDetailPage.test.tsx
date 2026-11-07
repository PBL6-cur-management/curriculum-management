import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { COURSE_CHANGE_NOTICE } from '../constants/courseChangeNotice';
import { ACTIONS, detail } from '../testFixtures';
import { renderRequestPage } from '../testRender';
import { ChangeRequestDetailPage } from './ChangeRequestDetailPage';

function renderDetail(request: ReturnType<typeof detail>) {
  return renderRequestPage({
    path: '/change-requests/:requestId',
    entry: '/change-requests/r1',
    element: <ChangeRequestDetailPage />,
    reads: {
      '/api/change-requests/r1': request,
      '/api/change-requests/r1/diff': { live: false, sections: [] },
    },
  });
}

afterEach(() => vi.unstubAllGlobals());

describe('ChangeRequestDetailPage', () => {
  it('explains the snapshot rule once a course relation request is effective', async () => {
    renderDetail(
      detail({ requestType: 'COURSE_RELATION', status: 'EFFECTIVE' }),
    );
    expect(await screen.findByText(COURSE_CHANGE_NOTICE)).toBeInTheDocument();
  });

  it('keeps the snapshot notice off a course relation request still in progress and off other types', async () => {
    renderDetail(
      detail({ requestType: 'COURSE_RELATION', status: 'PENDING_DIRECTOR' }),
    );
    await screen.findByText('DX-2026-0001 — Cập nhật mục tiêu');
    expect(screen.queryByText(COURSE_CHANGE_NOTICE)).toBeNull();
  });

  it('keeps the snapshot notice off an effective curriculum request', async () => {
    renderDetail(detail({ requestType: 'CURRICULUM', status: 'EFFECTIVE' }));
    await screen.findByText('DX-2026-0001 — Cập nhật mục tiêu');
    expect(screen.queryByText(COURSE_CHANGE_NOTICE)).toBeNull();
  });

  it('offers no action to a viewer who is not the creator', async () => {
    renderDetail(
      detail({
        permissions: {
          ...ACTIONS,
          canEdit: false,
          canDelete: false,
          canSubmit: false,
          canUpload: false,
          canComment: false,
        },
      }),
    );
    expect(
      await screen.findByText('DX-2026-0001 — Cập nhật mục tiêu'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Rút đề xuất' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Tiếp tục soạn' })).toBeNull();
  });

  it('shows "Tiếp tục soạn" for a draft the viewer can edit, without "Rút"', async () => {
    renderDetail(detail({ permissions: ACTIONS }));
    expect(
      await screen.findByRole('button', { name: 'Tiếp tục soạn' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Rút đề xuất' })).toBeNull();
  });

  it('shows "Rút đề xuất" only when withdrawing is allowed', async () => {
    renderDetail(
      detail({
        status: 'PENDING_COORDINATOR',
        permissions: { ...ACTIONS, canEdit: false, canWithdraw: true },
      }),
    );
    expect(
      await screen.findByRole('button', { name: 'Rút đề xuất' }),
    ).toBeInTheDocument();
  });

  it('shows the approval panel with "Duyệt thay" to the academic office on a level-1 request', async () => {
    renderDetail(
      detail({
        status: 'PENDING_COORDINATOR',
        submissionRound: 1,
        permissions: {
          ...ACTIONS,
          canEdit: false,
          canOverride: true,
          canComment: false,
        },
      }),
    );
    expect(
      await screen.findByRole('button', { name: 'Duyệt thay' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Đồng ý' })).toBeNull();
  });

  it('shows Đồng ý, Trả lại and Từ chối to the approver of the level', async () => {
    renderDetail(
      detail({
        status: 'PENDING_COORDINATOR',
        submissionRound: 1,
        permissions: {
          ...ACTIONS,
          canEdit: false,
          canApprove: true,
          canReturn: true,
          canReject: true,
        },
      }),
    );
    for (const name of ['Đồng ý', 'Trả lại', 'Từ chối']) {
      expect(await screen.findByRole('button', { name })).toBeInTheDocument();
    }
  });
});
