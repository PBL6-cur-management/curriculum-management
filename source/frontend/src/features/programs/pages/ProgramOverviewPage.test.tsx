import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { App } from 'antd';
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router';
import { ROUTES } from '../../../routes';
import { ProgramWorkspaceLayout } from '../components/ProgramWorkspaceLayout';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProgramOverviewPage } from './ProgramOverviewPage';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });
const FACULTY = { id: 'f1', unitCode: 'KHOA_CNTT', unitName: 'Khoa CNTT' };
const INFO = {
  id: 'v1',
  versionNumber: null,
  status: 'DRAFT',
  programName: 'Kỹ thuật máy tính',
  majorCode: '7480106',
  majorName: 'Kỹ thuật máy tính',
  semesterCount: 10,
  totalCredits: '150',
  compulsoryCredits: '140',
  electiveCredits: '10',
  updatedAt: '2026-10-19T00:00:00.000Z',
};
const PROGRAM = {
  id: 'p1',
  programCode: '1024034',
  degreeLevel: 'ENGINEER',
  status: 'ACTIVE',
  faculty: FACULTY,
  programName: 'Kỹ thuật máy tính',
  currentVersion: { id: 'v1', versionNumber: null, status: 'DRAFT' },
  directors: [],
  currentVersionInfo: INFO,
  draftVersion: INFO,
  versions: [{ id: 'v1', versionNumber: null, status: 'DRAFT' }],
  clonedFrom: null,
  editPath: 'DIRECT',
  canManage: true,
  canClone: true,
  createdAt: '2026-10-19T00:00:00.000Z',
  updatedAt: '2026-10-19T00:00:00.000Z',
};
const director = (patch: Record<string, unknown> = {}) => ({
  id: 'd1',
  director: { id: 'u1', fullName: 'Nguyễn An' },
  validFrom: '2026-01-01',
  validTo: null,
  state: 'ACTIVE',
  assignedBy: { id: 'a', fullName: 'Quản trị' },
  revokedAt: null,
  revokedBy: null,
  ...patch,
});

const ME = {
  id: 'u1',
  username: 'u',
  userCode: 'U',
  fullName: 'U',
  email: null,
  mustChangePassword: false,
  orgUnit: null,
  roles: [{ roleCode: 'R3' }],
  permissions: ['outcome.view', 'program.view'],
};

const WORKSPACE_VIEWS = [
  ROUTES.curriculum,
  ROUTES.electiveGroups,
  ROUTES.consistency,
  ROUTES.plos,
  ROUTES.coursePloMatrix,
  ROUTES.cloPloMatrix,
  ROUTES.outcomeCoverage,
  ROUTES.courseGraph,
  ROUTES.programHealth,
  ROUTES.versionHistory,
  ROUTES.versionCompare,
  ROUTES.versionTimeline,
  ROUTES.cohortVersionAssignments,
];

function Here() {
  return <output aria-label="Đang ở">{useLocation().pathname}</output>;
}

const openTab = async (name: string) =>
  fireEvent.click(await screen.findByRole('tab', { name }, { timeout: 3000 }));
const here = async () =>
  (await screen.findByRole('status', { name: 'Đang ở' })).textContent;

function renderPage(
  program: Record<string, unknown> = PROGRAM,
  directors: unknown[] = [],
  me: Record<string, unknown> | null = null,
  initialEntry = '/programs/p1',
  versionInfo: Record<string, unknown> | null = null,
) {
  const writes: { url: string; method: string }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (init?.method === 'POST') {
        writes.push({ url, method: 'POST' });
        return Promise.resolve(json({ ...program, status: 'INACTIVE' }));
      }
      if (url === '/api/auth/me' && me) return Promise.resolve(json(me));
      if (url === '/api/programs/p1/directors')
        return Promise.resolve(json(directors));
      if (url === '/api/programs/p1') return Promise.resolve(json(program));
      if (url.startsWith('/api/program-versions/') && versionInfo)
        return Promise.resolve(json(versionInfo));
      return Promise.resolve(json({}, 404));
    }),
  );
  // The overview inside its real workspace; every other workspace view just prints its URL.
  const router = createMemoryRouter(
    [
      {
        element: <ProgramWorkspaceLayout />,
        children: [
          { path: ROUTES.programDetail, element: <ProgramOverviewPage /> },
          ...WORKSPACE_VIEWS.map((path) => ({ path, element: <Here /> })),
        ],
      },
    ],
    { initialEntries: [initialEntry] },
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
  return { writes };
}

afterEach(() => vi.unstubAllGlobals());

describe('ProgramOverviewPage', () => {
  it('offers the program-specific cohort assignment view only with its permission', async () => {
    renderPage(PROGRAM, [], {
      ...ME,
      permissions: [...ME.permissions, 'version.assignCohort'],
    });
    await openTab('Phiên bản');
    await openTab('Gán cho khóa');
    expect(await here()).toBe('/programs/p1/cohort-versions');
  });
  it('hides cohort assignment without permission', async () => {
    renderPage(PROGRAM, [], ME);
    await openTab('Phiên bản');
    expect(await here()).toBe('/programs/p1/versions');
    expect(
      screen.queryByRole('tab', { name: 'Gán cho khóa' }),
    ).not.toBeInTheDocument();
  });
  it('shows the Draft info, the status and the way to the later sections', async () => {
    renderPage();
    expect(
      await screen.findByRole('heading', {
        name: /1024034 — Kỹ thuật máy tính/,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Danh sách chương trình' }),
    ).toHaveAttribute('href', '/programs');
    expect(screen.getByText('Tổng tín chỉ')).toBeInTheDocument();
    expect(screen.getByText('150')).toBeInTheDocument();
    for (const name of ['Tổng quan', 'Khung chương trình', 'Phiên bản'])
      expect(screen.getByRole('tab', { name })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Tổng quan' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Sửa thông tin' })).toBeEnabled();
    expect(
      screen.getByRole('button', { name: 'Nhân bản' }),
    ).toBeInTheDocument();
  });

  it('opens the curriculum views of the Draft version (F-07)', async () => {
    renderPage();
    await openTab('Khung chương trình');
    expect(await here()).toBe('/programs/p1/versions/v1/curriculum');
    await openTab('Nhóm tự chọn');
    expect(await here()).toBe('/programs/p1/versions/v1/elective-groups');
    await openTab('Kiểm tra nhất quán');
    expect(await here()).toBe('/programs/p1/versions/v1/consistency');
  });

  it('opens the outcome views of the working version to staff (F-11)', async () => {
    renderPage(PROGRAM, [], ME);
    await openTab('Chuẩn đầu ra');
    expect(await here()).toBe('/programs/p1/versions/v1/plos');
    for (const [name, path] of [
      ['Ma trận học phần–PLO', 'course-plo-matrix'],
      ['Ma trận CLO–PLO', 'clo-plo-matrix'],
      ['Kiểm tra phủ', 'outcome-coverage'],
    ]) {
      await openTab(name);
      expect(await here()).toBe(`/programs/p1/versions/v1/${path}`);
    }
  });

  it('opens the course graph and the program health from one analysis tab', async () => {
    renderPage(PROGRAM, [], ME);
    await openTab('Phân tích');
    expect(await here()).toBe('/programs/p1/versions/v1/course-graph');
    await openTab('Sức khỏe chương trình');
    expect(await here()).toBe('/programs/p1/versions/v1/health');
  });

  it('shows a student the PLO list only', async () => {
    renderPage(PROGRAM, [], { ...ME, roles: [{ roleCode: 'R6' }] });
    await openTab('Chuẩn đầu ra');
    expect(await here()).toBe('/programs/p1/versions/v1/plos');
    expect(
      screen.queryByRole('tab', { name: 'Ma trận học phần–PLO' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('tab', { name: 'Phân tích' }),
    ).not.toBeInTheDocument();
  });

  it('opens the current version when the program has no Draft', async () => {
    renderPage({
      ...PROGRAM,
      draftVersion: null,
      currentVersion: { id: 'v9', versionNumber: '1.0', status: 'ACTIVE' },
      versions: [{ id: 'v9', versionNumber: '1.0', status: 'ACTIVE' }],
    });
    await openTab('Khung chương trình');
    expect(await here()).toBe('/programs/p1/versions/v9/curriculum');
  });

  it('links to the request form when the edit must go through a request', async () => {
    renderPage({ ...PROGRAM, editPath: 'VIA_REQUEST' }, [], {
      ...ME,
      permissions: ['program.view', 'changeRequest.create'],
    });
    const button = await screen.findByRole('button', { name: 'Tạo đề xuất' });
    expect(button.closest('a')).toHaveAttribute(
      'href',
      '/change-requests/new?type=PROGRAM_INFO&targetType=PROGRAM&targetId=p1',
    );
    expect(
      screen.queryByRole('button', { name: 'Sửa thông tin' }),
    ).not.toBeInTheDocument();
  });

  it('hides every edit control from a caller with no edit path, manage right or clone right', async () => {
    renderPage({
      ...PROGRAM,
      editPath: null,
      canManage: false,
      canClone: false,
    });
    await screen.findByText('Thông tin chương trình');
    for (const name of [
      'Sửa thông tin',
      'Tạo đề xuất',
      'Nhân bản',
      'Ngừng sử dụng',
      'Phân công',
    ])
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
  });

  it('hides the director actions without canManage', async () => {
    renderPage({ ...PROGRAM, canManage: false }, [director()]);
    expect(await screen.findByText('Nguyễn An')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Kết thúc' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Thu hồi' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Phân công' }),
    ).not.toBeInTheDocument();
  });

  it('lists active rows first and offers end and revoke only on rows still in force', async () => {
    renderPage(PROGRAM, [
      director({
        id: 'old',
        director: { id: 'u2', fullName: 'Trần Bình' },
        validFrom: '2025-01-01',
        validTo: '2025-12-31',
        state: 'EXPIRED',
      }),
      director(),
    ]);
    const card = (await screen.findByText('Trần Bình')).closest('.ant-card')!;
    const rows = within(card as HTMLElement).getAllByRole('row');
    // rows[0] is the header.
    expect(rows[1]).toHaveTextContent('Nguyễn An');
    expect(rows[1]).toHaveTextContent('Đang hiệu lực');
    expect(rows[1]).toHaveTextContent('Kết thúc');
    expect(rows[1]).toHaveTextContent('Thu hồi');
    expect(rows[2]).toHaveTextContent('Trần Bình');
    expect(rows[2]).toHaveTextContent('Đã hết hạn');
    expect(rows[2]).not.toHaveTextContent('Kết thúc');
    expect(rows[2]).not.toHaveTextContent('Thu hồi');
    expect(screen.getByRole('button', { name: 'Phân công' })).toBeEnabled();
  });

  it('offers no assignment on a deactivated program', async () => {
    renderPage({ ...PROGRAM, status: 'INACTIVE' }, []);
    await screen.findByText('Chưa phân công Giám đốc CTĐT');
    expect(
      screen.queryByRole('button', { name: 'Phân công' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Dùng lại' }),
    ).toBeInTheDocument();
  });

  it('asks before deactivating, then posts the action', async () => {
    const { writes } = renderPage();
    fireEvent.click(
      await screen.findByRole('button', { name: 'Ngừng sử dụng' }),
    );
    const dialog = await screen.findByRole('dialog');
    expect(writes).toHaveLength(0);
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Ngừng sử dụng' }),
    );
    await waitFor(() =>
      expect(writes).toEqual([
        { url: '/api/programs/p1/deactivate', method: 'POST' },
      ]),
    );
  });

  it('transforms into proposal mode and keeps the copy version on sub-tab navigation', async () => {
    renderPage(
      PROGRAM,
      [],
      ME,
      '/programs/p1/versions/v_copy/curriculum',
      {
        id: 'v_copy',
        versionNumber: '1.2',
        status: 'DRAFT',
        sourceRequest: {
          id: 'req123',
          requestCode: 'DX-2026-0113',
          status: 'DRAFT',
        },
      },
    );
    expect(
      await screen.findByText('Bản nháp đề xuất DX-2026-0113'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /Quay lại đề xuất DX-2026-0113/ }),
    ).toHaveAttribute('href', '/change-requests/req123/edit');
    expect(
      screen.getByRole('button', { name: 'Về bàn soạn đề xuất' }),
    ).toBeInTheDocument();

    // Verify sub-tabs navigation stays on the working copy
    fireEvent.click(screen.getByRole('tab', { name: 'Nhóm tự chọn' }));
    expect(await here()).toBe('/programs/p1/versions/v_copy/elective-groups');
  });
});
