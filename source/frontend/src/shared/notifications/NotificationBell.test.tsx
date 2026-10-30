import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NotificationBell } from './NotificationBell';
import { renderWithNotifications } from './notificationTestRender';

const NOTE = {
  id: 'n1',
  notificationType: 'REQUEST_AWAITING_YOU',
  content: 'Đề xuất DX-2026-0001 đang chờ bạn duyệt.',
  changeRequestId: 'r1',
  readStatus: 'UNREAD',
  createdAt: '2026-10-19T03:00:00.000Z',
  readAt: null,
};
const PAGE = { items: [NOTE], total: 1, page: 1, pageSize: 5 };

function renderBell() {
  return renderWithNotifications({
    element: <NotificationBell />,
    reads: {
      '/api/notifications/unread-count': { count: 3 },
      '/api/notifications?page=1&pageSize=5': PAGE,
    },
    writes: {
      '/api/notifications/n1/read': { ...NOTE, readStatus: 'READ' },
    },
  });
}

afterEach(() => vi.unstubAllGlobals());

describe('NotificationBell', () => {
  it('renders graduation conclusion changes as content-only notices without a fake request link', async () => {
    const note = {
      ...NOTE,
      notificationType: 'GRADUATION_CONCLUSION_CHANGED',
      content:
        'Kết luận tốt nghiệp SYN001 — chương trình tổng hợp đã thay đổi.',
      changeRequestId: null,
    };
    const { calls, router } = renderWithNotifications({
      element: <NotificationBell />,
      reads: {
        '/api/notifications/unread-count': { count: 1 },
        '/api/notifications?page=1&pageSize=5': { ...PAGE, items: [note] },
      },
      writes: { '/api/notifications/n1/read': { ...note, readStatus: 'READ' } },
    });
    await screen.findByText('1');
    fireEvent.click(screen.getByRole('button', { name: 'Thông báo' }));
    fireEvent.click(await screen.findByText(note.content));
    await waitFor(() =>
      expect(
        calls.some(
          (call) =>
            call.method === 'POST' && call.url === '/api/notifications/n1/read',
        ),
      ).toBe(true),
    );
    expect(router.state.location.pathname).toBe('/');
    expect(
      screen.queryByRole('link', { name: /SYN001/ }),
    ).not.toBeInTheDocument();
  });
  it('shows the unread count as a badge', async () => {
    renderBell();
    expect(await screen.findByText('3')).toBeInTheDocument();
  });

  it('does not load the preview until the popover opens', async () => {
    const { calls } = renderBell();
    await screen.findByText('3');
    expect(
      calls.some((call) => call.url === '/api/notifications?page=1&pageSize=5'),
    ).toBe(false);
  });

  it('asks again for the count when the page changes', async () => {
    const { calls, router } = renderBell();
    await screen.findByText('3');
    const countCalls = () =>
      calls.filter((call) => call.url.endsWith('/unread-count')).length;
    expect(countCalls()).toBe(1);
    await router.navigate('/elsewhere');
    await waitFor(() => expect(countCalls()).toBe(2));
  });

  it('marks an unread item read and opens its request (US-068 AC4)', async () => {
    const { calls, router } = renderBell();
    await screen.findByText('3');
    fireEvent.click(screen.getByRole('button', { name: 'Thông báo' }));
    fireEvent.click(await screen.findByText(NOTE.content));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/change-requests/r1'),
    );
    expect(
      calls.some(
        (call) =>
          call.method === 'POST' && call.url === '/api/notifications/n1/read',
      ),
    ).toBe(true);
  });
});
