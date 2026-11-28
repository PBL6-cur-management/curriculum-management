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
      activeProgramCount: 2,
      studentCount: 1250,
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
    },
  ],
  total: 1,
  page: 1,
  pageSize: 20,
};

function renderPage(
  permissions: string[] = ['program.view', 'program.editInfo'],
) {
  const writes: { method: string; url: string; body: unknown }[] = [];
  const requestedUrls: string[] = [];

  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      requestedUrls.push(url);
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

  return { writes, requestedUrls };
}

afterEach(() => vi.unstubAllGlobals());

describe('MajorsPage', () => {
  it('renders national majors with quick-nav links, counts, and read-only actions', async () => {
    renderPage(['program.view']);
    const codeLink = (await screen.findByText('7480201')).closest('a');
    expect(codeLink).toHaveAttribute('href', '/majors/m1');

    const nameLink = screen.getByText('Công nghệ Thông tin').closest('a');
    expect(nameLink).toHaveAttribute('href', '/majors/m1');

    expect(screen.getByText('Đại học')).toBeInTheDocument();

    const facultyLink = screen.getByText('Khoa CNTT').closest('a');
    expect(facultyLink).toHaveAttribute('href', '/programs?facultyId=f1');

    const programCountLink = screen.getByText('3 (2 đang ĐT)').closest('a');
    expect(programCountLink).toHaveAttribute(
      'href',
      '/programs?majorId=m1&status=ALL',
    );

    expect(screen.getByText('1.250')).toBeInTheDocument();

    expect(
      screen.getByRole('link', { name: 'Danh sách CTĐT' }),
    ).toHaveAttribute('href', '/programs');
    expect(
      screen.getByRole('link', { name: 'Báo cáo so sánh' }),
    ).toHaveAttribute('href', '/reports/program-comparison');
    expect(screen.getByRole('link', { name: 'Chi tiết' })).toHaveAttribute(
      'href',
      '/majors/m1',
    );
    expect(screen.getByRole('link', { name: 'CTĐT' })).toHaveAttribute(
      'href',
      '/programs?majorId=m1&status=ALL',
    );
    expect(
      screen.queryByRole('button', { name: /Thêm ngành/ }),
    ).not.toBeInTheDocument();
  });

  it('sends hasPrograms=true when toggling only-with-programs switch', async () => {
    const { requestedUrls } = renderPage(['program.view']);
    await screen.findByText('7480201');

    const toggle = screen.getByRole('switch');
    fireEvent.click(toggle);

    await waitFor(() =>
      expect(
        requestedUrls.some((u) => u.includes('hasPrograms=true')),
      ).toBe(true),
    );
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
