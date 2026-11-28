import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from 'antd';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ROUTES } from '../../../routes';
import type { MajorOverview } from '../api/majors';
import { MajorDetailPage } from './MajorDetailPage';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

const SAMPLE_OVERVIEW: MajorOverview = {
  major: {
    id: 'm1',
    majorCode: '7480201',
    majorName: 'Công nghệ Thông tin',
    englishName: 'Information Technology',
    degreeGroup: 'CD01',
    faculty: { id: 'f1', unitCode: 'KHOA_CNTT', unitName: 'Khoa CNTT' },
    status: 'ACTIVE',
    programCount: 2,
    activeProgramCount: 1,
    studentCount: 1250,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  },
  stats: {
    totalPrograms: 2,
    activePrograms: 1,
    draftPrograms: 1,
    inactivePrograms: 0,
    releasedVersions: 3,
    totalStudents: 1250,
    totalCourses: 42,
    publishedSyllabi: 38,
    totalPlos: 12,
    subjectGroupCount: 4,
  },
  programs: [
    {
      id: 'p1',
      programCode: 'CNTT-CLC',
      programName: 'Kỹ sư CNTT Chất lượng cao',
      degreeLevel: 'ENGINEER',
      status: 'ACTIVE',
      faculty: { id: 'f1', unitCode: 'KHOA_CNTT', unitName: 'Khoa CNTT' },
      hasReleasedVersion: true,
      directors: [
        { id: 'd1', userCode: 'GV001', fullName: 'TS. Nguyễn Văn A' },
      ],
      latestVersionId: 'v1',
      latestVersionNumber: '2024.1',
      latestVersionStatus: 'ACTIVE',
      totalCredits: 150,
      releasedVersionCount: 2,
      trackCount: 3,
      ploCount: 12,
      courseCount: 40,
      studentCount: 900,
      cohorts: ['22', '23'],
    },
    {
      id: 'p2',
      programCode: 'CNTT-DT',
      programName: 'Cử nhân CNTT Đặc thù',
      degreeLevel: 'BACHELOR',
      status: 'ACTIVE',
      faculty: { id: 'f1', unitCode: 'KHOA_CNTT', unitName: 'Khoa CNTT' },
      hasReleasedVersion: false,
      directors: [],
      latestVersionId: null,
      latestVersionNumber: null,
      latestVersionStatus: null,
      totalCredits: null,
      releasedVersionCount: 0,
      trackCount: 0,
      ploCount: 0,
      courseCount: 0,
      studentCount: 350,
      cohorts: [],
    },
  ],
  courses: [
    {
      id: 'c1',
      courseCode: 'IT101',
      courseName: 'Cấu trúc dữ liệu và giải thuật',
      credits: 3,
      courseType: 'THEORY',
      programCount: 2,
      hasPublishedSyllabus: true,
      ownerGroup: {
        id: 'sg1',
        groupCode: 'BM_KHMT',
        groupName: 'Nhóm Khoa học máy tính',
      },
    },
    {
      id: 'c2',
      courseCode: 'IT202',
      courseName: 'Đồ án chuyên ngành',
      credits: 2,
      courseType: 'PROJECT',
      programCount: 1,
      hasPublishedSyllabus: false,
      ownerGroup: null,
    },
  ],
  subjectGroups: [
    {
      id: 'sg1',
      groupCode: 'BM_KHMT',
      groupName: 'Nhóm Khoa học máy tính',
      status: 'ACTIVE',
      memberCount: 14,
      courseCount: 18,
    },
  ],
  cohortBreakdown: [
    {
      programId: 'p1',
      programCode: 'CNTT-CLC',
      programName: 'Kỹ sư CNTT Chất lượng cao',
      cohortId: 'ch22',
      cohortCode: '22',
      studentCount: 450,
    },
  ],
};

function renderDetailPage(
  overview: MajorOverview = SAMPLE_OVERVIEW,
  permissions: string[] = ['program.view', 'program.editInfo'],
) {
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
        return Promise.resolve(json(overview.major));
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
      if (url === '/api/majors/m1/overview') {
        return Promise.resolve(json(overview));
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
        <MemoryRouter initialEntries={['/majors/m1']}>
          <Routes>
            <Route path={ROUTES.majorDetail} element={<MajorDetailPage />} />
          </Routes>
        </MemoryRouter>
      </App>
    </QueryClientProvider>,
  );

  return { writes };
}

afterEach(() => vi.unstubAllGlobals());

describe('MajorDetailPage', () => {
  it('renders header, KPI strip, and programs tab with quick links', async () => {
    renderDetailPage(SAMPLE_OVERVIEW, ['program.view']);

    expect(
      await screen.findByRole('heading', { name: 'Công nghệ Thông tin' }),
    ).toBeInTheDocument();
    expect(screen.getByText('7480201')).toBeInTheDocument();
    expect(screen.getByText('1 đang đào tạo')).toBeInTheDocument();
    expect(screen.getByText('1.250')).toBeInTheDocument();
    expect(screen.getByText('42 HP')).toBeInTheDocument();
    expect(screen.getByText('12 PLO · 4 nhóm CM')).toBeInTheDocument();

    expect(screen.getByRole('link', { name: 'CNTT-CLC' })).toHaveAttribute(
      'href',
      '/programs/p1',
    );
    expect(screen.getByText('3 chuyên ngành')).toBeInTheDocument();
    expect(screen.getByText('TS. Nguyễn Văn A')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Sửa ngành' }),
    ).not.toBeInTheDocument();

    // Filter programs by keyword
    fireEvent.change(
      screen.getByPlaceholderText('Tìm theo mã hoặc tên CTĐT...'),
      { target: { value: 'Đặc thù' } },
    );
    expect(screen.queryByText('CNTT-CLC')).not.toBeInTheDocument();
    expect(screen.getByText('CNTT-DT')).toBeInTheDocument();
  });

  it('switches across courses, students, organization, and outcomes tabs', async () => {
    renderDetailPage();
    await screen.findByRole('heading', { name: 'Công nghệ Thông tin' });

    // Tab 2: Courses
    fireEvent.click(screen.getByRole('tab', { name: /Học phần trong ngành/ }));
    expect(await screen.findByText('IT101')).toBeInTheDocument();
    expect(screen.getByText('IT202')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'IT101' })).toHaveAttribute(
      'href',
      '/courses/c1',
    );

    // Toggle only unpublished syllabus filter
    const syllabusSwitch = screen.getByRole('switch');
    fireEvent.click(syllabusSwitch);
    expect(screen.queryByText('IT101')).not.toBeInTheDocument();
    expect(screen.getByText('IT202')).toBeInTheDocument();

    // Tab 3: Students & Cohorts
    fireEvent.click(
      screen.getByRole('tab', { name: /Sinh viên & Khóa tuyển sinh/ }),
    );
    expect(
      await screen.findByRole('link', { name: 'Danh sách SV' }),
    ).toHaveAttribute('href', '/students?programId=p1');
    expect(screen.getAllByText('K22').length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getByRole('link', { name: 'Xét tốt nghiệp' }),
    ).toHaveAttribute('href', '/graduation');

    // Tab 4: Organization
    fireEvent.click(
      screen.getByRole('tab', { name: /Khoa & Nhóm chuyên môn/ }),
    );
    expect(
      await screen.findByRole('link', { name: 'Nhóm Khoa học máy tính' }),
    ).toHaveAttribute('href', '/subject-groups/sg1');

    // Tab 5: Outcomes & Reports
    fireEvent.click(
      screen.getByRole('tab', { name: 'Chuẩn đầu ra & Báo cáo' }),
    );
    expect(
      await screen.findByRole('link', { name: 'Danh sách PLO' }),
    ).toHaveAttribute('href', '/programs/p1/versions/v1/plos');
    expect(
      screen.getByRole('link', { name: 'Ma trận HP–PLO' }),
    ).toHaveAttribute('href', '/programs/p1/versions/v1/course-plo-matrix');
    expect(
      screen.getByRole('link', { name: 'Ma trận CLO–PLO' }),
    ).toHaveAttribute('href', '/programs/p1/versions/v1/clo-plo-matrix');
    expect(screen.getByRole('link', { name: 'Độ phủ CĐR' })).toHaveAttribute(
      'href',
      '/programs/p1/versions/v1/outcome-coverage',
    );
    expect(
      screen.getByRole('link', { name: 'Mở báo cáo so sánh' }),
    ).toHaveAttribute('href', '/reports/program-comparison');
  });

  it('shows empty state with link to students when cohortBreakdown is empty', async () => {
    renderDetailPage({ ...SAMPLE_OVERVIEW, cohortBreakdown: [] });
    await screen.findByRole('heading', { name: 'Công nghệ Thông tin' });

    fireEvent.click(
      screen.getByRole('tab', { name: /Sinh viên & Khóa tuyển sinh/ }),
    );
    expect(
      await screen.findByRole('link', { name: 'Mở danh sách sinh viên' }),
    ).toHaveAttribute('href', '/students');
  });

  it('edits major and toggles status when permitted', async () => {
    const { writes } = renderDetailPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Sửa ngành' }));

    const nameInput = await screen.findByLabelText('Tên ngành (tiếng Việt)');
    fireEvent.change(nameInput, {
      target: { value: 'Công nghệ Thông tin (cập nhật)' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));

    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]).toEqual({
      method: 'PATCH',
      url: '/api/majors/m1',
      body: expect.objectContaining({
        majorName: 'Công nghệ Thông tin (cập nhật)',
      }),
    });

    fireEvent.click(screen.getByRole('button', { name: 'Ngừng' }));
    await waitFor(() => expect(writes).toHaveLength(2));
    expect(writes[1]).toEqual({
      method: 'PATCH',
      url: '/api/majors/m1/status',
      body: { status: 'INACTIVE' },
    });
  });
});
