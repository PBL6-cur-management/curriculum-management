import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
      directors: [{ id: 'u1', fullName: 'Nguyễn An' }],
    },
    {
      id: 'p2',
      programCode: '1024035',
      degreeLevel: 'BACHELOR',
      status: 'ACTIVE',
      faculty: FACULTY,
      programName: 'Công nghệ thông tin',
      currentVersion: { id: 'v2', versionNumber: '1.0', status: 'ACTIVE' },
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
    expect(first).toHaveTextContent('Nháp');
    expect(first).toHaveTextContent('Nguyễn An');
    const second = screen.getByText('Công nghệ thông tin').closest('tr')!;
    expect(second).toHaveTextContent('Cử nhân');
    expect(second).toHaveTextContent('1.0');
    expect(second).toHaveTextContent('Chưa gán');
    const request = programRequests(fetchMock).at(-1)!;
    expect(request.searchParams.get('status')).toBe('ACTIVE');
    expect(request.searchParams.get('page')).toBe('1');
  });

  it('refetches with the degree level when the filter changes', async () => {
    const fetchMock = mockFetch();
    renderPage();
    await screen.findByText('Kỹ thuật máy tính');
    fireEvent.mouseDown(screen.getAllByRole('combobox')[0]);
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

  it('hides the add button without program.editInfo and shows it with it', async () => {
    mockFetch();
    renderPage();
    await screen.findByText('Kỹ thuật máy tính');
    expect(
      screen.queryByRole('button', { name: 'Thêm chương trình' }),
    ).not.toBeInTheDocument();
  });

  it('shows the add button for a holder of program.editInfo', async () => {
    mockFetch(['program.view', 'program.editInfo']);
    renderPage();
    expect(
      await screen.findByRole('button', { name: 'Thêm chương trình' }),
    ).toBeInTheDocument();
  });
});
