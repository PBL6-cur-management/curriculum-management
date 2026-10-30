import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { App } from 'antd';
import { describe, expect, it, vi } from 'vitest';
import { PermissionMatrixPage } from './PermissionMatrixPage';

const roleRows = Array.from({ length: 6 }, (_, index) => ({
  id: `r${index + 1}`,
  roleCode: `R${index + 1}`,
  roleName: `Vai trò ${index + 1}`,
  description: null,
  isSystemRole: true,
  scopeSource: 'NONE',
  assignable: true,
}));
const permissionRows = Array.from({ length: 41 }, (_, index) => ({
  id: `p${index + 1}`,
  permissionCode: index === 0 ? 'user.manage' : `test.permission.${index + 1}`,
  permissionName: `Quyền ${index + 1}`,
  functionGroup: 'SYSTEM_ADMIN',
  description: null,
  source: 'Kiểm thử',
}));
const matrix = {
  roles: roleRows,
  permissions: permissionRows,
  cells: [
    {
      roleCode: 'R2',
      permissionCode: 'user.manage',
      mode: 'DIRECT',
      scope: 'ALL',
      updatedAt: '2026-01-01T00:00:00Z',
      updatedBy: null,
    },
  ],
  lockedCells: [{ roleCode: 'R1', permissionCode: 'user.manage' }],
};

function renderPage(canEdit: boolean) {
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes('/auth/me'))
      return Promise.resolve(
        new Response(
          JSON.stringify({
            id: 'admin',
            permissions: canEdit
              ? ['permission.view', 'permission.manage']
              : ['permission.view'],
          }),
        ),
      );
    if (init?.method === 'DELETE')
      return Promise.resolve(new Response(null, { status: 204 }));
    if (init?.method === 'PUT')
      return Promise.resolve(new Response(JSON.stringify(matrix.cells[0])));
    return Promise.resolve(new Response(JSON.stringify(matrix)));
  });
  vi.stubGlobal('fetch', fetchMock);
  return {
    fetchMock,
    ...render(
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { queries: { retry: false } } })
        }
      >
        <App>
          <PermissionMatrixPage />
        </App>
      </QueryClientProvider>,
    ),
  };
}

describe('PermissionMatrixPage', () => {
  it('renders the 41 permission rows across six role columns', async () => {
    renderPage(false);
    expect(await screen.findByText('Quyền 41')).toBeInTheDocument();
    expect(screen.getAllByText('R6 Vai trò 6').length).toBeGreaterThan(0);
  });

  it('hides edit controls without permission.manage', async () => {
    renderPage(false);
    await screen.findByText('Quyền 41');
    expect(screen.queryByRole('button', { name: /Sửa quyền/ })).toBeNull();
  });

  it('shows cell state as text and marks locked cells', async () => {
    renderPage(false);
    await screen.findByText('Quyền 41');
    const row = screen.getByText('Quyền 1').closest('tr')!;
    expect(row.textContent).toContain('Toàn bộ');
    expect(row.querySelector('[aria-label*="khóa"]')).not.toBeNull();
  });

  it('keeps locked cells read-only in the role editor', async () => {
    renderPage(true);
    await screen.findByText('Quyền 41');
    fireEvent.click((await screen.findAllByRole('button', { name: /Sửa quyền/ }))[0]);
    expect(await screen.findByText(/đã khóa/)).toBeInTheDocument();
  });

  it('applies batched changes only after one confirmation', async () => {
    const { fetchMock } = renderPage(true);
    await screen.findByText('Quyền 41');
    fireEvent.click((await screen.findAllByRole('button', { name: /Sửa quyền/ }))[1]);
    const group = await screen.findByRole('radiogroup', { name: 'Quyền Quyền 1' });
    fireEvent.click(within(group).getByText('Không'));
    expect(await screen.findByText('1 thay đổi chưa áp dụng')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng thay đổi' }));
    expect(
      fetchMock.mock.calls.some(([, init]) => init?.method === 'DELETE'),
    ).toBe(false);
    fireEvent.click(await screen.findByRole('button', { name: 'Áp dụng' }));
    await vi.waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([, init]) => init?.method === 'DELETE'),
      ).toBe(true),
    );
  });
});
