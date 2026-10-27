import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  COHORT,
  SEMESTER,
  cohortSchedule,
  json,
  renderReleasePage,
  selectReleaseOption,
  versionRef,
} from '../testRender';
import { CohortVersionAssignmentsPage } from './CohortVersionAssignmentsPage';

afterEach(() => vi.unstubAllGlobals());
describe('CohortVersionAssignmentsPage', () => {
  it('shows all mappings and asks the server for each explicit as-of semester without ACTIVE fallback', async () => {
    const { reads, writes } = renderReleasePage({
      path: '/programs/:programId/cohort-versions',
      entry: '/programs/p1/cohort-versions?cohortId=k1',
      element: <CohortVersionAssignmentsPage />,
      reads: {
        '/api/programs/p1/cohort-versions': cohortSchedule(),
        '/api/programs/p1/versions': { versions: [versionRef()] },
        '/api/cohorts': [COHORT],
        '/api/semesters': [
          SEMESTER,
          { ...SEMESTER, id: 's2', semesterCode: 'OTHER' },
        ],
        '/api/programs/p1/cohorts/k1/applied-version?semesterId=s1': {
          programId: 'p1',
          cohort: COHORT,
          semester: SEMESTER,
          state: 'ASSIGNED',
          assignment: cohortSchedule().assignments[0],
        },
        '/api/programs/p1/cohorts/k1/applied-version?semesterId=s2': {
          programId: 'p1',
          cohort: COHORT,
          semester: { ...SEMESTER, id: 's2', semesterCode: 'OTHER' },
          state: 'UNASSIGNED',
          assignment: null,
        },
      },
    });
    expect(await screen.findByText('QD-1')).toBeInTheDocument();
    expect(reads.some((url) => url.includes('applied-version'))).toBe(false);
    await selectReleaseOption('Học kỳ tra cứu', '2026-2027-2 · 2027-01-18');
    expect(await screen.findByText(/Học kỳ tra cứu: 2026/)).toBeInTheDocument();
    await selectReleaseOption('Học kỳ tra cứu', 'OTHER · 2027-01-18');
    expect(
      await screen.findByText('Khóa chưa được gán phiên bản trong học kỳ này.'),
    ).toBeInTheDocument();
    expect(reads).toContain(
      '/api/programs/p1/cohorts/k1/applied-version?semesterId=s2',
    );
    expect(writes).toEqual([]);
    expect(screen.queryByText(/đã chuyển.*sinh viên/i)).not.toBeInTheDocument();
  });
  it('paginates program identities, submits search from page one and preserves cohort context', async () => {
    const item = {
      id: 'p1',
      programCode: '1024034',
      programName: 'Kỹ thuật máy tính',
    };
    const result = { items: [item], total: 41, page: 1, pageSize: 20 };
    const { reads } = renderReleasePage({
      path: '/cohort-versions',
      entry: '/cohort-versions?cohortId=k1',
      element: <CohortVersionAssignmentsPage />,
      reads: {
        '/api/programs?page=1&pageSize=20': result,
        '/api/programs?page=2&pageSize=20': { ...result, page: 2 },
        '/api/programs?page=1&pageSize=20&q=1024034': result,
      },
    });
    expect(
      await screen.findByRole('link', { name: 'Gán phiên bản cho khóa' }),
    ).toHaveAttribute('href', '/programs/p1/cohort-versions?cohortId=k1');
    fireEvent.click(screen.getByTitle('Next Page'));
    await waitFor(() =>
      expect(reads).toContain('/api/programs?page=2&pageSize=20'),
    );
    fireEvent.change(screen.getByLabelText('Tìm chương trình'), {
      target: { value: '1024034' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Tìm kiếm' }));
    await waitFor(() =>
      expect(reads).toContain('/api/programs?page=1&pageSize=20&q=1024034'),
    );
  });
  it.each([403, 404])(
    'shows schedule refusal %s rather than an empty schedule',
    async (status) => {
      renderReleasePage({
        path: '/programs/:programId/cohort-versions',
        entry: '/programs/p1/cohort-versions',
        element: <CohortVersionAssignmentsPage />,
        reads: {
          '/api/programs/p1/cohort-versions': json(
            { message: 'Không có quyền' },
            status,
          ),
          '/api/programs/p1/versions': { versions: [] },
          '/api/cohorts': [],
        },
      });
      expect(
        await screen.findByRole('button', { name: 'Thử lại' }),
      ).toBeInTheDocument();
      expect(
        screen.queryByText('Chương trình chưa được gán cho khóa nào.'),
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Gán phiên bản' }),
      ).toBeDisabled();
    },
  );
});
