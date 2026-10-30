import { fireEvent, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { App } from 'antd';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  SyncConfiguration,
  SyncConflict,
  SyncRun,
} from '../api/schoolSync';
import { SchoolSyncRunDetailPage } from './SchoolSyncRunDetailPage';
import { SchoolSyncRunsPage } from './SchoolSyncRunsPage';
import { SchoolSyncSettingsPage } from './SchoolSyncSettingsPage';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

function configuration(
  patch: Partial<SyncConfiguration> = {},
): SyncConfiguration {
  return {
    id: 'c1',
    revision: 3,
    mode: 'EXCEL_ONLY',
    profile: 'SIMULATED_SQL_SERVER',
    enabled: false,
    sourceIdentity: 'SYNTHETIC-SCHOOL-V1',
    host: null,
    port: null,
    database: null,
    username: null,
    passwordConfigured: false,
    connectionRevision: 1,
    verifiedConnectionRevision: null,
    cadence: 'DAILY',
    localTime: '02:00',
    weekday: null,
    timeZone: 'Asia/Ho_Chi_Minh',
    nextRunAt: null,
    lastSuccessfulRunId: null,
    lastSnapshotVersion: null,
    activeRunId: null,
    externalAllowed: false,
    updatedAt: '2026-10-31T00:00:00.000Z',
    ...patch,
  };
}

const SCHOOL_DB = {
  mode: 'SCHOOL_DB',
  host: 'localhost',
  port: 14330,
  database: 'CMS_SYNC_SIM',
  username: 'cms_sync_reader',
  passwordConfigured: true,
} as const;

function run(patch: Partial<SyncRun> = {}): SyncRun {
  return {
    id: 'r1',
    dataSource: 'SCHOOL_DB',
    profile: 'SIMULATED_SQL_SERVER',
    trigger: 'MANUAL',
    retryOfId: null,
    status: 'SUCCEEDED',
    startedAt: '2026-10-31T01:00:00.000Z',
    finishedAt: '2026-10-31T01:00:05.000Z',
    expiresAt: '2026-10-31T01:30:00.000Z',
    configurationRevision: 3,
    snapshotVersion: 'v1',
    recordCount: 5,
    studentCount: 2,
    resultCount: 2,
    classCount: 1,
    changedCount: 3,
    conflictCount: 0,
    errorCode: null,
    errorMessage: null,
    canRetry: false,
    ...patch,
  };
}

interface Write {
  method: string;
  url: string;
  body: unknown;
}

function stub(reads: Record<string, unknown>) {
  const writes: Write[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string, init?: RequestInit) => {
      const url = String(input).replace(/^.*\/api/, '/api');
      const method = init?.method ?? 'GET';
      if (method !== 'GET') {
        writes.push({
          method,
          url,
          body: init?.body ? JSON.parse(String(init.body)) : undefined,
        });
        const answer = reads[`${method} ${url}`];
        return answer instanceof Response ? answer : json(answer ?? {});
      }
      const path = url.split('?')[0]!;
      return path in reads
        ? json(reads[path])
        : json({ message: 'Not found' }, 404);
    }),
  );
  return writes;
}

function renderAt(element: ReactNode, route: string, entry: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createMemoryRouter(
    [
      { path: route, element },
      {
        path: '/school-db-sync/runs/:runId',
        element: <SchoolSyncRunDetailPage />,
      },
    ],
    { initialEntries: [entry] },
  );
  render(
    <QueryClientProvider client={client}>
      <App>
        <RouterProvider router={router} />
      </App>
    </QueryClientProvider>,
  );
  return router;
}

afterEach(() => vi.unstubAllGlobals());

describe('SchoolSyncSettingsPage', () => {
  it('keeps Excel as the default and cannot run without a school connection (US-102 AC4)', async () => {
    stub({
      '/api/school-db-sync/configuration': configuration(),
      '/api/school-db-sync/mappings': { revision: 3, items: [] },
    });
    renderAt(<SchoolSyncSettingsPage />, '/school-db-sync', '/school-db-sync');
    expect(
      await screen.findByRole('heading', { name: 'Đồng bộ CSDL Trường' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Chỉ nhập Excel')).toBeChecked();
    expect(screen.getByRole('button', { name: 'Đồng bộ ngay' })).toBeDisabled();
    expect(screen.queryByLabelText('Máy chủ')).not.toBeInTheDocument();
  });

  it('never shows the saved password and only sends a new one when typed (US-102 AC2)', async () => {
    const writes = stub({
      '/api/school-db-sync/configuration': configuration({ ...SCHOOL_DB }),
      '/api/school-db-sync/mappings': { revision: 3, items: [] },
      'PUT /api/school-db-sync/configuration': configuration({
        ...SCHOOL_DB,
        revision: 4,
      }),
    });
    renderAt(<SchoolSyncSettingsPage />, '/school-db-sync', '/school-db-sync');
    const password = await screen.findByLabelText('Mật khẩu');
    expect(password).toHaveValue('');
    expect(screen.getByText(/không bao giờ hiển thị lại/)).toBeInTheDocument();
    expect(screen.getByText(/bản mô phỏng SQL Server/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Lưu cấu hình' }));
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]).toMatchObject({
      method: 'PUT',
      url: '/api/school-db-sync/configuration',
    });
    expect(writes[0]!.body).toMatchObject({
      revision: 3,
      mode: 'SCHOOL_DB',
      host: 'localhost',
    });
    expect(writes[0]!.body).not.toHaveProperty('password');
  });

  it('tests the saved connection and shows the sanitized outcome (US-102 AC1)', async () => {
    const writes = stub({
      '/api/school-db-sync/configuration': configuration({ ...SCHOOL_DB }),
      '/api/school-db-sync/mappings': { revision: 3, items: [] },
      'POST /api/school-db-sync/connection-test': {
        success: false,
        code: 'READ_ONLY_REQUIRED',
        message: 'Tài khoản kết nối có quyền ghi. Hãy dùng tài khoản chỉ đọc.',
        testedAt: '2026-10-31T01:00:00.000Z',
        configurationRevision: 3,
      },
    });
    renderAt(<SchoolSyncSettingsPage />, '/school-db-sync', '/school-db-sync');
    fireEvent.click(
      await screen.findByRole('button', { name: 'Kiểm tra kết nối đã lưu' }),
    );
    expect(await screen.findByText(/tài khoản chỉ đọc/)).toBeInTheDocument();
    expect(writes[0]).toMatchObject({
      url: '/api/school-db-sync/connection-test',
      body: { configurationRevision: 3 },
    });
  });

  it('starts a run once the saved connection is verified and opens it (US-103 AC1)', async () => {
    const writes = stub({
      '/api/school-db-sync/configuration': configuration({
        ...SCHOOL_DB,
        verifiedConnectionRevision: 1,
        enabled: true,
        nextRunAt: '2026-10-31T19:00:00.000Z',
      }),
      '/api/school-db-sync/mappings': { revision: 3, items: [] },
      'POST /api/school-db-sync/runs': run({
        id: 'r9',
        status: 'RUNNING',
        finishedAt: null,
      }),
      '/api/school-db-sync/runs/r9': run({ id: 'r9' }),
    });
    renderAt(<SchoolSyncSettingsPage />, '/school-db-sync', '/school-db-sync');
    expect(
      await screen.findByText(/Lần chạy tiếp theo: 02:00, 01\/11\/2026/),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Đồng bộ ngay' }));
    expect(
      await screen.findByRole('heading', { name: /Lần đồng bộ/ }),
    ).toBeInTheDocument();
    expect((writes[0]!.body as { requestId: string }).requestId).toMatch(
      /^[0-9a-f-]{36}$/,
    );
  });

  it('locks the configuration while a run is in progress (US-103 AC3)', async () => {
    stub({
      '/api/school-db-sync/configuration': configuration({
        ...SCHOOL_DB,
        verifiedConnectionRevision: 1,
        activeRunId: 'r2',
      }),
      '/api/school-db-sync/mappings': { revision: 3, items: [] },
    });
    renderAt(<SchoolSyncSettingsPage />, '/school-db-sync', '/school-db-sync');
    expect(
      await screen.findByText(/Cấu hình và ánh xạ được khóa/),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lưu cấu hình' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Đồng bộ ngay' })).toBeDisabled();
  });
});

describe('SchoolSyncRunsPage', () => {
  it('lists runs with their outcome and filters by status in the URL (US-103 AC4)', async () => {
    stub({
      '/api/school-db-sync/runs': {
        items: [
          run(),
          run({
            id: 'r2',
            status: 'FAILED',
            recordCount: 0,
            studentCount: 0,
            resultCount: 0,
            classCount: 0,
            changedCount: 0,
            errorCode: 'CONNECTION_FAILED',
            errorMessage: 'x',
          }),
        ],
        total: 2,
        page: 1,
        pageSize: 20,
      },
    });
    const router = renderAt(
      <SchoolSyncRunsPage />,
      '/school-db-sync/runs',
      '/school-db-sync/runs',
    );
    expect(await screen.findByText('Thành công')).toBeInTheDocument();
    expect(screen.getByText('Thất bại')).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByLabelText('Lọc trạng thái'));
    fireEvent.click(await screen.findByTitle('Thất bại'));
    await waitFor(() =>
      expect(router.state.location.search).toBe('?status=FAILED'),
    );
  });
});

describe('SchoolSyncRunDetailPage', () => {
  it('shows the reason a run failed and retries as a new run (US-103 AC4/5)', async () => {
    const writes = stub({
      '/api/school-db-sync/runs/r2': run({
        id: 'r2',
        status: 'FAILED',
        recordCount: 0,
        studentCount: 0,
        resultCount: 0,
        classCount: 0,
        changedCount: 0,
        errorCode: 'CONNECTION_FAILED',
        errorMessage:
          'Không kết nối được CSDL Trường (máy chủ, cổng hoặc tài khoản).',
        canRetry: true,
      }),
      'POST /api/school-db-sync/runs/r2/retry': run({
        id: 'r3',
        trigger: 'RETRY',
        retryOfId: 'r2',
        status: 'RUNNING',
        finishedAt: null,
      }),
      '/api/school-db-sync/runs/r3': run({
        id: 'r3',
        trigger: 'RETRY',
        retryOfId: 'r2',
      }),
    });
    renderAt(
      <SchoolSyncRunDetailPage />,
      '/school-db-sync/runs/:runId',
      '/school-db-sync/runs/r2',
    );
    expect(
      await screen.findByText(/Không kết nối được CSDL Trường/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Không có thay đổi nào được ghi/),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Chạy lại' }));
    expect(await screen.findByText('lần thất bại trước')).toBeInTheDocument();
    expect(writes[0]!.url).toBe('/api/school-db-sync/runs/r2/retry');
  });

  it('shows both the Excel and the school values of a conflict (US-104 AC1)', async () => {
    const conflict: SyncConflict = {
      id: 'k1',
      entityType: 'ACADEMIC_RESULT',
      recordKey: 'SYN00003|1020010|2026-2027-1',
      previousSource: 'EXCEL',
      selectedSource: 'SCHOOL_DB',
      fields: ['score10'],
      before: [{ field: 'score10', value: '7.00' }],
      after: [{ field: 'score10', value: '8.50' }],
    };
    stub({
      '/api/school-db-sync/runs/r1': run({ conflictCount: 1 }),
      '/api/school-db-sync/runs/r1/conflicts': {
        items: [conflict],
        total: 1,
        page: 1,
        pageSize: 20,
      },
    });
    renderAt(
      <SchoolSyncRunDetailPage />,
      '/school-db-sync/runs/:runId',
      '/school-db-sync/runs/r1',
    );
    expect(await screen.findByText('Xung đột với Excel')).toBeInTheDocument();
    expect(await screen.findByText('Điểm thang 10: 7.00')).toBeInTheDocument();
    expect(screen.getByText('Điểm thang 10: 8.50')).toBeInTheDocument();
    expect(
      screen.getByText('SYN00003 · 1020010 · 2026-2027-1'),
    ).toBeInTheDocument();
  });
});
