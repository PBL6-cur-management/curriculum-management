import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { App } from 'antd';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { UserListPage } from './UserListPage';

const users = {
  items: [
    {
      id: 'u1',
      username: 'gv01',
      userCode: 'GV01',
      fullName: 'Nguyễn An',
      email: null,
      orgUnit: null,
      status: 'ACTIVE',
      activeRoleCodes: ['R2'],
    },
  ],
  total: 1,
  page: 1,
  pageSize: 20,
};

function renderPage(fetchMock: ReturnType<typeof vi.fn>) {
  vi.stubGlobal('fetch', fetchMock);
  const router = createMemoryRouter(
    [{ path: '/users', element: <UserListPage /> }],
    { initialEntries: ['/users'] },
  );
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <App>
        <RouterProvider router={router} />
      </App>
    </QueryClientProvider>,
  );
}

describe('UserListPage', () => {
  it('renders rows and total from the account response', async () => {
    renderPage(
      vi.fn((input: RequestInfo | URL) =>
        Promise.resolve(
          new Response(
            JSON.stringify(String(input).includes('org-units') ? [] : users),
          ),
        ),
      ),
    );
    expect(await screen.findByText('Nguyễn An')).toBeInTheDocument();
    expect(screen.getByText('GV01')).toBeInTheDocument();
  });

  it('searches from page one with the q filter', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) =>
      Promise.resolve(
        new Response(
          JSON.stringify(String(input).includes('org-units') ? [] : users),
        ),
      ),
    );
    renderPage(fetchMock);
    const search = await screen.findByPlaceholderText('Tìm tài khoản');
    fireEvent.change(search, { target: { value: 'an' } });
    fireEvent.keyDown(search, { key: 'Enter', code: 'Enter', charCode: 13 });
    expect(await screen.findByText('Nguyễn An')).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some(
        ([input]) =>
          String(input).includes('q=an') && String(input).includes('page=1'),
      ),
    ).toBe(true);
  });

  it('creates an account and shows its one-time temporary password', async () => {
    const created = {
      user: {
        ...users.items[0],
        mustChangePassword: true,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
      temporaryPassword: 'Temp1234',
    };
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) =>
      Promise.resolve(
        new Response(
          JSON.stringify(
            String(input).includes('org-units')
              ? []
              : init?.method === 'POST'
                ? created
                : users,
          ),
          { status: init?.method === 'POST' ? 201 : 200 },
        ),
      ),
    );
    renderPage(fetchMock);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Thêm tài khoản' }),
    );
    fireEvent.change(await screen.findByLabelText('Tên đăng nhập'), {
      target: { value: 'gv01' },
    });
    fireEvent.change(screen.getByLabelText('Mã người dùng'), {
      target: { value: 'GV01' },
    });
    fireEvent.change(screen.getByLabelText('Họ tên'), {
      target: { value: 'Nguyễn An' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    expect(await screen.findByText('Temp1234')).toBeInTheDocument();
  });

  it('shows USERNAME_TAKEN under the username field', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) =>
      Promise.resolve(
        new Response(
          JSON.stringify(
            String(input).includes('org-units')
              ? []
              : init?.method === 'POST'
                ? {
                    code: 'USERNAME_TAKEN',
                    message: 'Tên đăng nhập đã được dùng.',
                    details: [
                      {
                        field: 'username',
                        constraints: ['unique'],
                      },
                    ],
                  }
                : users,
          ),
          { status: init?.method === 'POST' ? 409 : 200 },
        ),
      ),
    );
    renderPage(fetchMock);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Thêm tài khoản' }),
    );
    fireEvent.change(await screen.findByLabelText('Tên đăng nhập'), {
      target: { value: 'gv01' },
    });
    fireEvent.change(screen.getByLabelText('Mã người dùng'), {
      target: { value: 'GV01' },
    });
    fireEvent.change(screen.getByLabelText('Họ tên'), {
      target: { value: 'Nguyễn An' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    expect(
      await screen.findByText('Tên đăng nhập đã được dùng.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('unique')).not.toBeInTheDocument();
  });

  it('shows a fallback toast when saving fails without API field errors', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) =>
      init?.method === 'POST'
        ? Promise.reject(new Error('Network unavailable'))
        : Promise.resolve(
            new Response(
              JSON.stringify(String(input).includes('org-units') ? [] : users),
              { status: 200 },
            ),
          ),
    );
    renderPage(fetchMock);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Thêm tài khoản' }),
    );
    fireEvent.change(await screen.findByLabelText('Tên đăng nhập'), {
      target: { value: 'gv01' },
    });
    fireEvent.change(screen.getByLabelText('Mã người dùng'), {
      target: { value: 'GV01' },
    });
    fireEvent.change(screen.getByLabelText('Họ tên'), {
      target: { value: 'Nguyễn An' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    expect(
      await screen.findByText('Không lưu được tài khoản.'),
    ).toBeInTheDocument();
  });
});
