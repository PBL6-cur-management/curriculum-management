import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from 'antd';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MajorsPage } from './MajorsPage';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

const MAJOR_PAGE = {
  items: [
    {
      id: 'm1',
      majorCode: '7480201',
      majorName: 'Công nghệ Thông tin',
      englishName: 'Information Technology',
      degreeGroup: 'CD01',
      faculty: { id: 'f1', unitCode: 'KHOA_CNTT', unitName: 'Khoa CNTT' },
      status: 'ACTIVE',
      programCount: 3,
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
    },
  ],
  total: 1,
  page: 1,
  pageSize: 20,
};

function renderPage(permissions: string[] = ['program.view', 'program.editInfo']) {
  const writes: { method: string; url: string; body: unknown }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (init?.method && init.method !== 'GET') {
        writes.push({
          method: init.method,
          url,
          body: init.body ? JSON.parse(String(init.body)) : undefined,
        });
        return Promise.resolve(json(MAJOR_PAGE.items[0]));
      }
      if (url === '/api/auth/me') {
        return Promise.resolve(
          json({
            id: 'u1',
            username: 'admin',
            userCode: 'AD',
            fullName: 'Quản trị',
            email: null,
            mustChangePassword: false,
            orgUnit: null,
            roles: [],
            permissions,
          }),
        );
      }
      if (url === '/api/org-units') {
        return Promise.resolve(
          json([
            {
              id: 'f1',
              unitCode: 'KHOA_CNTT',
              unitName: 'Khoa CNTT',
              unitType: 'FACULTY',
              isExternal: false,
              parentUnitId: null,
              status: 'ACTIVE',
            },
          ]),
        );
      }
      if (url.startsWith('/api/majors')) {
        return Promise.resolve(json(MAJOR_PAGE));
      }
      return Promise.resolve(json({}));
    }),
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
        <MemoryRouter>
          <MajorsPage />
        </MemoryRouter>
      </App>
    </QueryClientProvider>,
  );

  return { writes };
}

afterEach(() => vi.unstubAllGlobals());

describe('MajorsPage', () => {
  it('renders national majors with degree group and faculty', async () => {
    renderPage(['program.view']);
    expect(await screen.findByText('7480201')).toBeInTheDocument();
    expect(screen.getByText('Công nghệ Thông tin')).toBeInTheDocument();
    expect(screen.getByText('Đại học (7xxxxxx)')).toBeInTheDocument();
    expect(screen.getByText('Khoa CNTT')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Thêm ngành/ }),
    ).not.toBeInTheDocument();
  });

  it('creates a new major when permitted', async () => {
    const { writes } = renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /Thêm ngành/ }));
    fireEvent.change(await screen.findByLabelText('Mã ngành quốc gia'), {
      target: { value: '7480106' },
    });
    fireEvent.change(screen.getByLabelText('Tên ngành (tiếng Việt)'), {
      target: { value: 'Kỹ thuật Máy tính' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Tạo ngành' }));
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]).toEqual({
      method: 'POST',
      url: '/api/majors',
      body: expect.objectContaining({
        majorCode: '7480106',
        majorName: 'Kỹ thuật Máy tính',
      }),
    });
  });
});
