import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithNotifications } from '../../../shared/notifications/notificationTestRender';
import { NotificationsPage } from './NotificationsPage';

const note = (id: string, readStatus: string) => ({
  id,
  notificationType: 'REQUEST_RETURNED',
  content: `Nội dung ${id}`,
  changeRequestId: 'r1',
  readStatus,
  createdAt: '2026-10-19T03:00:00.000Z',
  readAt: null,
});

function renderPage() {
  return renderWithNotifications({
    element: <NotificationsPage />,
    reads: {
      '/api/notifications?page=1&pageSize=20': {
        items: [note('n1', 'UNREAD'), note('n2', 'READ')],
        total: 2,
        page: 1,
        pageSize: 20,
      },
      '/api/notifications?page=1&pageSize=20&unread=true': {
        items: [note('n1', 'UNREAD')],
        total: 1,
        page: 1,
        pageSize: 20,
      },
    },
    writes: { '/api/notifications/read-all': { count: 0 } },
  });
}

afterEach(() => vi.unstubAllGlobals());

describe('NotificationsPage', () => {
  it('lists every notification newest first from the server', async () => {
    renderPage();
    expect(await screen.findByText('Nội dung n1')).toBeInTheDocument();
    expect(screen.getByText('Nội dung n2')).toBeInTheDocument();
  });

  it('asks for the unread ones only', async () => {
    const { calls } = renderPage();
    await screen.findByText('Nội dung n2');
    fireEvent.click(screen.getByText('Chưa đọc'));
    await waitFor(() =>
      expect(calls.some((call) => call.url.includes('unread=true'))).toBe(true),
    );
    await waitFor(() =>
      expect(screen.queryByText('Nội dung n2')).not.toBeInTheDocument(),
    );
  });

  it('marks everything read', async () => {
    const { calls } = renderPage();
    await screen.findByText('Nội dung n1');
    fireEvent.click(
      screen.getByRole('button', { name: 'Đánh dấu tất cả đã đọc' }),
    );
    await waitFor(() =>
      expect(
        calls.some(
          (call) =>
            call.method === 'POST' &&
            call.url === '/api/notifications/read-all',
        ),
      ).toBe(true),
    );
  });

  it('shows the email outcome and saves the personal email switch (F-25 US-115)', async () => {
    const { calls } = renderWithNotifications({
      element: <NotificationsPage />,
      reads: {
        '/api/notifications?page=1&pageSize=20': {
          items: [
            { ...note('n1', 'UNREAD'), emailStatus: 'SENT', emailSent: true },
            { ...note('n2', 'READ'), emailStatus: 'FAILED', emailSent: false },
          ],
          total: 2,
          page: 1,
          pageSize: 20,
        },
        '/api/notifications/preferences': {
          emailEnabled: true,
          emailAvailable: true,
        },
      },
      writes: {
        '/api/notifications/preferences': {
          emailEnabled: false,
          emailAvailable: true,
        },
      },
    });
    expect(await screen.findByText('Đã gửi email')).toBeInTheDocument();
    expect(screen.getByText('Gửi email lỗi')).toBeInTheDocument();
    const toggle = await screen.findByRole('switch', { name: 'Nhận email' });
    expect(toggle).toBeChecked();
    fireEvent.click(toggle);
    await waitFor(() =>
      expect(
        calls.some(
          (call) =>
            call.method === 'PATCH' &&
            call.url === '/api/notifications/preferences',
        ),
      ).toBe(true),
    );
  });
});
