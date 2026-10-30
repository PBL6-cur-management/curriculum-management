import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { router as applicationRouter } from '../../router';
import { ROUTES } from '../../routes';
import { StudentDetailPage } from '../students/pages/StudentDetailPage';
import { program, semester, student } from '../students/testRender';
import { renderGraduationPage } from './testRender';

const LAZY_ROUTE_TIMEOUT_MS = 15_000;

afterEach(() => vi.unstubAllGlobals());
afterAll(() => applicationRouter.dispose());
describe('actual lazy graduation routes and staff boundaries', () => {
  it.each([
    [ROUTES.graduation, 'Xét tốt nghiệp'],
    [ROUTES.graduationBatches, 'Xét tốt nghiệp hàng loạt'],
    ['/graduation/audits/audit', 'Lần xét tốt nghiệp đã lưu'],
    ['/graduation/batches/batch', 'Chi tiết đợt xét tốt nghiệp'],
  ])('loads the named-export staff page at %s', async (entry, title) => {
    renderGraduationPage({ routes: applicationRouter.routes, entry });
    expect(
      await screen.findByRole(
        'heading',
        { name: title },
        { timeout: LAZY_ROUTE_TIMEOUT_MS },
      ),
    ).toBeInTheDocument();
  });
  it.each(['R2', 'R4', 'R5', 'R6'])(
    'denies a pasted staff URL to %s even with graduation permission',
    async (role) => {
      const { fetchMock, writes } = renderGraduationPage({
        routes: applicationRouter.routes,
        entry: ROUTES.graduation,
        roleCodes: [role],
      });
      expect(
        await screen.findByText(
          'Bạn không có quyền truy cập trang xét tốt nghiệp dành cho cán bộ',
          {},
          { timeout: LAZY_ROUTE_TIMEOUT_MS },
        ),
      ).toBeInTheDocument();
      expect(
        fetchMock.mock.calls.some(([path]) =>
          String(path).includes('/graduation/'),
        ),
      ).toBe(false);
      expect(writes).toHaveLength(0);
    },
  );
  it.each([['R3'], ['R6', 'R3']])(
    'allows staff-capable identities %j and does not grant missing audit permission',
    async (...roles) => {
      const roleCodes = roles.flat();
      const { router } = renderGraduationPage({
        routes: applicationRouter.routes,
        entry: ROUTES.graduation,
        roleCodes,
        permissions: ['graduation.view'],
      });
      expect(
        await screen.findByRole(
          'heading',
          { name: 'Xét tốt nghiệp' },
          { timeout: LAZY_ROUTE_TIMEOUT_MS },
        ),
      ).toBeInTheDocument();
      await router.navigate(ROUTES.graduationBatches);
      expect(
        await screen.findByText(
          'Bạn không có quyền truy cập trang xét tốt nghiệp dành cho cán bộ',
          {},
          { timeout: LAZY_ROUTE_TIMEOUT_MS },
        ),
      ).toBeInTheDocument();
    },
  );
  it('keeps a permissionless R1 out of staff pages', async () => {
    renderGraduationPage({
      routes: applicationRouter.routes,
      entry: ROUTES.graduation,
      permissions: [],
    });
    expect(
      await screen.findByText(
        'Bạn không có quyền truy cập trang xét tốt nghiệp dành cho cán bộ',
        {},
        { timeout: LAZY_ROUTE_TIMEOUT_MS },
      ),
    ).toBeInTheDocument();
  });
});
describe('student-record route-only graduation entry', () => {
  it('passes the selected historical context without evaluating or saving on click', async () => {
    const { writes, fetchMock, router } = renderGraduationPage({
      element: <StudentDetailPage />,
      path: ROUTES.studentDetail,
      entry: '/students/st1?semesterId=s1&programId=p1',
      roleCodes: ['R3'],
      permissions: ['student.viewProgress', 'graduation.view'],
      reads: {
        '/api/semesters': [semester],
        '/api/students/program-options?semesterId=s1': [program],
        '/api/students/st1?semesterId=s1&programId=p1': student,
        '/api/students/st1/applied-version?semesterId=s1&programId=p1': {
          studentId: 'st1',
          enrollmentId: 'en1',
          programId: 'p1',
          semesterId: 's1',
          programVersionId: 'historical',
          source: 'COHORT',
          cohortAssignmentId: 'ca1',
        },
      },
    });
    const entry = await screen.findByRole('link', { name: 'Xét tốt nghiệp' });
    expect(entry).toHaveAttribute(
      'href',
      '/graduation?studentId=st1&programId=p1&semesterId=s1',
    );
    fireEvent.click(entry);
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(ROUTES.graduation),
    );
    expect(writes).toHaveLength(0);
    expect(
      fetchMock.mock.calls.some(([path]) =>
        String(path).includes('/graduation?'),
      ),
    ).toBe(false);
  });
  it('disables the entry rather than choosing an ambiguous program', async () => {
    renderGraduationPage({
      element: <StudentDetailPage />,
      path: ROUTES.studentDetail,
      entry: '/students/st1?semesterId=s1',
      permissions: ['student.viewProgress', 'graduation.view'],
      reads: {
        '/api/semesters': [semester],
        '/api/students/program-options?semesterId=s1': [program],
        '/api/students/st1?semesterId=s1': student,
      },
    });
    expect(
      await screen.findByRole('button', { name: 'Xét tốt nghiệp' }),
    ).toBeDisabled();
    expect(
      screen.queryByRole('link', { name: 'Xét tốt nghiệp' }),
    ).not.toBeInTheDocument();
  });
});
