import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from 'antd';
import type { ReactNode } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PortalCourse, PortalMe } from '../api/portal';
import { HomeGate } from '../components/HomeGate';
import { PortalCurriculumPage } from './PortalCurriculumPage';
import { PortalGraduationPage } from './PortalGraduationPage';
import { PortalHomePage } from './PortalHomePage';
import { PortalRegistrationPage } from './PortalRegistrationPage';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

const ME: PortalMe = {
  student: {
    id: 's1',
    studentCode: 'SYN00001',
    fullName: 'Sinh viên Tổng hợp',
    cohortCode: 'K2023',
    major: 'CNTT',
    status: 'STUDYING',
  },
  semester: { id: 'sem1', semesterCode: '2026-2027-1' },
  programs: [
    {
      programId: 'p1',
      programCode: 'CNTT',
      programName: 'Công nghệ thông tin',
      enrollmentType: 'PRIMARY',
      versionId: 'v1',
      versionNumber: '2023',
      decisionNumber: 'QĐ-01',
    },
    {
      programId: 'p2',
      programCode: 'KHMT',
      programName: 'Khoa học máy tính',
      enrollmentType: 'SECOND_MAJOR',
      versionId: 'v2',
      versionNumber: '2024',
      decisionNumber: null,
    },
  ],
};

function course(patch: Partial<PortalCourse>): PortalCourse {
  return {
    itemId: 'i1',
    courseId: 'c1',
    courseCode: '1020010',
    courseName: 'Lập trình',
    credits: '3',
    isElective: false,
    groupName: null,
    blockSymbol: null,
    state: 'NOT_TAKEN',
    attemptCount: 0,
    score10: null,
    score4: null,
    letterGrade: null,
    hasSyllabus: false,
    ...patch,
  };
}

function stub(reads: Record<string, unknown>) {
  const seen: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string) => {
      const url = String(input).replace(/^.*\/api/, '/api');
      seen.push(url);
      const path = url.split('?')[0]!;
      return path in reads
        ? json(reads[path])
        : json({ message: 'Not found' }, 404);
    }),
  );
  return seen;
}

function renderAt(element: ReactNode, entry: string, roles: string[] = ['R6']) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  client.setQueryData(['auth', 'me'], {
    id: 'u1',
    username: 'syn00001',
    fullName: 'Sinh viên',
    roles: roles.map((roleCode) => ({ roleCode })),
    permissions: [],
  });
  const router = createMemoryRouter(
    [
      { path: '/', element },
      { path: '/student', element: <div>Cổng sinh viên mở</div> },
      { path: '/student/curriculum', element },
      { path: '/student/registration', element },
      { path: '/student/graduation', element },
    ],
    { initialEntries: [entry] },
  );
  render(
    <QueryClientProvider client={client}>
      <App>
        <RouterProvider router={router} />
      </App>
    </QueryClientProvider>,
  );
  return router;
}

afterEach(() => vi.unstubAllGlobals());

describe('student portal', () => {
  it('sends a student-only account to the portal and keeps staff on the staff home', async () => {
    renderAt(<HomeGate staffHome={<div>Trang nhân viên</div>} />, '/');
    expect(await screen.findByText('Cổng sinh viên mở')).toBeInTheDocument();
  });

  it('keeps a staff account that also studies on the staff home', () => {
    renderAt(<HomeGate staffHome={<div>Trang nhân viên</div>} />, '/', [
      'R6',
      'R5',
    ]);
    expect(screen.getByText('Trang nhân viên')).toBeInTheDocument();
  });

  it('shows the applied version, primary program first, and switches to the second major (US-092 AC1/3)', async () => {
    stub({ '/api/portal/me': ME, '/api/semesters': [] });
    const router = renderAt(<PortalHomePage />, '/');
    expect(
      await screen.findByText('CNTT — Công nghệ thông tin'),
    ).toBeInTheDocument();
    expect(screen.getByText('QĐ-01')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Ngành thứ hai · KHMT'));
    await waitFor(() =>
      expect(router.state.location.search).toContain('program=p2'),
    );
    expect(
      await screen.findByText('KHMT — Khoa học máy tính'),
    ).toBeInTheDocument();
  });

  it('gives an unlinked account the contact message, not an empty curriculum (US-092 AC4)', async () => {
    stub({
      '/api/portal/me': { student: null, semester: null, programs: [] },
      '/api/semesters': [],
    });
    renderAt(<PortalHomePage />, '/');
    expect(
      await screen.findByText(/chưa được liên kết với hồ sơ sinh viên/),
    ).toBeInTheDocument();
  });

  it('says no program is settled instead of picking the newest version', async () => {
    stub({ '/api/portal/me': { ...ME, programs: [] }, '/api/semesters': [] });
    renderAt(<PortalHomePage />, '/');
    expect(
      await screen.findByText(/Chưa xác định được chương trình/),
    ).toBeInTheDocument();
  });

  it('lists the whole frame by term with each course state and mark (US-093 AC1/3)', async () => {
    stub({
      '/api/portal/me': ME,
      '/api/semesters': [],
      '/api/portal/plos': [
        {
          ploCode: 'PLO1',
          description: 'Phân tích bài toán',
          competencyGroup: null,
        },
      ],
      '/api/portal/curriculum': {
        programName: 'Công nghệ thông tin',
        versionNumber: '2023',
        decisionNumber: 'QĐ-01',
        totalCredits: '150',
        terms: [
          {
            plannedSemester: 1,
            credits: '6',
            courses: [
              course({
                itemId: 'a',
                state: 'PASSED',
                score10: '8.50',
                score4: '3.70',
                letterGrade: 'A',
                attemptCount: 2,
              }),
              course({
                itemId: 'b',
                courseCode: '1020020',
                state: 'PASSED_EQUIVALENT',
              }),
              course({
                itemId: 'c',
                courseCode: '1020030',
                state: 'FAILED',
                attemptCount: 1,
              }),
            ],
          },
        ],
      },
    });
    renderAt(<PortalCurriculumPage />, '/student/curriculum');
    expect(await screen.findByText('Học kỳ 1')).toBeInTheDocument();
    expect(screen.getByText('Đã đạt')).toBeInTheDocument();
    expect(screen.getByText('Đạt bằng HP tương đương')).toBeInTheDocument();
    expect(screen.getByText('Chưa đạt')).toBeInTheDocument();
    expect(
      screen.getByText(/Điểm 8.50 · 3.70\/4 · A · 2 lần học/),
    ).toBeInTheDocument();
    expect(await screen.findByText('Phân tích bài toán')).toBeInTheDocument();
  });

  it('explores full base program, filters by track/orientation, and switches to structure view', async () => {
    stub({
      '/api/portal/me': ME,
      '/api/semesters': [],
      '/api/portal/plos': [],
      '/api/portal/curriculum': {
        programName: 'Công nghệ thông tin',
        versionNumber: '2023.1',
        decisionNumber: 'QĐ-01',
        totalCredits: '150',
        compulsoryCredits: '120',
        electiveCredits: '30',
        enrolledTrackId: null,
        tracks: [
          {
            id: 'tr-cnpm',
            trackCode: 'CNPM',
            trackName: 'Công nghệ phần mềm',
            englishName: 'Software Engineering',
            description: 'Phát triển hệ thống phần mềm.',
            itemCount: 1,
            compulsoryCredits: '18',
            electiveCredits: '6',
          },
          {
            id: 'tr-httt',
            trackCode: 'HTTT',
            trackName: 'Hệ thống thông tin',
            englishName: null,
            description: null,
            itemCount: 1,
            compulsoryCredits: '15',
            electiveCredits: '9',
          },
        ],
        terms: [
          {
            plannedSemester: 1,
            credits: '3',
            courses: [
              course({
                itemId: 'i-common',
                courseId: 'c-common',
                courseCode: '1020010',
                courseName: 'Nhập môn lập trình',
                credits: '3',
                state: 'PASSED',
                attemptCount: 1,
                trackId: null,
                trackCode: null,
                trackName: null,
              }),
            ],
          },
          {
            plannedSemester: 6,
            credits: '6',
            courses: [
              course({
                itemId: 'i-cnpm',
                courseId: 'c-cnpm',
                courseCode: '1020210',
                courseName: 'Kiến trúc phần mềm',
                credits: '3',
                state: 'IN_PROGRESS',
                attemptCount: 1,
                trackId: 'tr-cnpm',
                trackCode: 'CNPM',
                trackName: 'Công nghệ phần mềm',
              }),
              course({
                itemId: 'i-httt',
                courseId: 'c-httt',
                courseCode: '1020310',
                courseName: 'Kho dữ liệu',
                credits: '3',
                state: 'NOT_TAKEN',
                attemptCount: 0,
                trackId: 'tr-httt',
                trackCode: 'HTTT',
                trackName: 'Hệ thống thông tin',
              }),
            ],
          },
        ],
      },
    });

    renderAt(<PortalCurriculumPage />, '/student/curriculum');

    // Full base program view by default when enrolledTrackId is null
    expect(
      await screen.findByText('2 định hướng / chuyên ngành'),
    ).toBeInTheDocument();
    expect(screen.getByText('150 TC')).toBeInTheDocument();
    expect(screen.getByText('120 TC')).toBeInTheDocument();
    expect(screen.getByText('30 TC')).toBeInTheDocument();
    expect(screen.getByText('Đã đạt 3 / 150 TC')).toBeInTheDocument();
    expect(screen.getByText('1020010 — Nhập môn lập trình')).toBeInTheDocument();
    expect(screen.getByText('1020210 — Kiến trúc phần mềm')).toBeInTheDocument();
    expect(screen.getByText('1020310 — Kho dữ liệu')).toBeInTheDocument();

    // Select CNPM track -> default mode shows common + CNPM, hides HTTT
    fireEvent.click(screen.getByRole('button', { name: /CNPM/ }));
    expect(
      await screen.findByText('CNPM — Công nghệ phần mềm'),
    ).toBeInTheDocument();
    expect(screen.getByText('1020010 — Nhập môn lập trình')).toBeInTheDocument();
    expect(screen.getByText('1020210 — Kiến trúc phần mềm')).toBeInTheDocument();
    expect(
      screen.queryByText('1020310 — Kho dữ liệu'),
    ).not.toBeInTheDocument();

    // Switch to TRACK_ONLY mode -> only CNPM course remains
    fireEvent.click(screen.getByText('Chỉ học phần của định hướng'));
    await waitFor(() =>
      expect(
        screen.queryByText('1020010 — Nhập môn lập trình'),
      ).not.toBeInTheDocument(),
    );
    expect(screen.getByText('1020210 — Kiến trúc phần mềm')).toBeInTheDocument();

    // Back to full base program & switch to Structure view
    fireEvent.click(screen.getByRole('button', { name: /Toàn bộ CTĐT gốc/ }));
    fireEvent.click(screen.getByText('Theo cấu trúc CTĐT'));
    expect(
      await screen.findByText('Khung kiến thức chung'),
    ).toBeInTheDocument();
    expect(screen.getByText('CNPM — Công nghệ phần mềm')).toBeInTheDocument();
    expect(screen.getByText('HTTT — Hệ thống thông tin')).toBeInTheDocument();

    // Inline search filters courses
    fireEvent.change(screen.getByPlaceholderText('Tìm mã hoặc tên học phần'), {
      target: { value: 'Kho dữ liệu' },
    });
    await waitFor(() =>
      expect(
        screen.queryByText('1020210 — Kiến trúc phần mềm'),
      ).not.toBeInTheDocument(),
    );
    expect(screen.getByText('1020310 — Kho dữ liệu')).toBeInTheDocument();
  });

  it('splits advice into candidates and blocked courses with reasons and offers no register action (US-095)', async () => {
    const ref = (code: string) => ({
      id: code,
      courseCode: code,
      courseName: code,
      nameSource: 'SNAPSHOT',
    });
    stub({
      '/api/portal/me': ME,
      '/api/semesters': [],
      '/api/students/s1/registration-eligibility': {
        contractVersion: 1,
        context: {},
        evaluatedAt: '2026-10-31T00:00:00.000Z',
        warnings: [],
        items: [
          {
            itemId: 'done',
            course: ref('HP0'),
            credits: '3',
            catalogStatus: 'ACTIVE',
            plannedSemester: 1,
            completed: true,
            eligibility: null,
            statusText: '',
            reasons: [],
            requiredConcurrentCourses: [],
          },
          {
            itemId: 'ok',
            course: ref('HP1'),
            credits: '3',
            catalogStatus: 'ACTIVE',
            plannedSemester: 2,
            completed: false,
            eligibility: 'CONDITIONAL',
            statusText: '',
            reasons: [],
            requiredConcurrentCourses: [ref('HP9')],
          },
          {
            itemId: 'no',
            course: ref('HP2'),
            credits: '3',
            catalogStatus: 'ACTIVE',
            plannedSemester: 3,
            completed: false,
            eligibility: 'INELIGIBLE',
            statusText: '',
            reasons: [
              {
                code: 'PREREQUISITE_NOT_PASSED',
                message: 'Chưa đạt học phần tiên quyết HP1.',
              },
            ],
            requiredConcurrentCourses: [],
          },
        ],
      },
    });
    renderAt(<PortalRegistrationPage />, '/student/registration');
    expect(await screen.findByText('HP1 — HP1')).toBeInTheDocument();
    expect(screen.getByText(/Phải đăng ký cùng: HP9/)).toBeInTheDocument();
    expect(screen.queryByText('HP0 — HP0')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Chưa đủ điều kiện (1)'));
    expect(
      await screen.findByText('Chưa đạt học phần tiên quyết HP1.'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Đăng ký/ }),
    ).not.toBeInTheDocument();
  });

  it('displays GPA and track selection warning on PortalGraduationPage', async () => {
    stub({
      '/api/portal/me': ME,
      '/api/semesters': [],
      '/api/students/s1/graduation': {
        status: 'REVIEWED',
        error: null,
        result: {
          schemaVersion: 1,
          ruleVersion: 'graduation-v1',
          evaluatedAt: '2026-10-31T00:00:00.000Z',
          context: {
            studentId: 's1',
            programId: 'p1',
            semesterId: 'sem1',
            enrollmentId: 'en1',
            studentCode: 'SYN00001',
            fullName: 'Sinh viên Tổng hợp',
            programCode: 'CNTT',
            programName: 'Công nghệ thông tin',
            cohortId: 'c1',
            cohortCode: 'K2023',
            programVersionId: 'v1',
            versionNumber: '2023',
            semesterCode: '2026-2027-1',
            semesterStartDate: '2026-09-01',
            versionSource: 'COHORT',
            cohortAssignmentId: 'ca1',
          },
          conclusion: 'NOT_ELIGIBLE',
          cumulativeGpa: '3.15',
          minGraduationGpa: '2.00',
          shortfalls: [
            {
              code: 'TRACK_NOT_SELECTED',
              category: 'TRACK',
              message: 'Chưa đăng ký định hướng chuyên ngành.',
            },
          ],
          warnings: [],
          credits: {
            requiredTotal: '150',
            recognizedTotal: '120',
            missingTotal: '30',
            compulsory: '90',
            elective: '30',
            free: '0',
          },
          electiveGroups: [],
          knowledgeBlocks: [],
          recognitions: [],
          freeCredits: [],
        },
      },
    });
    renderAt(<PortalGraduationPage />, '/student/graduation');
    expect(await screen.findByText('3.15 / 2.00')).toBeInTheDocument();
    expect(
      screen.getByText('Chưa ghi nhận định hướng / chuyên ngành con'),
    ).toBeInTheDocument();
  });
});
