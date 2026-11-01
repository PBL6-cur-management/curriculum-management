import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { LoginPage } from './LoginPage';

function renderLogin(fetchMock: ReturnType<typeof vi.fn>) {
  vi.stubGlobal('fetch', fetchMock);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const router = createMemoryRouter(
    [
      { path: '/login', element: <LoginPage /> },
      { path: '/', element: <div>home marker</div> },
    ],
    { initialEntries: ['/login'] },
  );
  return render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe('LoginPage', () => {
  it('logs in and navigates home', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('{}', { status: 401 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: '1',
            username: 'a',
            userCode: '1',
            fullName: 'A',
            email: null,
            mustChangePassword: false,
          }),
        ),
      );
    renderLogin(fetchMock);
    fireEvent.change(await screen.findByLabelText('Tên đăng nhập'), {
      target: { value: 'admin' },
    });
    fireEvent.change(screen.getByLabelText('Mật khẩu'), {
      target: { value: 'password' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));
    expect(await screen.findByText('home marker')).toBeInTheDocument();
  });
  it.each([
    ['INVALID_CREDENTIALS', 'Tên đăng nhập hoặc mật khẩu không đúng.'],
    [
      'ACCOUNT_DISABLED',
      'Tài khoản đã bị vô hiệu hóa. Vui lòng liên hệ Phòng Đào tạo.',
    ],
  ])('shows server login error %s', async (code, message) => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('{}', { status: 401 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ code, message }), {
          status: code === 'ACCOUNT_DISABLED' ? 403 : 401,
        }),
      );
    renderLogin(fetchMock);
    fireEvent.change(await screen.findByLabelText('Tên đăng nhập'), {
      target: { value: 'admin' },
    });
    fireEvent.change(screen.getByLabelText('Mật khẩu'), {
      target: { value: 'wrong' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));
    expect(await screen.findByText(message)).toBeInTheDocument();
  });
  it('hides the demo account box unless the demo build sets it', async () => {
    renderLogin(vi.fn().mockResolvedValue(new Response('{}', { status: 401 })));
    await screen.findByLabelText('Tên đăng nhập');
    expect(
      screen.queryByRole('button', { name: 'Dùng tài khoản demo' }),
    ).not.toBeInTheDocument();
  });
  it('signs in with the demo account in one click', async () => {
    vi.stubEnv('VITE_DEMO_LOGIN', 'demo:demo');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('{}', { status: 401 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: '1',
            username: 'demo',
            userCode: 'DEMO',
            fullName: 'Tài khoản demo',
            email: null,
            mustChangePassword: false,
          }),
        ),
      );
    renderLogin(fetchMock);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Dùng tài khoản demo' }),
    );
    expect(await screen.findByText('home marker')).toBeInTheDocument();
    const body = JSON.parse(String(fetchMock.mock.calls[1][1].body)) as unknown;
    expect(body).toEqual({ username: 'demo', password: 'demo' });
    vi.unstubAllEnvs();
  });
  it('validates an empty username', async () => {
    renderLogin(vi.fn());
    fireEvent.click(await screen.findByRole('button', { name: 'Đăng nhập' }));
    expect(await screen.findByText('Nhập tên đăng nhập')).toBeInTheDocument();
  });
});
