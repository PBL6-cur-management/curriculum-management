import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { App, ConfigProvider } from 'antd';
import type { ReactElement } from 'react';
import {
  createMemoryRouter,
  RouterProvider,
  type RouteObject,
} from 'react-router';
import { vi } from 'vitest';
import type { components } from '../../shared/api/schema';
import { ROUTES } from '../../routes';
import type {
  GraduationAudit,
  GraduationBatch,
  GraduationBatchItem,
  GraduationLookup,
  GraduationResult,
} from './schema/graduation';

export const graduationLookup = {
  studentId: 'student',
  programId: 'program',
  semesterId: 'semester',
} satisfies GraduationLookup;
export const graduationEntry = `${ROUTES.graduation}?${new URLSearchParams(graduationLookup)}`;
const course = {
  id: 'course',
  courseCode: 'SYN101',
  courseName: 'Học phần tổng hợp',
};
export const eligibleGraduation: GraduationResult = {
  schemaVersion: 1,
  ruleVersion: 'graduation-v1',
  evaluatedAt: '2026-10-30T01:00:00.000Z',
  context: {
    ...graduationLookup,
    enrollmentId: 'enrollment',
    studentCode: 'SYN001',
    fullName: 'Sinh viên tổng hợp',
    programCode: 'SYN-P',
    programName: 'Chương trình tổng hợp',
    cohortId: 'cohort',
    cohortCode: 'K26',
    programVersionId: 'version',
    versionNumber: '1.0',
    semesterCode: '2026-1',
    semesterStartDate: '2026-09-01',
    versionSource: 'COHORT',
    cohortAssignmentId: 'assignment',
  },
  conclusion: 'ELIGIBLE',
  shortfalls: [],
  warnings: [],
  credits: {
    requiredTotal: '3',
    recognizedTotal: '3',
    missingTotal: '0',
    compulsory: '3',
    elective: '0',
    free: '0',
  },
  electiveGroups: [
    {
      groupId: 'group',
      groupCode: 'TC',
      groupName: 'Tự chọn',
      requiredCredits: null,
      earnedCredits: '0',
      missingCredits: null,
      requiredCourses: null,
      earnedCourses: 0,
      missingCourses: null,
    },
  ],
  knowledgeBlocks: [
    {
      blockSymbol: 'CN',
      blockName: 'Chuyên ngành',
      earnedCredits: '3',
      compulsoryCredits: '3',
      electiveCredits: '0',
      catalogRequiredCredits: '5',
      advisoryGap: '2',
    },
  ],
  recognitions: [
    {
      curriculumItemId: 'item',
      requiredCourse: course,
      studiedCourse: {
        ...course,
        id: 'old-course',
        courseCode: 'OLD101',
        courseName: 'Học phần mã cũ',
      },
      attemptId: 'attempt',
      attemptRevision: 1,
      completionStatus: 'PASSED',
      viaEquivalence: true,
      equivalenceGroupId: 'equivalence',
      requiredCredits: '3',
      recognizedCredits: '3',
      creditBasis: 'APPLIED_VERSION_SNAPSHOT',
      category: 'MANDATORY_COURSE',
      electiveGroupId: null,
      blockSymbol: 'CN',
    },
  ],
  freeCredits: [],
};
export const shortfallGraduation: GraduationResult = {
  ...eligibleGraduation,
  conclusion: 'NOT_ELIGIBLE',
  shortfalls: [
    {
      code: 'MANDATORY_COURSE_MISSING',
      category: 'MANDATORY_COURSE',
      curriculumItemId: 'mandatory',
      course,
      blockSymbol: 'CN',
      reason: 'FAILED',
      message: 'Học phần bắt buộc chưa đạt.',
    },
    {
      code: 'ELECTIVE_CREDITS_MISSING',
      category: 'ELECTIVE_GROUP',
      groupId: 'group',
      groupCode: 'TC',
      groupName: 'Tự chọn',
      requiredCredits: '6',
      earnedCredits: '2',
      missingCredits: '4',
      message: 'Chưa đủ tín chỉ nhóm.',
    },
    {
      code: 'ELECTIVE_COURSES_MISSING',
      category: 'ELECTIVE_GROUP',
      groupId: 'group',
      groupCode: 'TC',
      groupName: 'Tự chọn',
      requiredCourses: 3,
      earnedCourses: 1,
      missingCourses: 2,
      message: 'Chưa đủ số học phần.',
    },
    {
      code: 'TOTAL_CREDITS_MISSING',
      category: 'TOTAL_CREDITS',
      requiredCredits: '9',
      earnedCredits: '2',
      missingCredits: '7',
      message: 'Chưa đủ tổng tín chỉ.',
    },
    {
      code: 'CONDITIONAL_COURSE_MISSING',
      category: 'CONDITIONAL_COURSE',
      curriculumItemId: 'condition',
      course: {
        ...course,
        id: 'condition',
        courseCode: 'SYN000',
        courseName: 'Học phần điều kiện 0 tín chỉ',
      },
      blockSymbol: null,
      reason: 'NOT_TAKEN',
      message: 'Chưa hoàn thành học phần điều kiện.',
    },
  ],
};
export const graduationAudit: GraduationAudit = {
  id: 'audit',
  contextId: 'context',
  enrollmentId: 'enrollment',
  programVersionId: 'version',
  auditedAt: eligibleGraduation.evaluatedAt,
  auditedBy: { id: 'office', fullName: 'Phòng Đào tạo tổng hợp' },
  trigger: 'STAFF',
  supersedesId: null,
  inputDigest: 'synthetic',
  result: eligibleGraduation,
  freshness: 'CURRENT',
};
export const graduationBatch: GraduationBatch = {
  id: 'batch',
  requestedById: 'office',
  status: 'COMPLETED_WITH_ERRORS',
  filters: { semesterId: 'semester', programId: 'program', cohortId: null },
  studentCount: 1,
  enrollmentCount: 2,
  previewRevision: 'a'.repeat(64),
  processedCount: 2,
  eligibleCount: 1,
  notEligibleCount: 0,
  errorCount: 1,
  createdAt: eligibleGraduation.evaluatedAt,
  startedAt: eligibleGraduation.evaluatedAt,
  finishedAt: eligibleGraduation.evaluatedAt,
  failure: null,
};
export const graduationItem: GraduationBatchItem = {
  id: 'item',
  ...graduationLookup,
  studentCode: 'SYN001',
  fullName: 'Sinh viên tổng hợp',
  programCode: 'SYN-P',
  programName: 'Chương trình tổng hợp',
  enrollmentId: 'enrollment',
  status: 'REVIEWED',
  auditId: 'audit',
  conclusion: 'ELIGIBLE',
  shortfallCount: 0,
  error: null,
  finishedAt: eligibleGraduation.evaluatedAt,
};
export interface GraduationWrite {
  path: string;
  method: string;
  body: unknown;
  headers: Headers;
}
export const jsonGraduation = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
function canonical(path: string) {
  const url = new URL(path, 'http://localhost');
  url.searchParams.sort();
  return `${url.pathname}${url.search}`;
}
interface GraduationRenderOptions {
  element?: ReactElement;
  path?: string;
  entry?: string;
  routes?: RouteObject[];
  roleCodes?: string[];
  permissions?: components['schemas']['PermissionCode'][];
  reads?: Record<string, unknown>;
  readResponse?: (path: string) => Response | Promise<Response> | undefined;
  writeResponse?: (
    write: GraduationWrite,
  ) => Response | Promise<Response> | undefined;
}
export function renderGraduationPage(options: GraduationRenderOptions) {
  const writes: GraduationWrite[] = [];
  const me = {
    id: 'office',
    username: 'synthetic',
    userCode: 'SYN',
    fullName: 'Người kiểm thử',
    email: null,
    orgUnit: null,
    mustChangePassword: false,
    roles: (options.roleCodes ?? ['R1']).map((roleCode) => ({
      roleCode,
      roleName: roleCode,
      scopeType: 'SYSTEM' as const,
      scopeUnit: null,
      derived: false,
    })),
    permissions: options.permissions ?? ['graduation.view', 'graduation.audit'],
  } satisfies components['schemas']['MeDto'];
  const emptyPage = { items: [], total: 0, page: 1, pageSize: 20 };
  const reads: Record<string, unknown> = {
    '/api/auth/me': me,
    '/api/notifications/unread-count': { count: 0 },
    '/api/semesters': [
      {
        id: 'semester',
        semesterCode: '2026-1',
        academicYear: '2026-2027',
        termInYear: 1,
        startDate: '2026-09-01',
      },
    ],
    '/api/cohorts': [{ id: 'cohort', cohortCode: 'K26', intakeYear: 2026 }],
    '/api/graduation/program-options?semesterId=semester': [
      {
        id: 'program',
        programCode: 'SYN-P',
        programName: 'Chương trình tổng hợp',
      },
    ],
    '/api/graduation/student-options?programId=program&semesterId=semester&page=1&pageSize=20':
      {
        ...emptyPage,
        total: 1,
        items: [
          {
            id: 'student',
            studentCode: 'SYN001',
            fullName: 'Sinh viên tổng hợp',
            enrollmentId: 'enrollment',
            cohortId: 'cohort',
            cohortCode: 'K26',
          },
        ],
      },
    '/api/students/student/graduation?programId=program&semesterId=semester': {
      status: 'REVIEWED',
      result: eligibleGraduation,
      error: null,
    },
    '/api/students/student/graduation-audits?programId=program&semesterId=semester&page=1&pageSize=20':
      emptyPage,
    '/api/students/student/graduation-reaudit-tasks?programId=program&semesterId=semester&page=1&pageSize=20':
      emptyPage,
    '/api/graduation-audits/audit': graduationAudit,
    '/api/graduation-batches?page=1&pageSize=20': emptyPage,
    '/api/graduation-batches/batch': graduationBatch,
    '/api/graduation-batches/batch/items?page=1&pageSize=20': {
      ...emptyPage,
      total: 1,
      items: [graduationItem],
    },
    ...options.reads,
  };
  const table = new Map(
    Object.entries(reads).map(([path, data]) => [canonical(path), data]),
  );
  const fetchMock = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input);
      const method = init?.method ?? 'GET';
      if (method !== 'GET') {
        const write = {
          path,
          method,
          body: init?.body
            ? (JSON.parse(String(init.body)) as unknown)
            : undefined,
          headers: new Headers(init?.headers),
        };
        writes.push(write);
        return (
          options.writeResponse?.(write) ??
          jsonGraduation({ message: 'Chưa cấu hình phản hồi ghi.' }, 500)
        );
      }
      const custom = options.readResponse?.(path);
      if (custom !== undefined) return custom;
      const body = table.get(canonical(path));
      return body instanceof Response
        ? body.clone()
        : body === undefined
          ? jsonGraduation({ message: 'Không tìm thấy dữ liệu tổng hợp.' }, 404)
          : jsonGraduation(body);
    },
  );
  vi.stubGlobal('fetch', fetchMock);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createMemoryRouter(
    options.routes ?? [
      { path: options.path ?? ROUTES.graduation, element: options.element },
      { path: '*', element: <div>Đích điều hướng</div> },
    ],
    { initialEntries: [options.entry ?? graduationEntry] },
  );
  const rendered = render(
    <QueryClientProvider client={client}>
      <ConfigProvider theme={{ token: { motion: false } }}>
        <App>
          <RouterProvider router={router} />
        </App>
      </ConfigProvider>
    </QueryClientProvider>,
  );
  return { ...rendered, writes, fetchMock, client, router };
}
