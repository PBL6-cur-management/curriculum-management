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
import type { IntegrationClient } from '../api/integrationClients';
import { IntegrationClientsPage } from './IntegrationClientsPage';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

function client(patch: Partial<IntegrationClient> = {}): IntegrationClient {
  return {
    id: 'c1',
    clientName: 'dDUT',
    status: 'ACTIVE',
    rateLimit: 60,
    createdByName: 'Phòng Đào tạo',
    createdAt: '2026-10-31T01:00:00.000Z',
    lastCalledAt: null,
    ...patch,
  };
}

interface Call {
  method: string;
  url: string;
  body: unknown;
}

function stub(
  items: IntegrationClient[],
  answers: Record<string, unknown> = {},
) {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string, init?: RequestInit) => {
      const url = String(input).replace(/^.*\/api/, '/api');
      const method = init?.method ?? 'GET';
      calls.push({
        method,
        url,
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
      });
      if (method === 'GET')
        return json({ items, total: items.length, page: 1, pageSize: 20 });
      const answer = answers[`${method} ${url.split('?')[0]}`];
      return answer instanceof Response ? answer : json(answer ?? {});
    }),
  );
  return calls;
}

function renderPage(entry = '/integration-clients') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createMemoryRouter(
    [{ path: '/integration-clients', element: <IntegrationClientsPage /> }],
    { initialEntries: [entry] },
  );
  render(
    <QueryClientProvider client={queryClient}>
      <App>
        <RouterProvider router={router} />
      </App>
    </QueryClientProvider>,
  );
  return router;
}

afterEach(() => vi.unstubAllGlobals());

describe('IntegrationClientsPage (MH-11)', () => {
  it('lists partners with status, quota and last call, and links the dDUT contract without a key', async () => {
    stub([
      client(),
      client({
        id: 'c2',
        clientName: 'dDUT thử',
        status: 'LOCKED',
        rateLimit: 10,
        lastCalledAt: '2026-10-31T02:00:00.000Z',
      }),
    ]);
    renderPage();
    expect(await screen.findByText('dDUT thử')).toBeTruthy();
    expect(screen.getByText('Đang hoạt động')).toBeTruthy();
    expect(screen.getByText('Đã khóa')).toBeTruthy();
    expect(screen.getByText('Chưa gọi')).toBeTruthy();
    expect(
      screen
        .getByRole('link', { name: 'Tài liệu API dDUT' })
        .getAttribute('href'),
    ).toBe('/api/v1/docs');
    expect(screen.getByRole('button', { name: 'Mở khóa' })).toBeTruthy();
  });

  it('shows an empty state with the add action', async () => {
    stub([]);
    renderPage();
    expect(await screen.findByText('Chưa có bên tích hợp nào')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Thêm bên tích hợp' }),
    ).toBeTruthy();
  });

  it('creates a partner and shows its key once, then forgets it (US-098 AC1/2)', async () => {
    const calls = stub([], {
      'POST /api/integration-clients': {
        client: client({ clientName: 'dDUT mới' }),
        apiKey: 'ddut_secretvalue',
      },
    });
    renderPage();
    fireEvent.click(
      await screen.findByRole('button', { name: 'Thêm bên tích hợp' }),
    );
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Tên bên tích hợp'), {
      target: { value: 'dDUT mới' },
    });
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Tạo và cấp khóa' }),
    );
    expect(await screen.findByText('Khóa chỉ hiển thị một lần')).toBeTruthy();
    expect(screen.getByText('ddut_secretvalue')).toBeTruthy();
    expect(calls.find((call) => call.method === 'POST')?.body).toEqual({
      clientName: 'dDUT mới',
      rateLimit: 60,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Tôi đã lưu khóa' }));
    await waitFor(() =>
      expect(screen.queryByText('ddut_secretvalue')).toBeNull(),
    );
  });

  it('puts a duplicate name error under the name field', async () => {
    stub([], {
      'POST /api/integration-clients': json(
        {
          statusCode: 409,
          code: 'INTEGRATION_CLIENT_NAME_TAKEN',
          message: 'Tên bên tích hợp đã tồn tại.',
          details: [{ field: 'clientName', constraints: ['unique'] }],
        },
        409,
      ),
    });
    renderPage();
    fireEvent.click(
      await screen.findByRole('button', { name: 'Thêm bên tích hợp' }),
    );
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Tên bên tích hợp'), {
      target: { value: 'dDUT' },
    });
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Tạo và cấp khóa' }),
    );
    expect(
      await within(dialog).findByText('Tên bên tích hợp đã tồn tại.'),
    ).toBeTruthy();
  });

  it('locks a partner after confirmation (US-098 AC4)', async () => {
    const calls = stub([client()], {
      'POST /api/integration-clients/c1/lock': client({ status: 'LOCKED' }),
    });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Khóa' }));
    const confirm = await screen.findByText(
      'Khóa bên tích hợp này? Mọi lần gọi sau đó bị từ chối.',
    );
    const popover = confirm.closest('.ant-popover') as HTMLElement;
    fireEvent.click(within(popover).getByRole('button', { name: 'Khóa' }));
    await waitFor(() =>
      expect(
        calls.some(
          (call) =>
            call.method === 'POST' &&
            call.url === '/api/integration-clients/c1/lock',
        ),
      ).toBe(true),
    );
  });

  it('filters by status through the URL and resets the page', async () => {
    const calls = stub([client()]);
    renderPage('/integration-clients?status=LOCKED&page=2');
    await screen.findByText('dDUT');
    expect(calls[0]!.url).toContain('status=LOCKED');
    expect(calls[0]!.url).toContain('page=2');
  });
});
