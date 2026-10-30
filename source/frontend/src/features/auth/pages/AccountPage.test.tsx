import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { App } from 'antd';
import { describe, expect, it, vi } from 'vitest';
import { AccountPage } from './AccountPage';

const account = {
  id: '1',
  username: 'admin',
  userCode: 'A1',
  fullName: 'Quản trị',
  email: null,
  mustChangePassword: false,
};

function renderAccount(fetchMock: ReturnType<typeof vi.fn>) {
  vi.stubGlobal('fetch', fetchMock);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <App>
        <AccountPage />
      </App>
    </QueryClientProvider>,
  );
}

describe('AccountPage', () => {
  it('shows identity fields and empty email', async () => {
    renderAccount(
      vi.fn().mockResolvedValue(new Response(JSON.stringify(account))),
    );
    expect(await screen.findByText('Quản trị')).toBeInTheDocument();
    expect(screen.getByText('Chưa có')).toBeInTheDocument();
  });
  it('shows the forced password-change warning', async () => {
    renderAccount(
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ ...account, mustChangePassword: true }),
          ),
        ),
    );
    expect(
      await screen.findByText(
        'Bạn cần đổi mật khẩu trước khi tiếp tục sử dụng hệ thống.',
      ),
    ).toBeInTheDocument();
  });
  it('rejects a mismatched confirmation without sending a request', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(account)));
    renderAccount(fetchMock);
    await screen.findByText('Quản trị');
    fireEvent.change(screen.getByLabelText('Mật khẩu hiện tại'), {
      target: { value: 'Current1' },
    });
    fireEvent.change(screen.getByLabelText('Mật khẩu mới'), {
      target: { value: 'Newpass123' },
    });
    fireEvent.change(screen.getByLabelText('Nhập lại mật khẩu mới'), {
      target: { value: 'Other1234' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Đổi mật khẩu' }));
    expect(
      await screen.findByText('Mật khẩu nhập lại không khớp'),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('requires letters and digits', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(account)));
    renderAccount(fetchMock);
    await screen.findByText('Quản trị');
    fireEvent.change(screen.getByLabelText('Mật khẩu hiện tại'), {
      target: { value: 'Current1' },
    });
    fireEvent.change(screen.getByLabelText('Mật khẩu mới'), {
      target: { value: 'abcdefgh' },
    });
    fireEvent.change(screen.getByLabelText('Nhập lại mật khẩu mới'), {
      target: { value: 'abcdefgh' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Đổi mật khẩu' }));
    expect(
      await screen.findByText('Mật khẩu phải có cả chữ và số'),
    ).toBeInTheDocument();
  });
  it('shows the server password error', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(account)))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ message: 'Mật khẩu hiện tại không đúng.' }),
          { status: 400 },
        ),
      );
    renderAccount(fetchMock);
    await screen.findByText('Quản trị');
    fireEvent.change(screen.getByLabelText('Mật khẩu hiện tại'), {
      target: { value: 'Wrong1' },
    });
    fireEvent.change(screen.getByLabelText('Mật khẩu mới'), {
      target: { value: 'Newpass123' },
    });
    fireEvent.change(screen.getByLabelText('Nhập lại mật khẩu mới'), {
      target: { value: 'Newpass123' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Đổi mật khẩu' }));
    expect(
      await screen.findByText('Mật khẩu hiện tại không đúng.'),
    ).toBeInTheDocument();
  });
});
