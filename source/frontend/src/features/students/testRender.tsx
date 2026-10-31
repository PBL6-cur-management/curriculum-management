import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { App, ConfigProvider } from 'antd';
import type { ReactNode } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { vi } from 'vitest';
import type { components } from '../../shared/api/schema';
import type { StudentDetail } from './api/students';

export const semester = {
  id: 's1',
  semesterCode: '2025-1',
  academicYear: '2025-2026',
  termInYear: 1,
  startDate: '2025-08-01',
  startDateEstimated: false,
} satisfies components['schemas']['SemesterDto'];
export const cohort = {
  id: 'c1',
  cohortCode: 'K25',
  intakeYear: 2025,
} satisfies components['schemas']['CohortDto'];
export const program = {
  id: 'p1',
  programCode: 'CT01',
  programName: 'Chương trình tổng hợp',
} satisfies components['schemas']['StudentProgramOptionDto'];
export const student = {
  id: 'st1',
  studentCode: '000123',
  fullName: 'Sinh viên tổng hợp',
  cohort,
  major: '7480201',
  status: 'STUDYING',
  dataSource: 'EXCEL',
  updatedAt: '2026-10-01T00:00:00.000Z',
  userId: 'u2',
  admissionSemester: semester,
  statusSemester: semester,
  canManageEnrollments: true,
  enrollmentWarnings: [],
  enrollments: [
    {
      id: 'en1',
      studentId: 'st1',
      program,
      cohort,
      appliedVersion: { id: 'v1', versionNumber: '1.0', status: 'ACTIVE' },
      admissionVersionId: 'v1',
      cohortAssignmentId: 'ca1',
      fromSemester: semester,
      untilSemester: null,
      previousEnrollmentId: null,
      enrollmentType: 'PRIMARY',
      isException: false,
      basisDecision: null,
      status: 'ACTIVE',
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
    },
  ],
} satisfies StudentDetail;
export function syntheticMe(
  roleCodes = ['R1'],
  permissions: components['schemas']['PermissionCode'][] = [
    'student.viewProgress',
    'version.assignCohort',
    'data.importExcel',
    'user.manage',
  ],
) {
  return {
    id: 'u1',
    username: 'synthetic',
    userCode: 'SYN',
    fullName: 'Người kiểm thử',
    email: null,
    orgUnit: null,
    mustChangePassword: false,
    roles: roleCodes.map((roleCode) => ({
      roleCode,
      roleName: roleCode,
      scopeType: 'SYSTEM' as const,
      scopeUnit: null,
      derived: false,
    })),
    permissions,
    canApprove: false,
  } satisfies components['schemas']['MeDto'];
}
export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });
interface RenderStudentOptions {
  element: ReactNode;
  path?: string;
  route?: string;
  roleCodes?: string[];
  responses?: ReadonlyMap<string, unknown>;
  writeResponse?: (path: string, body: unknown) => Response;
}
export function renderStudentPage(options: RenderStudentOptions) {
  const writes: { method: string; path: string; body: unknown }[] = [];
  const fetchMock = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input);
      if (init?.method && init.method !== 'GET') {
        const body: unknown =
          typeof init.body === 'string' ? JSON.parse(init.body) : init.body;
        writes.push({ method: init.method, path, body });
        return (
          options.writeResponse?.(path, body) ?? json(student.enrollments[0])
        );
      }
      if (path === '/api/auth/me') return json(syntheticMe(options.roleCodes));
      if (path === '/api/semesters')
        return json([
          semester,
          { ...semester, id: 'unknown', startDate: null },
        ]);
      if (path === '/api/cohorts') return json([cohort]);
      if (path.startsWith('/api/students/program-options'))
        return json(options.responses?.get(path) ?? [program]);
      const response = options.responses?.get(path);
      return response instanceof Response
        ? response.clone()
        : response === undefined
          ? json({ message: 'Không tìm thấy.' }, 404)
          : json(response);
    },
  );
  vi.stubGlobal('fetch', fetchMock);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createMemoryRouter(
    [{ path: options.route ?? '/students', element: options.element }],
    { initialEntries: [options.path ?? '/students'] },
  );
  render(
    <QueryClientProvider client={client}>
      <ConfigProvider theme={{ token: { motion: false } }}>
        <App>
          <RouterProvider router={router} />
        </App>
      </ConfigProvider>
    </QueryClientProvider>,
  );
  return { writes, fetchMock, client, router };
}
