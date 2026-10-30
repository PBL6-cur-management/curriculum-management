import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { App } from 'antd';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Curriculum } from '../api/curriculum';
import { curriculum as fixture, item } from '../testFixtures';
import { CurriculumPage } from './CurriculumPage';
import {
  eligibilityAnswerFixture,
  conditionalItemFixture,
} from '../eligibilityTestFixtures';
import type { RegistrationEligibility } from '../api/registrationEligibility';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

function renderPage(
  data: Curriculum = fixture(),
  status = 200,
  search = '',
  permissions = ['changeRequest.create'],
  roles: string[] = [],
  answer?: RegistrationEligibility,
) {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/auth/me')
        return Promise.resolve(
          json({ permissions, roles: roles.map((roleCode) => ({ roleCode })) }),
        );
      if (url === '/api/semesters')
        return Promise.resolve(
          json([
            {
              id: 'sem1',
              semesterCode: 'SYN-2026',
              startDate: '2026-01-01',
              academicYear: '2026-2027',
              termInYear: 1,
            },
          ]),
        );
      if (url.includes('/registration-eligibility?'))
        return Promise.resolve(json(answer ?? {}, answer ? 200 : 403));
      if (url === '/api/program-versions/v1/curriculum')
        return Promise.resolve(json(status === 200 ? data : {}, status));
      if (
        url.startsWith('/api/program-versions/') &&
        url.endsWith('/curriculum')
      )
        return new Promise<Response>(() => {});
      return Promise.resolve(
        json({ items: [], total: 0, page: 1, pageSize: 20 }),
      );
    }),
  );
  const router = createMemoryRouter(
    [
      {
        path: '/programs/:programId/versions/:versionId/curriculum',
        element: <CurriculumPage />,
      },
    ],
    { initialEntries: [`/programs/p1/versions/v1/curriculum${search}`] },
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
  return router;
}

const bodyRows = () => screen.getAllByRole('row').slice(1);
const courseCodes = () =>
  bodyRows()
    .map((row) => /MAT101|PHY101|IT301/.exec(row.textContent ?? '')?.[0])
    .filter(Boolean);

// jsdom has no layout, hence no scrollIntoView; the ?focus effect calls it.
Element.prototype.scrollIntoView = vi.fn();

afterEach(() => vi.unstubAllGlobals());

describe('CurriculumPage', () => {
  it('shows a read-only student answer with board parity and clears back to ordinary browsing', async () => {
    const data = fixture();
    renderPage(
      data,
      200,
      '?studentId=s1&semesterId=sem1',
      ['student.viewRegistrationEligibility'],
      ['R1'],
      eligibilityAnswerFixture({
        items: data.items.map((row) => conditionalItemFixture(row.id)),
      }),
    );
    await screen.findByRole('columnheader', { name: 'Đăng ký được?' });
    expect(
      screen.queryByRole('button', { name: 'Thêm học phần' }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Xem lý do MAT101' }));
    expect(await screen.findByText('Phải đăng ký cùng')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    fireEvent.click(screen.getByText('Theo học kỳ'));
    expect(screen.getAllByText('Được có điều kiện')).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: 'Bỏ chọn sinh viên' }));
    // Still on the semester board, which prints code and name in one line.
    await vi.waitFor(() =>
      expect(screen.queryByText('Được có điều kiện')).not.toBeInTheDocument(),
    );
    expect(screen.getAllByText(/Giải tích 1/).length).toBeGreaterThan(0);
  });
  it.each(['R2', 'R4', 'R5', 'R6'])(
    'never searches or evaluates a crafted staff context for %s',
    async (role) => {
      renderPage(
        fixture(),
        200,
        '?studentId=s1&semesterId=sem1',
        ['student.viewRegistrationEligibility'],
        [role],
      );
      await screen.findByText('Bạn không có quyền xem khung theo sinh viên');
      expect(
        vi
          .mocked(fetch)
          .mock.calls.some(([input]) =>
            String(input).includes('registration-eligibility'),
          ),
      ).toBe(false);
    },
  );
  it('requires an explicit known semester and does not guess one', async () => {
    renderPage(
      fixture(),
      200,
      '?studentId=s1',
      ['student.viewRegistrationEligibility'],
      ['R3'],
    );
    await screen.findByText('Chọn học kỳ để tính điều kiện đăng ký');
    expect(
      vi
        .mocked(fetch)
        .mock.calls.some(([input]) =>
          String(input).includes('/registration-eligibility?'),
        ),
    ).toBe(false);
  });
  it('replaces the browsed version before joining eligibility rows and drops old focus', async () => {
    const answer = eligibilityAnswerFixture();
    answer.context.programVersionId = 'v2';
    const router = renderPage(
      fixture(),
      200,
      '?studentId=s1&semesterId=sem1&focus=old-item',
      ['student.viewRegistrationEligibility'],
      ['R1'],
      answer,
    );
    await screen.findByText(
      'Đang mở khung của phiên bản áp dụng cho sinh viên...',
    );
    await vi.waitFor(() =>
      expect(router.state.location.pathname).toContain('/versions/v2/'),
    );
    expect(router.state.location.search).not.toContain('focus=');
    expect(
      screen.queryByRole('columnheader', { name: 'Đăng ký được?' }),
    ).not.toBeInTheDocument();
  });
  it('requests the version export URL and displays a scoped refusal', async () => {
    renderPage(fixture(), 200, '', ['curriculum.importExportExcel']);
    const exportButton = await screen.findByRole('button', {
      name: 'Xuất Excel',
    });
    const fetchMock = vi.mocked(fetch);
    const original = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation((input, init) =>
      String(input).endsWith('/curriculum/export')
        ? Promise.resolve(
            json(
              {
                message: 'Chương trình ngoài phạm vi của bạn.',
                code: 'OUT_OF_SCOPE',
              },
              403,
            ),
          )
        : original(input, init),
    );
    fireEvent.click(exportButton);
    expect(
      await screen.findByText('Chương trình ngoài phạm vi của bạn.'),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/program-versions/v1/curriculum/export',
      expect.objectContaining({
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      }),
    );
  });
  it('offers export and preselects the ordinary draft import when permitted', async () => {
    renderPage(fixture(), 200, '', ['curriculum.importExportExcel']);
    expect(
      await screen.findByRole('button', { name: 'Xuất Excel' }),
    ).toBeEnabled();
    expect(screen.getByRole('link', { name: 'Nhập từ Excel' })).toHaveAttribute(
      'href',
      '/imports?type=CURRICULUM&versionId=v1',
    );
  });

  it('keeps export on a released version and hides import', async () => {
    const data = fixture();
    data.version.status = 'ACTIVE';
    renderPage(data, 200, '', ['curriculum.importExportExcel']);
    expect(
      await screen.findByRole('button', { name: 'Xuất Excel' }),
    ).toBeEnabled();
    expect(
      screen.queryByRole('link', { name: 'Nhập từ Excel' }),
    ).not.toBeInTheDocument();
  });

  it('hides Excel actions without the import export permission', async () => {
    renderPage();
    await screen.findByText('MAT101');
    expect(
      screen.queryByRole('button', { name: 'Xuất Excel' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Nhập từ Excel' }),
    ).not.toBeInTheDocument();
  });
  it('lists the rows in TT order with every Excel column and the exact totals', async () => {
    renderPage();
    expect(
      await screen.findByRole('heading', {
        name: /Khung chương trình — 1024034 \(Nháp\)/,
      }),
    ).toBeInTheDocument();
    const table = screen.getAllByRole('table')[0];
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent('MAT101');
    expect(rows[1]).toHaveTextContent('PHY101');
    expect(rows[1]).toHaveTextContent('2.5');
    expect(rows[2]).toHaveTextContent('Tự chọn');
    expect(rows[2]).toHaveTextContent('TC1');
    for (const header of [
      'TT',
      'Mã HP',
      'HT ĐA',
      'TQ ĐA',
      'Điểm học',
      'Điểm chuyển',
    ])
      expect(
        within(table).getByRole('columnheader', { name: header }),
      ).toBeInTheDocument();
    // Per-semester totals come from the server; the grand total is added without float drift (5.5 + 0 + 3 + 0).
    expect(await screen.findByText('Tín chỉ theo học kỳ')).toBeInTheDocument();
    // The program line counts the elective group by its minimum, not every row (US-029 AC1).
    expect(screen.getByText(/11\.5 \/ 150/)).toBeInTheDocument();
    expect(screen.getByText('Lệch so với khai báo')).toBeInTheDocument();
    expect(screen.getByText('Tín chỉ theo khối kiến thức')).toBeInTheDocument();
  });

  it('hides compulsory rows and the drag handles when filtering by "Tự chọn"', async () => {
    renderPage();
    await screen.findByText('MAT101');
    expect(screen.getAllByLabelText('Kéo để đổi thứ tự')).toHaveLength(3);
    fireEvent.click(
      screen.getByText('Tự chọn', { selector: '.ant-segmented-item-label' }),
    );
    expect(courseCodes()).toEqual(['IT301']);
    expect(
      screen.queryByLabelText('Kéo để đổi thứ tự'),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Xóa lọc' }));
    expect(courseCodes()).toEqual(['MAT101', 'PHY101', 'IT301']);
    expect(screen.getAllByLabelText('Kéo để đổi thứ tự')).toHaveLength(3);
  });

  it('searches code and name while ignoring case', async () => {
    renderPage();
    await screen.findByText('MAT101');
    fireEvent.change(
      screen.getByPlaceholderText('Tìm theo mã hoặc tên học phần'),
      {
        target: { value: 'GIẢI' },
      },
    );
    expect(courseCodes()).toEqual(['MAT101']);
  });

  it('offers no drag handle to a caller who cannot reorder', async () => {
    renderPage(fixture({ canEditStructure: false, editPath: null }));
    await screen.findByText('MAT101');
    expect(
      screen.queryByLabelText('Kéo để đổi thứ tự'),
    ).not.toBeInTheDocument();
  });

  it('shows the add button on an editable program', async () => {
    renderPage();
    expect(
      await screen.findByRole('button', { name: 'Thêm học phần' }),
    ).toBeEnabled();
  });

  it('links to the request form instead of editing once the program is released', async () => {
    renderPage(
      fixture({
        canAddItems: false,
        canEditStructure: false,
        editPath: 'VIA_REQUEST',
        items: [item('MAT101', 'Giải tích 1', { canEdit: false })],
      }),
    );
    const request = await screen.findByRole('button', { name: 'Tạo đề xuất' });
    expect(request.closest('a')).toHaveAttribute(
      'href',
      '/change-requests/new?type=CURRICULUM&targetType=PROGRAM&targetId=p1',
    );
    expect(
      screen.queryByRole('button', { name: 'Thêm học phần' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Sửa' }),
    ).not.toBeInTheDocument();
  });

  it('shows row actions only on rows the server says the caller may edit', async () => {
    renderPage(
      fixture({
        items: [
          item('MAT101', 'Giải tích 1'),
          item('PHY101', 'Vật lý 1', { canEdit: false }),
        ],
      }),
    );
    await screen.findByText('MAT101');
    expect(screen.getAllByRole('button', { name: 'Sửa' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Điều kiện' })).toHaveLength(
      1,
    );
  });

  it('lists the warnings with "Xem" on the ones that name a row (KB-016, KB-019)', async () => {
    renderPage(
      fixture({
        warnings: [
          {
            code: 'EMPTY_SEMESTER',
            severity: 'INFO',
            message: 'Học kỳ 2 chưa có học phần nào.',
            semester: 2,
            itemId: null,
            groupId: null,
          },
          {
            code: 'REQUISITE_NOT_EARLIER',
            severity: 'HIGH',
            message: 'IT301 cần MAT101 trước.',
            semester: 3,
            itemId: 'i-IT301',
            groupId: null,
          },
        ],
      }),
    );
    const list = await screen.findByRole('list', {
      name: 'Cảnh báo của khung',
    });
    const entries = within(list).getAllByRole('listitem');
    // High-severity warnings come first.
    expect(entries[0]).toHaveTextContent('IT301 cần MAT101 trước.');
    expect(
      within(entries[0]).getByRole('button', { name: 'Xem' }),
    ).toBeInTheDocument();
    expect(entries[1]).toHaveTextContent('Học kỳ 2 chưa có học phần nào.');
    expect(
      within(entries[1]).queryByRole('button', { name: 'Xem' }),
    ).not.toBeInTheDocument();
  });

  it('marks a requisite planned in a later semester', async () => {
    renderPage(
      fixture({
        items: [
          item('IT301', 'Mạng máy tính', {
            plannedSemester: 2,
            requisites: [
              {
                id: 'r1',
                relationType: 'PREREQUISITE',
                minScore: '2',
                sourceSemester: 3,
                sourceCourse: {
                  id: 'c-MAT101',
                  courseCode: 'MAT101',
                  courseName: 'Giải tích 1',
                  credits: '3',
                  status: 'ACTIVE',
                },
              },
            ],
          }),
        ],
      }),
    );
    expect(await screen.findByText(/Tiên quyết: MAT101/)).toBeInTheDocument();
    expect(screen.getByText(/≥ 2/)).toBeInTheDocument();
  });

  it('shows every semester as a card in the by-semester view, an empty one saying so', async () => {
    renderPage();
    await screen.findByText('MAT101');
    fireEvent.click(
      screen.getByText('Theo học kỳ', {
        selector: '.ant-segmented-item-label',
      }),
    );
    expect(await screen.findByText(/Học kỳ 1 — 5.5 TC/)).toBeInTheDocument();
    expect(screen.getByText(/Học kỳ 2 — 0 TC/)).toBeInTheDocument();
    expect(screen.getByText(/Học kỳ 4 — 0 TC/)).toBeInTheDocument();
    expect(screen.getAllByText('Chưa có học phần')).toHaveLength(2);
  });

  it('links to the consistency check, which is open for every status', async () => {
    renderPage();
    expect(
      (
        await screen.findByRole('button', { name: 'Kiểm tra nhất quán' })
      ).closest('a'),
    ).toHaveAttribute('href', '/programs/p1/versions/v1/consistency');
  });

  it('highlights the row named by ?focus and shows errors before warnings', async () => {
    renderPage(
      fixture({
        warnings: [
          {
            code: 'REQUISITE_NOT_EARLIER',
            severity: 'HIGH',
            message: 'Cảnh báo một.',
            semester: 3,
            itemId: 'i-IT301',
            groupId: null,
          },
          {
            code: 'REQUISITE_CYCLE',
            severity: 'ERROR',
            message: 'Vòng điều kiện: A → B → A.',
            semester: 1,
            itemId: 'i-MAT101',
            groupId: null,
          },
        ],
      }),
      200,
      '?focus=i-PHY101',
    );
    const row = (await screen.findByText('PHY101')).closest('tr');
    expect(row).toHaveClass('ant-table-row-selected');
    const entries = within(
      screen.getByRole('list', { name: 'Cảnh báo của khung' }),
    ).getAllByRole('listitem');
    expect(entries[0]).toHaveTextContent('Vòng điều kiện');
  });

  it('links to the elective groups and back to the program', async () => {
    renderPage();
    expect(
      await screen.findByRole('link', { name: 'Nhóm tự chọn' }),
    ).toHaveAttribute('href', '/programs/p1/versions/v1/elective-groups');
    expect(
      screen.getByRole('link', { name: /Chương trình 1024034/ }),
    ).toHaveAttribute('href', '/programs/p1');
  });

  it('says so when the version cannot be found', async () => {
    renderPage(fixture(), 404);
    expect(
      await screen.findByText('Không tìm thấy khung chương trình'),
    ).toBeInTheDocument();
  });

  it('tags a row without a syllabus and links every row to its syllabus, even a read-only one (EC-44)', async () => {
    renderPage(
      fixture({
        items: [
          item('MAT101', 'Giải tích 1', { hasSyllabus: false, canEdit: false }),
          item('PHY101', 'Vật lý 1', {
            displayOrder: 2,
            sortOrder: 2,
            hasSyllabus: true,
            canEdit: false,
          }),
        ],
      }),
    );
    await screen.findByText('Giải tích 1');
    expect(screen.getAllByText('Chưa có đề cương')).toHaveLength(1);
    const links = screen.getAllByRole('link', { name: 'Đề cương' });
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/courses/c-MAT101/syllabus',
      '/courses/c-PHY101/syllabus',
    ]);
  });
});
