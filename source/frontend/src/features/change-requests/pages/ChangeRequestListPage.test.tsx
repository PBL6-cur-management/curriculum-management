import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ME, summary } from '../testFixtures';
import { renderRequestPage } from '../testRender';
import { ChangeRequestListPage } from './ChangeRequestListPage';

const PAGE = {
  items: [
    summary(),
    summary({
      id: 'r2',
      requestCode: 'DX-2026-0002',
      status: 'PENDING_COORDINATOR',
      levelEnteredAt: '2026-10-15T03:00:00.000Z',
      daysWaiting: 4,
      submissionRound: 2,
      origin: 'UNIVERSITY',
      title: 'Theo yêu cầu Trường',
    }),
  ],
  total: 2,
  page: 1,
  pageSize: 20,
};

function renderList(permissions: string[]) {
  return renderRequestPage({
    path: '/change-requests',
    entry: '/change-requests',
    element: <ChangeRequestListPage />,
    me: { ...ME, permissions },
    reads: { '/api/change-requests?page=1&pageSize=20': PAGE },
  });
}

describe('ChangeRequestListPage', () => {
  it('lists code, type, target, origin, creator and status, with "lần N" after a resubmission', async () => {
    renderList(['changeRequest.view']);
    expect(
      await screen.findByRole('link', { name: 'DX-2026-0001' }),
    ).toHaveAttribute('href', '/change-requests/r1');
    const second = screen
      .getByRole('link', { name: 'DX-2026-0002' })
      .closest('tr')!;
    expect(within(second).getByText(/Chờ Điều phối duyệt/)).toBeInTheDocument();
    expect(within(second).getByText(/lần 2/)).toBeInTheDocument();
    expect(
      within(second).getByText('Theo yêu cầu của Trường'),
    ).toBeInTheDocument();
    expect(screen.getAllByText('Nội dung đề cương').length).toBeGreaterThan(0);
  });

  it('offers "Tạo đề xuất" to a creator of data requests and "Đề xuất tổ chức" to a creator of organisational ones (US-060 AC3)', async () => {
    renderList(['changeRequest.view', 'changeRequest.create']);
    expect(
      await screen.findByRole('button', { name: 'Tạo đề xuất' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Đề xuất tổ chức' }),
    ).not.toBeInTheDocument();
  });

  it('offers only the organisational form to R2', async () => {
    renderList(['changeRequest.view', 'changeRequest.createOrganizational']);
    expect(
      await screen.findByRole('button', { name: 'Đề xuất tổ chức' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Tạo đề xuất' }),
    ).not.toBeInTheDocument();
  });

  it('asks the server for the chosen origin (US-055 AC4) and for "my requests"', async () => {
    const { reads } = renderList(['changeRequest.view']);
    await screen.findByRole('link', { name: 'DX-2026-0001' });
    fireEvent.mouseDown(screen.getByLabelText('Nguồn'));
    fireEvent.click(
      await screen.findByText('Theo yêu cầu của Trường', {
        selector: '.ant-select-item-option-content',
      }),
    );
    await waitFor(() =>
      expect(reads.some((url) => url.includes('origin=UNIVERSITY'))).toBe(true),
    );
    fireEvent.click(
      screen.getByRole('switch', { name: 'Chỉ đề xuất của tôi' }),
    );
    await waitFor(() =>
      expect(reads.some((url) => url.includes('mine=true'))).toBe(true),
    );
  });

  it('shows the days a pending request has waited and filters by them (US-070 AC4)', async () => {
    const { reads } = renderList(['changeRequest.view']);
    const second = (
      await screen.findByRole('link', { name: 'DX-2026-0002' })
    ).closest('tr')!;
    expect(within(second).getByText('4')).toBeInTheDocument();
    const first = screen
      .getByRole('link', { name: 'DX-2026-0001' })
      .closest('tr')!;
    expect(within(first).getByText('Không chờ')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Số ngày chờ tối thiểu'), {
      target: { value: '3' },
    });
    await waitFor(() =>
      expect(reads.some((url) => url.includes('minDaysWaiting=3'))).toBe(true),
    );
  });
});
