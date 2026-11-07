import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { App } from 'antd';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProgramListPage } from './ProgramListPage';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });
const FACULTY = { id: 'f1', unitCode: 'KHOA_CNTT', unitName: 'Khoa CNTT' };
const page = {
  items: [
    {
      id: 'p1',
      programCode: '1024034',
      degreeLevel: 'ENGINEER',
      status: 'ACTIVE',
      faculty: FACULTY,
      programName: 'Kỹ thuật máy tính',
      currentVersion: { id: 'v1', versionNumber: null, status: 'DRAFT' },
      majorCode: '7480106',
      majorName: 'Ngành máy tính',
      releasedVersions: [],
      directors: [{ id: 'u1', fullName: 'Nguyễn An' }],
    },
    {
      id: 'p2',
      programCode: '1024035',
      degreeLevel: 'BACHELOR',
      status: 'ACTIVE',
      faculty: FACULTY,
      programName: 'Công nghệ thông tin',
      currentVersion: { id: 'v3', versionNumber: '2.0', status: 'ACTIVE' },
      majorCode: '7480201',
      majorName: 'Ngành phần mềm',
      releasedVersions: [
        {
          id: 'v2',
          versionNumber: '1.0',
          status: 'HISTORICAL',
          releaseYear: 2020,
          cohorts: [{ id: 'c1', cohortCode: 'K2020', intakeYear: 2020 }],
        },
        {
          id: 'v3',
          versionNumber: '2.0',
          status: 'ACTIVE',
          releaseYear: null,
          cohorts: [
            { id: 'c2', cohortCode: 'ABC', intakeYear: 2022 },
            { id: 'c1', cohortCode: 'K2020', intakeYear: 2020 },
          ],
        },
      ],
      directors: [],
    },
  ],
  total: 2,
  page: 1,
  pageSize: 20,
};
const ME = {
  id: 'u1',
  username: 'admin',
  userCode: 'AD',
  fullName: 'Quản trị',
  email: null,
  mustChangePassword: false,
  orgUnit: null,
  roles: [],
  permissions: ['program.view'],
};

function mockFetch(permissions: string[] = ['program.view']) {
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    return Promise.resolve(
      url === '/api/auth/me'
        ? json({ ...ME, permissions })
        : url === '/api/org-units'
          ? json([
              {
                id: 'f1',
                unitCode: 'KHOA_CNTT',
                unitName: 'Khoa CNTT',
                unitType: 'FACULTY',
                status: 'ACTIVE',
              },
            ])
          : url.startsWith('/api/programs')
            ? json(page)
            : json({}),
    );
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function programRequests(fetchMock: ReturnType<typeof mockFetch>): URL[] {
  return fetchMock.mock.calls
    .map(([input]) => String(input))
    .filter((url) => url.startsWith('/api/programs'))
    .map((url) => new URL(url, 'http://localhost'));
}

function renderPage() {
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <App>
        <MemoryRouter>
          <ProgramListPage />
        </MemoryRouter>
      </App>
    </QueryClientProvider>,
  );
}

afterEach(() => vi.unstubAllGlobals());

describe('ProgramListPage', () => {
  it('lists programs with the Draft label, level and directors, active only by default', async () => {
    const fetchMock = mockFetch();
    renderPage();
    const first = (await screen.findByText('Kỹ thuật máy tính')).closest('tr')!;
    expect(first).toHaveTextContent('1024034');
    expect(first).toHaveTextContent('Kỹ sư');
    expect(first).toHaveTextContent('7480106');
    expect(first).toHaveTextContent('Khoa CNTT');
    expect(first).toHaveTextContent('Nguyễn An');
    const second = screen.getByText('Công nghệ thông tin').closest('tr')!;
    expect(second).toHaveTextContent('Cử nhân');
    expect(second).toHaveTextContent('Chưa gán');
    const request = programRequests(fetchMock).at(-1)!;
    expect(request.searchParams.get('status')).toBe('ACTIVE');
    expect(request.searchParams.get('page')).toBe('1');
  });

  it('lists released versions as links, marking only the active one, and says so when none', async () => {
    mockFetch();
    renderPage();
    const first = (await screen.findByText('Kỹ thuật máy tính')).closest('tr')!;
    expect(first).toHaveTextContent('Chưa ban hành');
    expect(first).toHaveTextContent('Chưa gán khóa');
    const second = screen.getByText('Công nghệ thông tin').closest('tr')!;
    const old = within(second).getByRole('link', { name: '1.0 · 2020' });
    expect(old).toHaveAttribute('href', '/programs/p2/versions/v2/curriculum');
    const current = within(second).getByRole('link', { name: '2.0' });
    expect(current).toHaveAttribute(
      'href',
      '/programs/p2/versions/v3/curriculum',
    );
    expect(current.parentElement).toHaveTextContent('đang áp dụng');
    expect(old.parentElement).not.toHaveTextContent('đang áp dụng');
  });

  it('links each cohort to the newest version it follows', async () => {
    mockFetch();
    renderPage();
    const second = (await screen.findByText('Công nghệ thông tin')).closest(
      'tr',
    )!;
    expect(within(second).getByRole('link', { name: 'K2020' })).toHaveAttribute(
      'href',
      '/programs/p2/versions/v3/curriculum',
    );
    expect(
      within(second).getByRole('link', { name: 'ABC (2022)' }),
    ).toHaveAttribute('href', '/programs/p2/versions/v3/curriculum');
  });

  it('writes the year filters to the query and resets the page', async () => {
    const fetchMock = mockFetch();
    renderPage();
    await screen.findByText('Kỹ thuật máy tính');
    for (const [name, param] of [
      ['Năm ban hành', 'releaseYear'],
      ['Năm tuyển sinh', 'intakeYear'],
    ] as const) {
      const input = screen.getByRole('textbox', { name });
      fireEvent.mouseDown(input);
      fireEvent.change(input, { target: { value: '2021' } });
      fireEvent.keyDown(input, { key: 'Enter', keyCode: 13 });
      await waitFor(() => {
        const last = programRequests(fetchMock).at(-1)!;
        expect(last.searchParams.get(param)).toBe('2021');
        expect(last.searchParams.get('page')).toBe('1');
      });
    }
  });

  it('sends the faculty filter', async () => {
    const fetchMock = mockFetch();
    renderPage();
    await screen.findByText('Kỹ thuật máy tính');
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Khoa quản lý' }));
    fireEvent.click(await screen.findByTitle('Khoa CNTT'));
    await waitFor(() =>
      expect(
        programRequests(fetchMock).at(-1)?.searchParams.get('facultyId'),
      ).toBe('f1'),
    );
  });

  it('refetches with the degree level when the filter changes', async () => {
    const fetchMock = mockFetch();
    renderPage();
    await screen.findByText('Kỹ thuật máy tính');
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Trình độ' }));
    fireEvent.click(await screen.findByTitle('Cử nhân'));
    await waitFor(() =>
      expect(
        programRequests(fetchMock).at(-1)?.searchParams.get('degreeLevel'),
      ).toBe('BACHELOR'),
    );
  });

  it('sends no status filter when "Tất cả" is chosen', async () => {
    const fetchMock = mockFetch();
    renderPage();
    await screen.findByText('Kỹ thuật máy tính');
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Trạng thái' }));
    fireEvent.click(await screen.findByTitle('Tất cả'));
    await waitFor(() => {
      const last = programRequests(fetchMock).at(-1)!;
      expect(last.searchParams.has('status')).toBe(false);
    });
  });

  it('sends one search request after the debounce', async () => {
    const fetchMock = mockFetch();
    renderPage();
    await screen.findByText('Kỹ thuật máy tính');
    const before = programRequests(fetchMock).length;
    fireEvent.change(
      screen.getByPlaceholderText('Tìm theo mã hoặc tên chương trình'),
      { target: { value: '1024' } },
    );
    expect(programRequests(fetchMock)).toHaveLength(before);
    await waitFor(() =>
      expect(programRequests(fetchMock).at(-1)?.searchParams.get('q')).toBe(
        '1024',
      ),
    );
    expect(programRequests(fetchMock)).toHaveLength(before + 1);
  });

  it('offers no add button, even to a holder of program.editInfo', async () => {
    mockFetch(['program.view', 'program.editInfo']);
    renderPage();
    await screen.findByText('Kỹ thuật máy tính');
    expect(
      screen.queryByRole('button', { name: 'Thêm chương trình' }),
    ).not.toBeInTheDocument();
  });
});
