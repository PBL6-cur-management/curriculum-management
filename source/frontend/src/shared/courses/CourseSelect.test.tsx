import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  COURSE_SELECT_DEBOUNCE_MS,
  CourseMultiSelect,
  CourseSelect,
} from './CourseSelect';

const page = (codes: string[], pageNumber = 1, total = codes.length) =>
  new Response(
    JSON.stringify({
      items: codes.map((code) => ({
        id: code.toLowerCase(),
        courseCode: code,
        courseName: `Học phần ${code}`,
        credits: '3',
        status: 'ACTIVE',
      })),
      total,
      page: pageNumber,
      pageSize: 20,
    }),
  );

function setup(
  ui: React.ReactElement,
  fetchPage = (_input: RequestInfo | URL) =>
    Promise.resolve(page(['IT001', 'IT002'])),
) {
  vi.useFakeTimers();
  const fetchMock = vi.fn(fetchPage);
  vi.stubGlobal('fetch', fetchMock);
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      {ui}
    </QueryClientProvider>,
  );
  return fetchMock;
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('CourseSelect', () => {
  it('debounces the search, asks for active courses and returns the chosen id', async () => {
    const onChange = vi.fn();
    const fetchMock = setup(<CourseSelect onChange={onChange} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    fireEvent.mouseDown(screen.getByRole('combobox'));
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'IT' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(COURSE_SELECT_DEBOUNCE_MS);
    });
    expect(
      fetchMock.mock.calls.some(([url]) =>
        String(url).includes('q=IT&pageSize=20&status=ACTIVE'),
      ),
    ).toBe(true);
    fireEvent.click(screen.getByText('IT002 — Học phần IT002 (3 TC)'));
    expect(onChange).toHaveBeenCalledWith('it002');
  });

  it('leaves out the excluded courses', async () => {
    setup(<CourseSelect excludeIds={['it001']} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    fireEvent.mouseDown(screen.getByRole('combobox'));
    expect(
      screen.queryByText('IT001 — Học phần IT001 (3 TC)'),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText('IT002 — Học phần IT002 (3 TC)'),
    ).toBeInTheDocument();
  });

  it('loads later pages even when the first page is excluded and restarts for a new search', async () => {
    const fetchMock = setup(
      <CourseSelect excludeIds={['it001']} />,
      (input) => {
        const query = new URL(String(input), 'http://localhost').searchParams;
        if (query.has('q')) return Promise.resolve(page(['IT999']));
        return Promise.resolve(
          query.get('page') === '2'
            ? page(['IT021'], 2, 21)
            : page(['IT001'], 1, 21),
        );
      },
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    const control = screen.getByRole('combobox');
    fireEvent.mouseDown(control);
    expect(
      screen.getByRole('button', { name: 'Tải thêm lựa chọn' }),
    ).toBeInTheDocument();
    fireEvent.keyDown(control, { key: 'PageDown' });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(
      screen.getByText('IT021 — Học phần IT021 (3 TC)'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Tải thêm lựa chọn' }),
    ).not.toBeInTheDocument();

    fireEvent.change(control, { target: { value: 'IT999' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(COURSE_SELECT_DEBOUNCE_MS);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/courses?q=IT999&pageSize=20&status=ACTIVE',
      expect.anything(),
    );
    expect(
      screen.getByText('IT999 — Học phần IT999 (3 TC)'),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('IT021 — Học phần IT021 (3 TC)'),
    ).not.toBeInTheDocument();
  });
});

describe('CourseMultiSelect', () => {
  it('returns every chosen id', async () => {
    const onChange = vi.fn();
    setup(<CourseMultiSelect onChange={onChange} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    fireEvent.mouseDown(screen.getByRole('combobox'));
    fireEvent.click(screen.getByText('IT001 — Học phần IT001 (3 TC)'));
    expect(onChange).toHaveBeenCalledWith(['it001']);
  });
});
