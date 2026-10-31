import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from 'antd';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { CANCEL_CONFIRM_TEXT } from '../constants/courseLabels';
import { GRADE_POINT_MESSAGE } from '../schema/courseRules';
import { CourseDetailPage } from './CourseDetailPage';

const course = {
  id: 'c1',
  courseCode: 'IT001',
  courseName: 'Nhập môn lập trình',
  englishName: null,
  credits: '2.5',
  courseType: 'THEORY',
  status: 'ACTIVE',
  ownerFaculty: { id: 'f1', unitCode: 'KHOA_CNTT', unitName: 'Khoa CNTT' },
  ownerGroup: {
    id: 'g1',
    groupCode: 'G1',
    groupName: 'Lập trình',
    status: 'ACTIVE',
  },
  isForeign: false,
  programsUsing: [],
  equivalenceGroup: null,
  editPath: 'DIRECT',
  canChangeStatus: true,
  createdAt: '2026-10-19T00:00:00.000Z',
  updatedAt: '2026-10-19T00:00:00.000Z',
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
  permissions: [
    'course.view',
    'course.edit',
    'courseRelation.edit',
    'changeRequest.create',
  ],
};

const relation = (patch: Record<string, unknown> = {}) => ({
  id: 'r1',
  relationType: 'PREREQUISITE',
  sourceCourse: {
    id: 'c2',
    courseCode: 'IT002',
    courseName: 'Toán rời rạc',
    credits: '3',
    status: 'ACTIVE',
  },
  targetCourse: {
    id: 'c1',
    courseCode: 'IT001',
    courseName: 'Nhập môn lập trình',
    credits: '2.5',
    status: 'ACTIVE',
  },
  minScore: '2',
  editPath: 'DIRECT',
  ...patch,
});

// The page also asks who the caller is and for the course's relations; every other GET is the course itself.
function renderPage(
  respond: (url: string, init?: RequestInit) => Response,
  options: { relations?: unknown[]; permissions?: string[] } = {},
) {
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === '/api/auth/me')
      return Promise.resolve(
        json({
          ...ME,
          permissions: options.permissions ?? ME.permissions,
        }),
      );
    if (url === '/api/courses/c1/relations')
      return Promise.resolve(json(options.relations ?? []));
    return Promise.resolve(respond(url, init));
  });
  vi.stubGlobal('fetch', fetchMock);
  const router = createMemoryRouter(
    [{ path: '/courses/:courseId', element: <CourseDetailPage /> }],
    { initialEntries: ['/courses/c1'] },
  );
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <App>
        <RouterProvider router={router} />
      </App>
    </QueryClientProvider>,
  );
  return fetchMock;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

describe('CourseDetailPage', () => {
  it('shows every catalog field, with a dash for a missing English name', async () => {
    renderPage(() => json(course));
    expect(
      await screen.findByText('IT001 — Nhập môn lập trình'),
    ).toBeInTheDocument();
    expect(screen.getByText('2.5')).toBeInTheDocument();
    expect(screen.getByText('Lý thuyết')).toBeInTheDocument();
    expect(screen.getByText('Đang sử dụng')).toBeInTheDocument();
    expect(screen.getByText('Khoa CNTT')).toBeInTheDocument();
    expect(screen.getByText('G1 — Lập trình')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sửa' })).toBeEnabled();
  });

  it('links to the request form with the course chosen when the edit path is via request', async () => {
    renderPage(() =>
      json({ ...course, editPath: 'VIA_REQUEST', canChangeStatus: false }),
    );
    const button = await screen.findByRole('button', { name: 'Tạo đề xuất' });
    expect(button.closest('a')).toHaveAttribute(
      'href',
      '/change-requests/new?type=COURSE_RELATION&targetType=COURSE&targetId=c1',
    );
    expect(
      screen.queryByRole('button', { name: 'Sửa' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Đổi trạng thái' }),
    ).not.toBeInTheDocument();
  });

  it('shows no edit button when the caller may not edit', async () => {
    renderPage(() =>
      json({ ...course, editPath: null, canChangeStatus: false }),
    );
    await screen.findByText('IT001 — Nhập môn lập trình');
    expect(
      screen.queryByRole('button', { name: 'Sửa' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Tạo đề xuất' }),
    ).not.toBeInTheDocument();
  });

  it('links to the syllabus only for a caller who may view syllabi (MH-17)', async () => {
    renderPage(() => json(course), {
      permissions: [...ME.permissions, 'syllabus.view'],
    });
    const link = await screen.findByRole('link', { name: /Đề cương/ });
    expect(link).toHaveAttribute('href', '/courses/c1/syllabus');
  });

  it('shows no syllabus link without syllabus.view', async () => {
    renderPage(() => json(course));
    await screen.findByText('IT001 — Nhập môn lập trình');
    expect(
      screen.queryByRole('link', { name: /Đề cương/ }),
    ).not.toBeInTheDocument();
  });

  it('says so when no program uses the course (US-028 AC2)', async () => {
    renderPage(() => json(course));
    expect(
      await screen.findByText('Học phần chưa được chương trình nào sử dụng'),
    ).toBeInTheDocument();
  });

  it('lists the programs using the course with version and semester (US-028 AC1, AC3)', async () => {
    renderPage(() =>
      json({
        ...course,
        programsUsing: [
          {
            programId: 'p',
            programCode: 'CNTT',
            programName: 'Công nghệ thông tin',
            versionLabel: null,
            plannedSemester: 4,
          },
        ],
      }),
    );
    const link = await screen.findByRole('link', {
      name: 'CNTT — Công nghệ thông tin',
    });
    expect(link).toHaveAttribute('href', '/programs/p');
    expect(link.parentElement).toHaveTextContent('(Nháp, học kỳ 4)');
    expect(
      screen.queryByText('Học phần chưa được chương trình nào sử dụng'),
    ).not.toBeInTheDocument();
  });

  it('asks for confirmation before cancelling and posts only after OK', async () => {
    const fetchMock = renderPage((_url, init) =>
      init?.method === 'POST'
        ? json({
            ...course,
            status: 'CANCELLED',
            editPath: null,
            canChangeStatus: false,
          })
        : json(course),
    );
    fireEvent.click(
      await screen.findByRole('button', { name: 'Đổi trạng thái' }),
    );
    fireEvent.click(await screen.findByText('Hủy học phần'));
    expect(await screen.findByText(CANCEL_CONFIRM_TEXT)).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some(([, init]) => init?.method === 'POST'),
    ).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Hủy học phần' }));
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(
          ([url, init]) =>
            String(url) === '/api/courses/c1/cancel' && init?.method === 'POST',
        ),
      ).toBe(true),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'Đổi trạng thái' }),
      ).not.toBeInTheDocument(),
    );
  });

  it('shows the server message when a discontinue is refused', async () => {
    const message = 'Hãy khai báo học phần thay thế trước khi ngừng mở lớp.';
    renderPage(
      (_url, init) =>
        init?.method === 'POST'
          ? json({ code: 'REPLACEMENT_REQUIRED', message }, 409)
          : json(course),
      {
        relations: [
          relation({
            relationType: 'REPLACEMENT',
            sourceCourse: relation().targetCourse,
            targetCourse: relation().sourceCourse,
            minScore: null,
          }),
        ],
      },
    );
    fireEvent.click(
      await screen.findByRole('button', { name: 'Đổi trạng thái' }),
    );
    fireEvent.click(
      await screen.findByText('Ngừng mở lớp', {
        selector: '.ant-dropdown-menu-title-content',
      }),
    );
    const ok = await screen.findByRole('button', { name: 'Ngừng mở lớp' });
    await waitFor(() => expect(ok).toBeEnabled());
    fireEvent.click(ok);
    expect(await screen.findByText(message)).toBeInTheDocument();
  });

  it('lists each relation from this course side, with the other course and the threshold', async () => {
    renderPage(() => json(course), {
      relations: [
        relation(),
        relation({
          id: 'r2',
          relationType: 'REPLACEMENT',
          sourceCourse: relation().targetCourse,
          targetCourse: relation().sourceCourse,
          minScore: null,
        }),
        relation({
          id: 'r3',
          relationType: 'REPLACEMENT',
          editPath: 'VIA_REQUEST',
          minScore: null,
        }),
      ],
    });
    expect(
      await screen.findByText('Cần đạt tiên quyết học phần'),
    ).toBeInTheDocument();
    expect(screen.getByText('Được thay thế bởi')).toBeInTheDocument();
    expect(screen.getByText('Thay thế cho')).toBeInTheDocument();
    expect(screen.getAllByText(/IT002 — Toán rời rạc/)).toHaveLength(3);
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Xóa' })).toHaveLength(2);
    // The request path is the page's own "Tạo đề xuất"; rows carry no request button.
    expect(
      screen.queryByRole('button', { name: /đề xuất/i }),
    ).not.toBeInTheDocument();
  });

  it('edits a threshold in place, refusing a value above 4 on the client', async () => {
    const fetchMock = renderPage(
      (url, init) =>
        init?.method === 'PATCH' && url === '/api/course-relations/r1'
          ? json(relation({ minScore: '2.5' }))
          : json(course),
      { relations: [relation()] },
    );
    fireEvent.click(
      await screen.findByRole('button', { name: 'Sửa ngưỡng điểm' }),
    );
    const input = screen.getByLabelText('Ngưỡng điểm');
    fireEvent.change(input, { target: { value: '4.5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));
    expect(await screen.findByText(GRADE_POINT_MESSAGE)).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some(([, init]) => init?.method === 'PATCH'),
    ).toBe(false);
    fireEvent.change(input, { target: { value: '2.5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.find(([, init]) => init?.method === 'PATCH')?.[1]
          ?.body,
      ).toBe(JSON.stringify({ minScore: '2.5' })),
    );
  });

  it('offers adding a relation only to holders of courseRelation.edit', async () => {
    renderPage(() => json(course));
    expect(
      await screen.findByRole('button', { name: 'Thêm quan hệ' }),
    ).toBeInTheDocument();
    expect(await screen.findByText('Chưa có quan hệ nào')).toBeInTheDocument();
  });

  it('hides the add button and the row actions without the right', async () => {
    renderPage(() => json({ ...course, editPath: null }), {
      permissions: ['course.view'],
      relations: [relation({ editPath: null })],
    });
    await screen.findByText('Cần đạt tiên quyết học phần');
    expect(
      screen.queryByRole('button', { name: 'Thêm quan hệ' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Xóa' }),
    ).not.toBeInTheDocument();
  });

  it('shows the equivalent courses, or says there are none', async () => {
    renderPage(() => json(course));
    expect(
      await screen.findByText('Chưa thuộc nhóm tương đương nào'),
    ).toBeInTheDocument();
  });

  it('links the equivalence group and its other members', async () => {
    renderPage(() =>
      json({
        ...course,
        equivalenceGroup: {
          id: 'eg',
          groupCode: 'EQ1',
          members: [
            {
              id: 'c9',
              courseCode: 'IT900',
              courseName: 'Mã cũ',
              credits: '3',
              status: 'ACTIVE',
            },
          ],
        },
      }),
    );
    const group = await screen.findByRole('link', { name: 'EQ1' });
    expect(group).toHaveAttribute('href', '/equivalence-groups?q=EQ1');
    expect(screen.getByRole('link', { name: /IT900 — Mã cũ/ })).toHaveAttribute(
      'href',
      '/courses/c9',
    );
  });

  it('renders not found when the course does not exist', async () => {
    renderPage(() =>
      json(
        { code: 'COURSE_NOT_FOUND', message: 'Không tìm thấy học phần.' },
        404,
      ),
    );
    expect(
      await screen.findByText('Không tìm thấy học phần'),
    ).toBeInTheDocument();
  });
});
