import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from 'antd';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  BackupRun,
  BackupStatus,
  RestoreDrill,
} from '../api/backups';
import { BackupsPage } from './BackupsPage';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

function status(patch: Partial<BackupStatus> = {}): BackupStatus {
  return {
    state: 'READY',
    schedule: '0 2 * * *',
    timeZone: 'Asia/Ho_Chi_Minh',
    retentionCount: 30,
    retainedCount: 4,
    dueSlot: '2026-10-31',
    lastSuccessfulAt: '2026-10-30T19:10:00.000Z',
    lastRecoveryMs: null,
    lastAcceptedTier: null,
    currentRunId: null,
    lastFailure: null,
    ...patch,
  };
}

function backup(patch: Partial<BackupRun> = {}): BackupRun {
  return {
    id: 'daily-2026-10-31',
    scheduledFor: '2026-10-31',
    status: 'SUCCEEDED',
    startedAt: '2026-10-30T19:00:05.000Z',
    completedAt: '2026-10-30T19:10:00.000Z',
    attempt: 1,
    snapshotAt: '2026-10-30T19:00:05.000Z',
    databaseBytes: '1048576',
    fileBytes: '2048',
    fileCount: 3,
    releasedVersionCount: 2,
    durationMs: 595_000,
    failure: null,
    ...patch,
  };
}

function drill(patch: Partial<RestoreDrill> = {}): RestoreDrill {
  return {
    id: 'drill-1',
    backupId: 'daily-2026-10-31',
    tier: 'B1',
    operator: 'admin',
    status: 'RESTORED',
    startedAt: '2026-10-31T01:00:00.000Z',
    completedAt: '2026-10-31T01:02:00.000Z',
    recoveryMs: 120_000,
    databaseRestoreMs: 60_000,
    filesRestoreMs: 20_000,
    verificationMs: 40_000,
    releasedVersionCount: 2,
    checks: [{ code: 'DUMP_HASH', passed: true, message: 'Khớp' }],
    acceptedAt: null,
    acceptanceNote: null,
    failure: null,
    ...patch,
  };
}

const page = <T,>(items: T[]) => ({
  items,
  total: items.length,
  page: 1,
  pageSize: 20,
});

function stub(reads: Record<string, unknown | Response>) {
  const calls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string) => {
      const url = String(input).replace(/^.*\/api/, '/api');
      calls.push(url);
      const path = url.split('?')[0]!;
      const answer = reads[path];
      if (answer instanceof Response) return answer;
      return path in reads
        ? json(answer)
        : json({ message: 'Not found' }, 404);
    }),
  );
  return calls;
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <App>
        <BackupsPage />
      </App>
    </QueryClientProvider>,
  );
}

afterEach(() => vi.unstubAllGlobals());

describe('BackupsPage', () => {
  it('summarises the schedule and keeps unrecorded recovery apart from a measured one', async () => {
    stub({
      '/api/operations/backups/status': status(),
      '/api/operations/backups': page([backup()]),
      '/api/operations/restore-drills': page([]),
    });
    renderPage();
    expect(
      await screen.findByRole('heading', {
        name: 'Sao lưu và diễn tập phục hồi',
      }),
    ).toBeInTheDocument();
    expect(await screen.findByText('Sẵn sàng')).toBeInTheDocument();
    expect(screen.getByText('4 / 30')).toBeInTheDocument();
    expect(screen.getAllByText('Chưa ghi nhận').length).toBeGreaterThan(0);
    expect(await screen.findByText('1.0 MB')).toBeInTheDocument();
  });

  it('never offers a restore, run, prune or download action', async () => {
    stub({
      '/api/operations/backups/status': status(),
      '/api/operations/backups': page([backup()]),
      '/api/operations/restore-drills': page([drill()]),
    });
    renderPage();
    await screen.findByText('Sẵn sàng');
    expect(
      screen.getByText(/Trang này không cho phép phục hồi hoặc tải bản sao/),
    ).toBeInTheDocument();
    for (const name of [/phục hồi ngay/i, /sao lưu ngay/i, /tải xuống/i, /xóa/i])
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
  });

  it('says a backup is not protection when backups are disabled', async () => {
    stub({
      '/api/operations/backups/status': status({
        state: 'DISABLED',
        retainedCount: 0,
        lastSuccessfulAt: null,
      }),
      '/api/operations/backups': page([]),
      '/api/operations/restore-drills': page([]),
    });
    renderPage();
    expect(
      await screen.findByText(/Dữ liệu chưa được bảo vệ/),
    ).toBeInTheDocument();
    expect(await screen.findByText('Chưa có bản sao lưu nào')).toBeInTheDocument();
  });

  it('shows the failure code and message for a failed backup', async () => {
    stub({
      '/api/operations/backups/status': status({
        state: 'FAILED',
        lastFailure: { code: 'DUMP_FAILED', message: 'pg_dump thoát mã 1' },
      }),
      '/api/operations/backups': page([backup({ status: 'FAILED' })]),
      '/api/operations/restore-drills': page([]),
    });
    renderPage();
    expect(
      await screen.findByText('DUMP_FAILED: pg_dump thoát mã 1'),
    ).toBeInTheDocument();
  });

  it('keeps a restored-but-unaccepted drill apart from an accepted one', async () => {
    stub({
      '/api/operations/backups/status': status(),
      '/api/operations/backups': page([backup()]),
      '/api/operations/restore-drills': page([
        drill(),
        drill({
          id: 'drill-2',
          status: 'SUCCEEDED',
          acceptedAt: '2026-10-31T02:00:00.000Z',
        }),
      ]),
    });
    renderPage();
    await screen.findByText('Sẵn sàng');
    fireEvent.click(screen.getByRole('tab', { name: 'Diễn tập phục hồi' }));
    expect(
      await screen.findByText('Đã phục hồi — chờ nghiệm thu'),
    ).toBeInTheDocument();
    expect(screen.getByText('Đã nghiệm thu phục hồi')).toBeInTheDocument();
  });

  it('resets to page 1 and sends the filter when the status filter changes', async () => {
    const calls = stub({
      '/api/operations/backups/status': status(),
      '/api/operations/backups': page([backup()]),
      '/api/operations/restore-drills': page([]),
    });
    renderPage();
    await screen.findByText('Sẵn sàng');
    fireEvent.mouseDown(screen.getByLabelText('Lọc trạng thái sao lưu'));
    fireEvent.click(await screen.findByText('Bị gián đoạn'));
    await vi.waitFor(() =>
      expect(
        calls.some(
          (url) => url.includes('status=INTERRUPTED') && url.includes('page=1'),
        ),
      ).toBe(true),
    );
  });

  it('shows a retryable error when the catalog cannot be read', async () => {
    stub({
      '/api/operations/backups/status': json(
        { message: 'Không đọc được danh mục sao lưu.' },
        503,
      ),
      '/api/operations/backups': json({ message: 'down' }, 503),
      '/api/operations/restore-drills': page([]),
    });
    renderPage();
    expect(
      (await screen.findAllByRole('button', { name: 'Tải lại' })).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByText('Không đọc được danh mục sao lưu.'),
    ).toBeInTheDocument();
  });

  it('shows a permission result on 403', async () => {
    stub({
      '/api/operations/backups/status': json({ message: 'Forbidden' }, 403),
      '/api/operations/backups': json({ message: 'Forbidden' }, 403),
      '/api/operations/restore-drills': json({ message: 'Forbidden' }, 403),
    });
    renderPage();
    expect(
      await screen.findByText('Bạn không có quyền xem sao lưu và phục hồi.'),
    ).toBeInTheDocument();
  });
});
