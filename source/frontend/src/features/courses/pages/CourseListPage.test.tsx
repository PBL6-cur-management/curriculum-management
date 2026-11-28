import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from 'antd';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CourseListPage, toCourseQuery } from './CourseListPage';

const allowed = vi.hoisted(() => new Set<string>());
vi.mock('../../../shared/auth/useCan', () => ({
  useCan: (code: string) => allowed.has(code),
}));

const HOME = { id: 'f1', unitCode: 'KHOA_CNTT', unitName: 'Khoa CNTT' };
const MATH = { id: 'f2', unitCode: 'KHOA_TOAN', unitName: 'Khoa Toán' };
const page = {
  items: [
    {
      id: 'c1',
      courseCode: 'IT001',
      courseName: 'Nhập môn lập trình',
      englishName: null,
      credits: '2.5',
      courseType: 'THEORY',
      status: 'ACTIVE',
      ownerFaculty: HOME,
      ownerGroup: null,
      isForeign: false,
    },
    {
      id: 'c2',
      courseCode: 'MATH01',
      courseName: 'Giải tích',
      englishName: null,
      credits: '3',
      courseType: 'THEORY',
      status: 'ACTIVE',
      ownerFaculty: MATH,
      ownerGroup: null,
      isForeign: true,
    },
  ],
  total: 45,
  page: 1,
  pageSize: 20,
};

function mockFetch() {
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    const body = url.includes('/api/courses')
      ? page
      : url.includes('/org-units') || url.includes('/subject-groups')
        ? []
        : {};
    return Promise.resolve(new Response(JSON.stringify(body)));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function courseRequests(fetchMock: ReturnType<typeof mockFetch>): URL[] {
  return fetchMock.mock.calls
    .map(([input]) => String(input))
    .filter((url) => url.startsWith('/api/courses'))
    .map((url) => new URL(url, 'http://localhost'));
}

function renderPage() {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <App>
        <MemoryRouter>
          <CourseListPage />
        </MemoryRouter>
      </App>
    </QueryClientProvider>,
  );
}

describe('CourseListPage', () => {
  beforeEach(() => {
    allowed.clear();
  });

  it('renders rows with the other-faculty tag and hides the add button without course.edit', async () => {
    mockFetch();
    renderPage();
    expect(await screen.findByText('Nhập môn lập trình')).toBeInTheDocument();
    const row = screen.getByText('Giải tích').closest('tr')!;
    expect(row).toHaveTextContent('Khoa khác');
    expect(
      screen.getByText('Nhập môn lập trình').closest('tr'),
    ).not.toHaveTextContent('Khoa khác');
    expect(
      screen.queryByRole('button', { name: 'Thêm học phần' }),
    ).not.toBeInTheDocument();
  });

  it('shows the add button with course.edit', async () => {
    allowed.add('course.edit');
    mockFetch();
    renderPage();
    expect(
      await screen.findByRole('button', { name: 'Thêm học phần' }),
    ).toBeInTheDocument();
  });

  it('sends one search request after the debounce with q', async () => {
    const fetchMock = mockFetch();
    renderPage();
    await screen.findByText('Nhập môn lập trình');
    const before = courseRequests(fetchMock).length;
    fireEvent.change(
      screen.getByPlaceholderText('Tìm theo mã hoặc tên học phần'),
      { target: { value: 'IT0' } },
    );
    expect(courseRequests(fetchMock)).toHaveLength(before);
    await waitFor(() =>
      expect(courseRequests(fetchMock).at(-1)?.searchParams.get('q')).toBe(
        'IT0',
      ),
    );
    expect(courseRequests(fetchMock)).toHaveLength(before + 1);
  });

  it('filters other-faculty courses and resets to page 1', async () => {
    const fetchMock = mockFetch();
    renderPage();
    await screen.findByText('Nhập môn lập trình');
    fireEvent.click(screen.getByTitle('2'));
    await waitFor(() =>
      expect(courseRequests(fetchMock).at(-1)?.searchParams.get('page')).toBe(
        '2',
      ),
    );
    fireEvent.click(screen.getByRole('radio', { name: 'Khoa khác' }));
    await waitFor(() => {
      const last = courseRequests(fetchMock).at(-1)!;
      expect(last.searchParams.get('foreign')).toBe('true');
      expect(last.searchParams.get('page')).toBe('1');
    });
  });

  it('sorts by credits descending after two clicks on the header', async () => {
    const fetchMock = mockFetch();
    renderPage();
    await screen.findByText('Nhập môn lập trình');
    const header = screen.getByRole('columnheader', { name: /Tín chỉ/ });
    fireEvent.click(header);
    fireEvent.click(header);
    await waitFor(() => {
      const last = courseRequests(fetchMock).at(-1)!;
      expect(last.searchParams.get('sort')).toBe('credits');
      expect(last.searchParams.get('order')).toBe('desc');
    });
  });
});

describe('toCourseQuery', () => {
  const base = {
    page: 3,
    pageSize: 50,
    sort: 'courseName',
    order: 'desc',
  } as const;

  it('maps the sorter to sort and order and keeps the page', () => {
    expect(
      toCourseQuery(
        base,
        { current: 2, pageSize: 50 },
        {
          columnKey: 'credits',
          order: 'descend',
        },
      ),
    ).toMatchObject({ page: 2, pageSize: 50, sort: 'credits', order: 'desc' });
  });

  it('clears sort and order when the sort is cleared so backend default applies', () => {
    expect(toCourseQuery(base, { current: 3, pageSize: 50 }, {})).toMatchObject(
      { sort: undefined, order: undefined },
    );
  });
});
