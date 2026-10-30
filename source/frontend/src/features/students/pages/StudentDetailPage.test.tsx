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
    expect(screen.getByRole('cell', { name: '1.0' })).toBeInTheDocument();
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
  });
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
});
