import { fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { components } from '../../../shared/api/schema';
import { renderStudentPage, semester, student } from '../testRender';
import { StudentDetailPage } from './StudentDetailPage';

afterEach(() => vi.unstubAllGlobals());
const result = {
  id: 'r1',
  studentId: 'st1',
  course: {
    id: 'course1',
    courseCode: 'HP01',
    courseName: 'Học phần tổng hợp',
  },
  semester,
  score10: '8.25',
  score4: null,
  letterGrade: null,
  status: 'IN_PROGRESS',
  dataSource: 'SCHOOL_DB',
  revision: 1,
  updatedAt: student.updatedAt,
} satisfies components['schemas']['AcademicResultDto'];
function setup(roleCodes = ['R1'], unassigned = false) {
  return renderStudentPage({
    element: <StudentDetailPage />,
    route: '/students/:studentId',
    path: `/students/st1?semesterId=s1${unassigned ? '' : '&programId=p1'}`,
    roleCodes,
    responses: new Map<string, unknown>([
      [
        `/api/students/st1?semesterId=s1${unassigned ? '' : '&programId=p1'}`,
        unassigned ? { ...student, enrollments: [] } : student,
      ],
      [
        '/api/students/st1/applied-version?semesterId=s1&programId=p1',
        {
          studentId: 'st1',
          enrollmentId: 'en1',
          programId: 'p1',
          semesterId: 's1',
          programVersionId: 'v-future',
          source: 'COHORT',
          cohortAssignmentId: 'ca2',
        } satisfies components['schemas']['StudentAppliedVersionDto'],
      ],
      [
        '/api/students/st1/results?semesterId=s1&programId=p1&page=1&pageSize=20',
        {
          items: [
            result,
            {
              ...result,
              id: 'r2',
              semester: { ...semester, id: 's0', semesterCode: '2024-2' },
            },
          ],
          total: 2,
          page: 1,
          pageSize: 20,
        },
      ],
    ]),
  });
}
describe('StudentDetailPage', () => {
  it('distinguishes semester resolution from the stored pin and keeps repeated attempts', async () => {
    setup();
    expect(await screen.findByText(/v-future/)).toBeInTheDocument();
    expect(
      screen.getAllByRole('cell', { name: '1.0' }).length,
    ).toBeGreaterThanOrEqual(1);
    fireEvent.click(screen.getByRole('tab', { name: 'Kết quả học tập' }));
    expect(
      await screen.findAllByRole('cell', { name: 'HP01 — Học phần tổng hợp' }),
    ).toHaveLength(2);
    expect(screen.getAllByRole('cell', { name: '8.25' })).toHaveLength(2);
    expect(
      screen.getAllByRole('cell', { name: '—' }).length,
    ).toBeGreaterThanOrEqual(4);
    expect(
      screen.queryByRole('button', { name: /Sửa điểm/ }),
    ).not.toBeInTheDocument();
  }, 15_000);
  it('keeps the director read-only without enrollment management controls', async () => {
    setup(['R3']);
    await screen.findByText('Hồ sơ sinh viên');
    expect(
      screen.queryByRole('button', { name: 'Chuyển chương trình' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Thêm song ngành' }),
    ).not.toBeInTheDocument();
  });
  it('explains an unassigned profile without making results or resolution calls', async () => {
    const { fetchMock } = setup(['R1'], true);
    expect(
      await screen.findByText('Chưa xác định được chương trình'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Gán chương trình ngoại lệ' }),
    ).toBeEnabled();
    expect(
      fetchMock.mock.calls.some(([path]) =>
        /results|applied-version/.test(String(path)),
      ),
    ).toBe(false);
  });
  it('displays enrollment track and updates track via modal', async () => {
    const trackedStudent = {
      ...student,
      enrollments: [
        {
          ...student.enrollments[0],
          track: {
            id: 'tr1',
            trackCode: 'AI',
            trackName: 'Trí tuệ nhân tạo',
          },
        },
      ],
    };
    const { writes } = renderStudentPage({
      element: <StudentDetailPage />,
      route: '/students/:studentId',
      path: '/students/st1?semesterId=s1&programId=p1',
      responses: new Map<string, unknown>([
        ['/api/students/st1?semesterId=s1&programId=p1', trackedStudent],
        [
          '/api/students/st1/applied-version?semesterId=s1&programId=p1',
          {
            studentId: 'st1',
            enrollmentId: 'en1',
            programId: 'p1',
            semesterId: 's1',
            programVersionId: 'v1',
            source: 'COHORT',
            cohortAssignmentId: 'ca1',
          } satisfies components['schemas']['StudentAppliedVersionDto'],
        ],
        [
          '/api/program-versions/v1/tracks',
          [
            {
              id: 'tr1',
              trackCode: 'AI',
              trackName: 'Trí tuệ nhân tạo',
              englishName: null,
              description: null,
              sortOrder: 1,
              compulsoryCredits: null,
              electiveCredits: null,
              itemCount: 3,
            },
            {
              id: 'tr2',
              trackCode: 'SE',
              trackName: 'Kỹ thuật phần mềm',
              englishName: null,
              description: null,
              sortOrder: 2,
              compulsoryCredits: null,
              electiveCredits: null,
              itemCount: 4,
            },
          ],
        ],
      ]),
    });
    expect(
      (await screen.findAllByText('AI — Trí tuệ nhân tạo')).length,
    ).toBeGreaterThanOrEqual(1);
    fireEvent.click(screen.getByRole('button', { name: 'Chọn định hướng' }));
    const select = await screen.findByLabelText(
      'Định hướng / Chuyên ngành con',
    );
    fireEvent.keyDown(select, {
      key: 'ArrowDown',
      code: 'ArrowDown',
      keyCode: 40,
    });
    fireEvent.click(
      await screen.findByText('SE — Kỹ thuật phần mềm', {
        selector: '.ant-select-item-option-content',
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Lưu định hướng' }));
    await vi.waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]).toEqual({
      method: 'PATCH',
      path: '/api/students/st1/enrollments/en1/track',
      body: {
        trackId: 'tr2',
        expectedEnrollmentUpdatedAt: student.enrollments[0].updatedAt,
      },
    });
  });
  it('auto-selects the primary active enrollment program when programId is omitted from URL', async () => {
    renderStudentPage({
      element: <StudentDetailPage />,
      route: '/students/:studentId',
      path: '/students/st1?semesterId=s1',
      responses: new Map<string, unknown>([
        ['/api/students/st1?semesterId=s1', student],
        [
          '/api/students/st1/applied-version?semesterId=s1&programId=p1',
          {
            studentId: 'st1',
            enrollmentId: 'en1',
            programId: 'p1',
            semesterId: 's1',
            programVersionId: 'v-auto',
            source: 'COHORT',
            cohortAssignmentId: 'ca1',
          } satisfies components['schemas']['StudentAppliedVersionDto'],
        ],
        [
          '/api/students/st1/results?semesterId=s1&programId=p1&page=1&pageSize=20',
          { items: [result], total: 1, page: 1, pageSize: 20 },
        ],
      ]),
    });
    expect(await screen.findByText(/v-auto/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Kết quả học tập' }));
    expect(
      await screen.findByRole('cell', { name: 'HP01 — Học phần tổng hợp' }),
    ).toBeInTheDocument();
  });
});
