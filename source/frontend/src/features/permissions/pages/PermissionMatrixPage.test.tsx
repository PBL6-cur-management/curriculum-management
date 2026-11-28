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
    fireEvent.click(
      (await screen.findAllByRole('button', { name: /Sửa quyền/ }))[0],
    );
    expect(await screen.findByText(/đã khóa/)).toBeInTheDocument();
  });

  it('applies batched changes only after one confirmation', async () => {
    const { fetchMock } = renderPage(true);
    await screen.findByText('Quyền 41');
    fireEvent.click(
      (await screen.findAllByRole('button', { name: /Sửa quyền/ }))[1],
    );
    const group = await screen.findByRole('radiogroup', {
      name: 'Quyền Quyền 1',
    });
    fireEvent.click(within(group).getByText('Không'));
    expect(
      await screen.findByText('1 thay đổi chưa áp dụng'),
    ).toBeInTheDocument();
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
  }, 20_000);

  it('creates, edits and deletes custom roles while protecting system roles and reporting active-user errors', async () => {
    const customMatrix = {
      ...matrix,
      roles: [
        ...roleRows,
        {
          id: 'r-custom',
          roleCode: 'CVHT',
          roleName: 'Cố vấn học tập',
          description: 'Tư vấn sinh viên',
          isSystemRole: false,
          scopeSource: 'NONE',
          assignable: true,
        },
      ],
    };
    let deleteFails = true;
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/auth/me'))
        return Promise.resolve(
          new Response(
            JSON.stringify({
              id: 'admin',
              permissions: ['permission.view', 'permission.manage'],
            }),
          ),
        );
      if (url.endsWith('/roles') && init?.method === 'POST') {
        const body = JSON.parse(String(init.body)) as {
          roleCode: string;
          roleName: string;
          description: string | null;
        };
        return Promise.resolve(
          new Response(
            JSON.stringify({
              id: 'r-new',
              ...body,
              isSystemRole: false,
              scopeSource: 'NONE',
              assignable: true,
            }),
            { status: 201 },
          ),
        );
      }
      if (url.endsWith('/roles/CVHT') && init?.method === 'PATCH') {
        const body = JSON.parse(String(init.body)) as { roleName: string };
        return Promise.resolve(
          new Response(
            JSON.stringify({
              ...customMatrix.roles[6],
              roleName: body.roleName,
            }),
          ),
        );
      }
      if (url.endsWith('/roles/CVHT') && init?.method === 'DELETE') {
        if (deleteFails) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                code: 'ROLE_IN_USE',
                message:
                  'Không thể xóa vai trò CVHT vì đang có 3 tài khoản hoạt động.',
              }),
              { status: 409 },
            ),
          );
        }
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      return Promise.resolve(new Response(JSON.stringify(customMatrix)));
    });
    vi.stubGlobal('fetch', fetchMock);
    render(
      <QueryClientProvider
        client={
          new QueryClient({
            defaultOptions: {
              queries: { retry: false },
              mutations: { retry: false },
            },
          })
        }
      >
        <App>
          <PermissionMatrixPage />
        </App>
      </QueryClientProvider>,
    );
    await screen.findByText('Quyền 41');
    expect(screen.getAllByText('Hệ thống').length).toBeGreaterThanOrEqual(6);
    expect(
      screen.queryByRole('button', { name: 'Xóa R1' }),
    ).not.toBeInTheDocument();

    // Create custom role
    fireEvent.click(screen.getByRole('button', { name: 'Tạo vai trò mới' }));
    fireEvent.change(await screen.findByLabelText('Mã vai trò'), {
      target: { value: 'tro_ly' },
    });
    fireEvent.change(screen.getByLabelText('Tên vai trò'), {
      target: { value: 'Trợ lý đào tạo' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Tạo vai trò' }));
    await vi.waitFor(() =>
      expect(
        fetchMock.mock.calls.some(
          ([url, init]) =>
            String(url).endsWith('/roles') &&
            init?.method === 'POST' &&
            String(init.body).includes('"roleCode":"TRO_LY"'),
        ),
      ).toBe(true),
    );

    // Edit custom role
    fireEvent.click(
      screen.getByRole('button', { name: 'Sửa thông tin CVHT' }),
    );
    const nameInput = await screen.findByDisplayValue('Cố vấn học tập');
    fireEvent.change(nameInput, {
      target: { value: 'Cố vấn học tập Khoa' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    await vi.waitFor(() =>
      expect(
        fetchMock.mock.calls.some(
          ([url, init]) =>
            String(url).endsWith('/roles/CVHT') && init?.method === 'PATCH',
        ),
      ).toBe(true),
    );

    // Delete custom role -> friendly API error when active users exist
    fireEvent.click(screen.getByRole('button', { name: 'Xóa CVHT' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Xóa vai trò' }));
    expect(
      (
        await screen.findAllByText(
          'Không thể xóa vai trò CVHT vì đang có 3 tài khoản hoạt động.',
        )
      ).length,
    ).toBeGreaterThan(0);

    // Retry delete succeeds
    deleteFails = false;
    fireEvent.click(screen.getByRole('button', { name: 'Xóa CVHT' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Xóa vai trò' }));
    await vi.waitFor(() =>
      expect(
        fetchMock.mock.calls.filter(
          ([url, init]) =>
            String(url).endsWith('/roles/CVHT') && init?.method === 'DELETE',
        ).length,
      ).toBe(2),
    );
  }, 20_000);
});
