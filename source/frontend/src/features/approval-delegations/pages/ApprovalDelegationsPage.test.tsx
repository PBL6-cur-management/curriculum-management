import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderRequestPage } from '../../change-requests/testRender';
import { ApprovalDelegationsPage } from './ApprovalDelegationsPage';

const LIST = '/api/approval-delegations?page=1&pageSize=20';
const user = (id: string, fullName: string) => ({
  id,
  userCode: id.toUpperCase(),
  fullName,
});
const grant = (patch: object = {}) => ({
  id: 'd1',
  delegator: user('u1', 'Trưởng nhóm A'),
  delegate: user('u2', 'Giảng viên B'),
  scope: null,
  validFrom: '2026-11-01',
  validTo: '2026-11-15',
  status: 'ACTIVE',
  isEffectiveNow: false,
  createdAt: '2026-10-31T03:00:00.000Z',
  revokedAt: null,
  createdBy: user('u1', 'Trưởng nhóm A'),
  canRevoke: true,
  ...patch,
});

function renderPage(access: object, items: object[]) {
  return renderRequestPage({
    path: '/approval-delegations',
    entry: '/approval-delegations',
    element: <ApprovalDelegationsPage />,
    reads: {
      '/api/approval-delegations/access': {
        canManage: true,
        canManageOthers: false,
        hasIncomingDelegation: false,
        ...access,
      },
      [LIST]: { items, total: items.length, page: 1, pageSize: 20 },
      '/api/approval-delegations/levels': [
        { approvalLevel: 1, levelName: 'Điều phối nhóm chuyên môn' },
      ],
      '/api/approval-delegations/recipients': [user('u2', 'Giảng viên B')],
    },
  });
}

afterEach(() => vi.unstubAllGlobals());

describe('ApprovalDelegationsPage (MH-14)', () => {
  it('lists grants with their days and status, and revokes one (US-114 AC3)', async () => {
    const { writes } = renderPage({}, [
      grant(),
      grant({
        id: 'd2',
        status: 'REVOKED',
        canRevoke: false,
        scope: { approvalLevel: 1, levelName: 'Điều phối nhóm chuyên môn' },
      }),
    ]);
    const rows = (await screen.findAllByRole('row')).slice(1);
    expect(
      within(rows[0]).getByText('01/11/2026 – 15/11/2026'),
    ).toBeInTheDocument();
    expect(within(rows[0]).getByText('Đang hiệu lực')).toBeInTheDocument();
    expect(within(rows[0]).getByText('Mọi cấp đang giữ')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Đã thu hồi')).toBeInTheDocument();
    expect(
      within(rows[1]).queryByRole('button', { name: 'Thu hồi' }),
    ).not.toBeInTheDocument();

    fireEvent.click(within(rows[0]).getByRole('button', { name: 'Thu hồi' }));
    const confirm = (await screen.findByText('Thu hồi ủy quyền này?')).closest(
      '.ant-popover',
    ) as HTMLElement;
    fireEvent.click(within(confirm).getByRole('button', { name: 'Thu hồi' }));
    await waitFor(() =>
      expect(writes).toContainEqual(
        expect.objectContaining({
          method: 'POST',
          url: '/api/approval-delegations/d1/revoke',
        }),
      ),
    );
  });

  it('offers the delegator field only to the academic office (US-114 AC1)', async () => {
    renderPage({ canManageOthers: false }, []);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Tạo ủy quyền' }),
    );
    expect(
      await screen.findByLabelText('Người được ủy quyền'),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('Người ủy quyền')).not.toBeInTheDocument();
    expect(await screen.findByText('Chưa có ủy quyền nào')).toBeInTheDocument();
  });

  it('hides creation from someone who may only read their grants', async () => {
    renderPage({ canManage: false }, [grant({ canRevoke: false })]);
    expect(await screen.findByText('Giảng viên B')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Tạo ủy quyền' }),
    ).not.toBeInTheDocument();
  });
});
