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
import type { CourseSyllabus } from '../api/syllabi';
import { attachment, clo, courseSyllabus, ME, syllabus } from '../testFixtures';
import { SyllabusPage } from './SyllabusPage';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

function renderPage(
  data: CourseSyllabus | Response,
  respond: (url: string, init?: RequestInit) => Response | undefined = () =>
    undefined,
) {
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const custom = respond(url, init);
    if (custom) return Promise.resolve(custom);
    if (url === '/api/auth/me') return Promise.resolve(json(ME));
    if (url === '/api/courses/c1/syllabus')
      return Promise.resolve(data instanceof Response ? data : json(data));
    return Promise.resolve(json({}));
  });
  vi.stubGlobal('fetch', fetchMock);
  const router = createMemoryRouter(
    [
      { path: '/courses/:courseId/syllabus', element: <SyllabusPage /> },
      { path: '/courses/:courseId/syllabus/edit', element: <p>Màn sửa</p> },
    ],
    { initialEntries: ['/courses/c1/syllabus'] },
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
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

describe('SyllabusPage', () => {
  it('says there is no syllabus and offers creation to one who may write it (KB-036)', async () => {
    renderPage(courseSyllabus({ draft: null, canCreate: true }));
    expect(
      await screen.findByText('Học phần chưa có đề cương'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tạo đề cương' })).toBeEnabled();
  });

  it('creates the Draft and opens the editor', async () => {
    const fetchMock = renderPage(
      courseSyllabus({ draft: null, canCreate: true }),
      (_url, init) =>
        init?.method === 'POST'
          ? json(courseSyllabus({ canCreate: false }), 201)
          : undefined,
    );
    fireEvent.click(
      await screen.findByRole('button', { name: 'Tạo đề cương' }),
    );
    expect(await screen.findByText('Màn sửa')).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some(
        ([url, init]) =>
          url === '/api/courses/c1/syllabus' && init?.method === 'POST',
      ),
    ).toBe(true);
  });

  it('shows no create button when the caller may not create', async () => {
    renderPage(
      courseSyllabus({ draft: null, canCreate: false, editPath: null }),
    );
    await screen.findByText('Học phần chưa có đề cương');
    expect(
      screen.queryByRole('button', { name: 'Tạo đề cương' }),
    ).not.toBeInTheDocument();
  });

  it('shows the published and the Draft revision as two tabs', async () => {
    renderPage(
      courseSyllabus({
        published: syllabus({
          id: 's0',
          status: 'PUBLISHED',
          publishedAt: '2026-09-01T00:00:00.000Z',
        }),
        draft: syllabus({ id: 's1', revisionNumber: 2 }),
        editPath: 'VIA_REQUEST',
      }),
    );
    expect(
      await screen.findByRole('tab', { name: 'Ban hành — bản 1' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('tab', { name: 'Nháp — bản 2' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Tạo đề xuất' }).closest('a'),
    ).toHaveAttribute(
      'href',
      '/change-requests/new?type=SYLLABUS_CONTENT&targetType=COURSE&targetId=c1',
    );
  });

  it('offers a grading request, and no content request, to someone who may only propose grading changes', async () => {
    renderPage(
      courseSyllabus({ editPath: null, gradingEditPath: 'VIA_REQUEST' }),
    );
    expect(
      (
        await screen.findByRole('button', {
          name: 'Đề xuất sửa công thức điểm',
        })
      ).closest('a'),
    ).toHaveAttribute(
      'href',
      '/change-requests/new?type=GRADING_FORMULA&targetType=COURSE&targetId=c1',
    );
    expect(
      screen.queryByRole('button', { name: 'Tạo đề xuất' }),
    ).not.toBeInTheDocument();
  });

  it('sends a grading-only editor straight to the formula tab', async () => {
    renderPage(
      courseSyllabus({
        editPath: null,
        gradingEditPath: 'DIRECT',
        canEditGradingFormula: true,
      }),
    );
    fireEvent.click(
      await screen.findByRole('button', { name: 'Sửa công thức điểm' }),
    );
    expect(await screen.findByText('Màn sửa')).toBeInTheDocument();
  });

  it('offers editing of the Draft by the direct path', async () => {
    renderPage(courseSyllabus());
    fireEvent.click(
      await screen.findByRole('button', { name: 'Sửa đề cương' }),
    );
    expect(await screen.findByText('Màn sửa')).toBeInTheDocument();
  });

  it('renders every section, a stored table and the attachment list', async () => {
    renderPage(
      courseSyllabus({
        draft: syllabus({
          courseDescription:
            '<p>Mô tả</p><table><tbody><tr><td>ô bảng</td></tr></tbody></table>',
          objectives: '<ul><li>Mục tiêu 1</li></ul>',
          weeklyContents: [
            {
              id: 'w1',
              weekLabel: 'Tuần 1',
              sortOrder: 1,
              content: '<p>Giới thiệu</p>',
              teachingActivities: '<p>Thuyết giảng</p>',
              cloIds: [],
            },
          ],
          attachments: [attachment()],
        }),
      }),
    );
    expect(await screen.findByText('ô bảng')).toBeInTheDocument();
    expect(screen.getAllByRole('table').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Mục tiêu 1')).toBeInTheDocument();
    expect(screen.getByText('Giới thiệu')).toBeInTheDocument();
    expect(screen.getByText('Thuyết giảng')).toBeInTheDocument();
    expect(screen.getByText('Đề cương ký.pdf')).toBeInTheDocument();
    expect(screen.getByText(/2,4 MB/)).toBeInTheDocument();
    expect(screen.getByText(/Giảng viên A/)).toBeInTheDocument();
    expect(screen.getAllByText('Chưa có nội dung').length).toBeGreaterThan(0);
  });

  it('renders the stored HTML verbatim; the server is what removes scripts', async () => {
    renderPage(
      courseSyllabus({
        draft: syllabus({ courseDescription: '<p>an toàn</p>' }),
      }),
    );
    const text = await screen.findByText('an toàn');
    expect(text.tagName).toBe('P');
  });

  it('in English mode shows the English description and marks a missing translation (US-040 AC3)', async () => {
    renderPage(
      courseSyllabus({
        course: {
          ...courseSyllabus().course,
          englishName: 'Introduction to Programming',
        },
        draft: syllabus({
          courseDescription: '<p>Mô tả tiếng Việt</p>',
          englishDescription: '<p>English description</p>',
        }),
      }),
    );
    await screen.findByText('Mô tả tiếng Việt');
    fireEvent.click(screen.getByText('English'));
    expect(await screen.findByText('English description')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        name: /IT001 — Introduction to Programming/,
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Chưa dịch')).not.toBeInTheDocument();
  });

  it('switches the CLO description with the language toggle and flags a missing translation (FR-48)', async () => {
    renderPage(
      courseSyllabus({
        draft: syllabus({
          clos: [
            clo('a', 1, {
              description: 'Giải thích được',
              englishDescription: 'Explain',
            }),
            clo('b', 2, { description: 'Áp dụng được' }),
          ],
        }),
      }),
    );
    expect(await screen.findByText('Giải thích được')).toBeInTheDocument();
    fireEvent.click(screen.getByText('English'));
    expect(await screen.findByText('Explain')).toBeInTheDocument();
    expect(screen.queryByText('Giải thích được')).not.toBeInTheDocument();
    const fallback = screen.getByText('Áp dụng được').closest('tr')!;
    expect(within(fallback).getByText('Chưa dịch')).toBeInTheDocument();
  });

  it('falls back to Vietnamese and tags "Chưa dịch" when English is empty', async () => {
    renderPage(courseSyllabus());
    await screen.findByText('Mô tả tiếng Việt');
    fireEvent.click(screen.getByText('English'));
    await waitFor(() =>
      expect(screen.getAllByText('Chưa dịch').length).toBeGreaterThanOrEqual(2),
    );
    expect(screen.getByText('Mô tả tiếng Việt')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /IT001 — Nhập môn lập trình/ }),
    ).toBeInTheDocument();
  });

  it('answers with a result when the course is missing', async () => {
    renderPage(json({ code: 'COURSE_NOT_FOUND', message: 'x' }, 404));
    expect(
      await screen.findByText('Không tìm thấy học phần'),
    ).toBeInTheDocument();
  });
});
