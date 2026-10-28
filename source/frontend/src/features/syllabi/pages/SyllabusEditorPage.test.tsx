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
import { clo, courseSyllabus, ME, syllabus, week } from '../testFixtures';
import { SyllabusEditorPage } from './SyllabusEditorPage';

// TipTap needs a real layout engine to type into; the form wiring is what these tests cover (the editor has its own test).
vi.mock('../../../shared/components/rich-text/RichTextEditor', () => ({
  RichTextEditor: ({
    value,
    onChange,
    'aria-label': label,
  }: {
    value?: string | null;
    onChange?: (value: string | null) => void;
    'aria-label': string;
  }) => (
    <textarea
      aria-label={label}
      value={value ?? ''}
      onChange={(event) => onChange?.(event.target.value || null)}
    />
  ),
}));

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

function renderPage(data: CourseSyllabus, entry = '/courses/c1/syllabus/edit') {
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === '/api/auth/me') return Promise.resolve(json(ME));
    if (init?.method === 'PATCH')
      return Promise.resolve(
        json({
          ...syllabus(),
          ...(JSON.parse(String(init.body)) as object),
        }),
      );
    if (init?.method === 'POST')
      return Promise.resolve(json(week('w9', 1), 201));
    return Promise.resolve(json(data));
  });
  vi.stubGlobal('fetch', fetchMock);
  const router = createMemoryRouter(
    [
      {
        path: '/courses/:courseId/syllabus/edit',
        element: <SyllabusEditorPage />,
      },
      { path: '/courses/:courseId/syllabus', element: <p>Trang đề cương</p> },
    ],
    { initialEntries: [entry] },
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

const writes = (fetchMock: ReturnType<typeof vi.fn>, method: string) =>
  fetchMock.mock.calls.filter(
    ([, init]) => (init as RequestInit | undefined)?.method === method,
  );

afterEach(() => vi.unstubAllGlobals());

describe('SyllabusEditorPage', () => {
  it('edits the copy of a request: banner, no attachments tab, back link keeps the request, opens the tab asked for', async () => {
    const fetchMock = renderPage(
      courseSyllabus({
        draft: {
          ...courseSyllabus().draft!,
          sourceRequest: {
            id: 'r1',
            requestCode: 'DX-2026-0001',
            status: 'DRAFT',
          },
        },
      }),
      '/courses/c1/syllabus/edit?requestId=r1&tab=clos',
    );
    expect(await screen.findByText('DX-2026-0001')).toBeInTheDocument();
    expect(
      screen.queryByRole('tab', { name: /Tệp đính kèm/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Về trang đề cương' }),
    ).toHaveAttribute('href', '/courses/c1/syllabus?requestId=r1');
    expect(screen.getByRole('tab', { selected: true })).toHaveTextContent(
      /CLO|Chuẩn đầu ra/,
    );
    expect(
      fetchMock.mock.calls.some(([url]) =>
        String(url).includes('requestId=r1'),
      ),
    ).toBe(true);
  });

  it('shows an info result instead of the form when the syllabus needs a change request', async () => {
    renderPage(courseSyllabus({ editPath: 'VIA_REQUEST', canEditClos: false }));
    expect(
      await screen.findByText(/không sửa trực tiếp được/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Về trang đề cương' }),
    ).toHaveAttribute('href', '/courses/c1/syllabus');
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
  });

  it('lets a grading-only editor in, with the text tabs off and the formula tab open', async () => {
    renderPage(
      courseSyllabus({
        editPath: null,
        canEditClos: false,
        gradingEditPath: 'DIRECT',
        canEditGradingFormula: true,
      }),
      '/courses/c1/syllabus/edit',
    );
    expect(
      await screen.findByRole('tab', {
        name: 'Công thức điểm',
        selected: true,
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Nội dung' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(
      screen.getByRole('tab', { name: 'Ánh xạ đánh giá–CLO' }),
    ).not.toHaveAttribute('aria-disabled', 'true');
  });

  it('shows no form when there is no Draft', async () => {
    renderPage(courseSyllabus({ draft: null }));
    expect(
      await screen.findByText(/không sửa trực tiếp được/),
    ).toBeInTheDocument();
  });

  it('lists the programs using the course before editing and offers six tabs (US-039 AC3, F-11, F-12)', async () => {
    renderPage(courseSyllabus());
    expect(
      await screen.findByText(/dùng chung cho các chương trình sau/),
    ).toBeInTheDocument();
    expect(screen.getByText(/CNTT — Công nghệ thông tin/)).toBeInTheDocument();
    expect(screen.getByText(/KTPM — Kỹ thuật phần mềm/)).toBeInTheDocument();
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'Nội dung',
      'Nội dung theo tuần',
      'Tệp đính kèm',
      'CLO',
      'Công thức điểm',
      'Ánh xạ đánh giá–CLO',
    ]);
  });

  it('says nothing changed instead of sending an empty save', async () => {
    const fetchMock = renderPage(courseSyllabus());
    fireEvent.click(
      await screen.findByRole('button', { name: 'Lưu nội dung' }),
    );
    expect(
      await screen.findByText('Chưa có thay đổi để lưu.'),
    ).toBeInTheDocument();
    expect(writes(fetchMock, 'PATCH')).toHaveLength(0);
  });

  it('sends only the section that changed (D7)', async () => {
    const fetchMock = renderPage(courseSyllabus());
    fireEvent.change(
      await screen.findByRole('textbox', { name: 'Mục tiêu học phần' }),
      { target: { value: '<p>Mục tiêu mới</p>' } },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Lưu nội dung' }));
    await waitFor(() => expect(writes(fetchMock, 'PATCH')).toHaveLength(1));
    const [url, init] = writes(fetchMock, 'PATCH')[0] as [string, RequestInit];
    expect(url).toBe('/api/syllabi/s1');
    expect(JSON.parse(String(init.body))).toEqual({
      objectives: '<p>Mục tiêu mới</p>',
    });
    expect(await screen.findByText('Đã lưu.')).toBeInTheDocument();
  });

  it('refuses a week without content and sends nothing', async () => {
    const fetchMock = renderPage(courseSyllabus());
    fireEvent.click(
      await screen.findByRole('tab', { name: 'Nội dung theo tuần' }),
    );
    fireEvent.click(await screen.findByRole('button', { name: /Thêm tuần/ }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Tuần' }), {
      target: { value: 'Tuần 1' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu' }));
    expect(
      await within(dialog).findByText('Nội dung tuần không được để trống.'),
    ).toBeInTheDocument();
    expect(writes(fetchMock, 'POST')).toHaveLength(0);
  });

  it('adds a week with its label and content', async () => {
    const fetchMock = renderPage(courseSyllabus());
    fireEvent.click(
      await screen.findByRole('tab', { name: 'Nội dung theo tuần' }),
    );
    fireEvent.click(await screen.findByRole('button', { name: /Thêm tuần/ }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Tuần' }), {
      target: { value: 'Tuần 1' },
    });
    fireEvent.change(
      within(dialog).getByRole('textbox', { name: 'Nội dung' }),
      {
        target: { value: '<p>Giới thiệu</p>' },
      },
    );
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu' }));
    await waitFor(() => expect(writes(fetchMock, 'POST')).toHaveLength(1));
    const [url, init] = writes(fetchMock, 'POST')[0] as [string, RequestInit];
    expect(url).toBe('/api/syllabi/s1/weekly-contents');
    expect(JSON.parse(String(init.body))).toEqual({
      weekLabel: 'Tuần 1',
      content: '<p>Giới thiệu</p>',
      teachingActivities: null,
      cloIds: [],
    });
  });

  it('lists the weeks already saved', async () => {
    renderPage(
      courseSyllabus({
        draft: syllabus({ weeklyContents: [week('w1', 1), week('w2', 2)] }),
      }),
    );
    fireEvent.click(
      await screen.findByRole('tab', { name: 'Nội dung theo tuần' }),
    );
    expect(await screen.findByText('Nội dung w1')).toBeInTheDocument();
    expect(screen.getByText('Nội dung w2')).toBeInTheDocument();
  });

  it('shows each weekly row with the CLOs it covers and saves the CLOs picked', async () => {
    const clos = [clo('a', 1), clo('b', 2), clo('c', 3)];
    const fetchMock = renderPage(
      courseSyllabus({
        draft: syllabus({
          clos,
          weeklyContents: [week('w1', 1, { cloIds: ['a', 'c'] })],
        }),
      }),
    );
    fireEvent.click(
      await screen.findByRole('tab', { name: 'Nội dung theo tuần' }),
    );
    expect(await screen.findByText('CLO1, CLO3')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Thêm tuần/ }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Tuần' }), {
      target: { value: 'Tuần 2' },
    });
    fireEvent.change(
      within(dialog).getByRole('textbox', { name: 'Nội dung' }),
      { target: { value: '<p>x</p>' } },
    );
    fireEvent.mouseDown(within(dialog).getByLabelText('CLO đạt được'));
    fireEvent.click(await screen.findByTitle('Mô tả b'));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu' }));
    await waitFor(() => expect(writes(fetchMock, 'POST')).toHaveLength(1));
    const [, init] = writes(fetchMock, 'POST')[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toMatchObject({ cloIds: ['b'] });
  });

  describe('CLO tab', () => {
    it('is off for a caller who cannot edit CLOs', async () => {
      renderPage(courseSyllabus({ canEditClos: false }));
      expect(await screen.findByRole('tab', { name: 'CLO' })).toHaveAttribute(
        'aria-disabled',
        'true',
      );
    });

    it('lists the CLOs and names the programs a delete would unlink', async () => {
      renderPage(
        courseSyllabus({
          draft: syllabus({
            clos: [
              clo('a', 1, { linkedPrograms: ['CNTT', 'KTPM'] }),
              clo('b', 2),
            ],
          }),
        }),
      );
      fireEvent.click(await screen.findByRole('tab', { name: 'CLO' }));
      expect(await screen.findByText('Mô tả a')).toBeInTheDocument();
      const row = screen.getByText('CLO1').closest('tr')!;
      fireEvent.click(within(row).getByRole('button', { name: 'Xóa' }));
      expect(
        await screen.findByText(
          'CLO này đang gắn PLO ở chương trình CNTT, KTPM; xóa sẽ xóa các liên kết đó.',
        ),
      ).toBeInTheDocument();
    });

    it('adds a CLO with its code and Vietnamese description', async () => {
      const fetchMock = renderPage(courseSyllabus());
      fireEvent.click(await screen.findByRole('tab', { name: 'CLO' }));
      fireEvent.click(await screen.findByRole('button', { name: /Thêm CLO/ }));
      const dialog = await screen.findByRole('dialog');
      fireEvent.change(within(dialog).getByLabelText('Mã CLO'), {
        target: { value: 'clo1' },
      });
      fireEvent.change(within(dialog).getByLabelText('Mô tả (tiếng Việt)'), {
        target: { value: 'Giải thích được' },
      });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu' }));
      await waitFor(() => expect(writes(fetchMock, 'POST')).toHaveLength(1));
      const [url, init] = writes(fetchMock, 'POST')[0] as [string, RequestInit];
      expect(url).toBe('/api/syllabi/s1/clos');
      expect(JSON.parse(String(init.body))).toEqual({
        cloCode: 'clo1',
        description: 'Giải thích được',
        englishDescription: null,
        cognitiveLevel: null,
      });
    });
  });
});
