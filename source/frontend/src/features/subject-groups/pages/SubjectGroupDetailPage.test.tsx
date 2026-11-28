import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { App } from 'antd';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SubjectGroupDetailPage } from './SubjectGroupDetailPage';

const canManage = vi.hoisted(() => vi.fn(() => false));
vi.mock('../../../shared/auth/useCan', () => ({ useCan: canManage }));

afterEach(() => vi.unstubAllGlobals());

describe('SubjectGroupDetailPage', () => {
  it('shows member and coordinator sections and the missing coordinator warning', async () => {
    canManage.mockReturnValue(false);
    const detail = {
      id: 'g',
      groupCode: 'G1',
      groupName: 'Đại số',
      status: 'ACTIVE',
      faculty: { id: 'f', unitCode: 'F', unitName: 'Khoa Toán' },
      activeMemberCount: 1,
      activeCoordinators: [],
      hasActiveCoordinator: false,
      members: [],
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response(JSON.stringify(detail)))),
    );
    const router = createMemoryRouter(
      [
        {
          path: '/subject-groups/:groupId',
          element: <SubjectGroupDetailPage />,
        },
      ],
      { initialEntries: ['/subject-groups/g'] },
    );
    render(
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
    expect(await screen.findByText('Chưa có Điều phối')).toBeInTheDocument();
    expect(screen.getByText('Điều phối')).toBeInTheDocument();
    expect(screen.getByText('Thành viên', { exact: true })).toBeInTheDocument();
  });

  it('renders a 403 result for a group outside the caller scope', async () => {
    canManage.mockReturnValue(false);
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({ code: 'OUT_OF_SCOPE', message: 'Ngoài phạm vi' }),
            { status: 403 },
          ),
        ),
      ),
    );
    const router = createMemoryRouter(
      [
        {
          path: '/subject-groups/:groupId',
          element: <SubjectGroupDetailPage />,
        },
      ],
      { initialEntries: ['/subject-groups/g'] },
    );
    render(
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
    expect(
      await screen.findByText('Nhóm này nằm ngoài phạm vi của bạn'),
    ).toBeInTheDocument();
  });

  it('offers 1-click promote on non-coordinator members and 1-click demote on coordinators', async () => {
    canManage.mockReturnValue(true);
    const detail = {
      id: 'g',
      groupCode: 'G1',
      groupName: 'Đại số',
      status: 'ACTIVE',
      faculty: { id: 'f', unitCode: 'F', unitName: 'Khoa Toán' },
      activeMemberCount: 2,
      activeCoordinators: [{ id: 'u2', fullName: 'Trần Bình' }],
      hasActiveCoordinator: true,
      members: [
        {
          id: 'm1',
          lecturer: {
            id: 'u1',
            userCode: 'GV01',
            fullName: 'Nguyễn An',
            status: 'ACTIVE',
          },
          memberRole: 'MEMBER',
          validFrom: '2026-01-01',
          validTo: null,
          state: 'ACTIVE',
          assignedBy: null,
          createdAt: '2026-01-01T00:00:00Z',
          revokedAt: null,
          revokedBy: null,
        },
        {
          id: 'm2',
          lecturer: {
            id: 'u2',
            userCode: 'GV02',
            fullName: 'Trần Bình',
            status: 'ACTIVE',
          },
          memberRole: 'MEMBER',
          validFrom: '2026-01-01',
          validTo: null,
          state: 'ACTIVE',
          assignedBy: null,
          createdAt: '2026-01-01T00:00:00Z',
          revokedAt: null,
          revokedBy: null,
        },
        {
          id: 'c2',
          lecturer: {
            id: 'u2',
            userCode: 'GV02',
            fullName: 'Trần Bình',
            status: 'ACTIVE',
          },
          memberRole: 'COORDINATOR',
          validFrom: '2026-01-01',
          validTo: null,
          state: 'ACTIVE',
          assignedBy: null,
          createdAt: '2026-01-01T00:00:00Z',
          revokedAt: null,
          revokedBy: null,
        },
      ],
    };
    const posts: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (init?.method === 'POST') {
          posts.push(url);
          return Promise.resolve(new Response(JSON.stringify([])));
        }
        return Promise.resolve(new Response(JSON.stringify(detail)));
      }),
    );

    const router = createMemoryRouter(
      [
        {
          path: '/subject-groups/:groupId',
          element: <SubjectGroupDetailPage />,
        },
      ],
      { initialEntries: ['/subject-groups/g'] },
    );
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
          <RouterProvider router={router} />
        </App>
      </QueryClientProvider>,
    );

    await screen.findByText('Nguyễn An');
    // Only u1 (non-coordinator) gets the promote button; u2 is already an active coordinator.
    const promoteButtons = screen.getAllByRole('button', {
      name: 'Thăng cấp Điều phối',
    });
    expect(promoteButtons).toHaveLength(1);

    fireEvent.click(promoteButtons[0]);
    const promoteDialog = await screen.findByRole('dialog');
    fireEvent.click(
      within(promoteDialog).getByRole('button', {
        name: 'Thăng cấp Điều phối',
      }),
    );
    await waitFor(() =>
      expect(posts).toContain('/api/subject-groups/g/coordinators/u1/promote'),
    );

    const demoteButton = screen.getByRole('button', {
      name: 'Hạ xuống Thành viên',
    });
    fireEvent.click(demoteButton);
    const [demoteHeading] = await screen.findAllByText(
      'Hạ quyền Điều phối của Trần Bình?',
    );
    const demoteDialog = demoteHeading.closest('[role="dialog"]') as HTMLElement;
    fireEvent.click(
      within(demoteDialog).getByRole('button', {
        name: 'Hạ xuống Thành viên',
      }),
    );
    await waitFor(() =>
      expect(posts).toContain('/api/subject-groups/g/coordinators/u2/demote'),
    );
  });
});
