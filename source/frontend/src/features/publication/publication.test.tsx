import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from 'antd';
import type { ReactNode } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  CourseGraph,
  GraphEdge,
  ProgramHealth,
  ProgramTimeline,
} from './api/publication';
import { dependencyChain, layoutCourseGraph } from './graph/courseGraphLayout';
import CourseGraphPage from './pages/CourseGraphPage';
import ProgramHealthPage from './pages/ProgramHealthPage';
import VersionTimelinePage from './pages/VersionTimelinePage';

// G6 draws on a canvas jsdom does not have; the page's list carries the same facts.
vi.mock('./components/CourseGraphCanvas', () => ({
  CourseGraphCanvas: () => <div data-testid="graph-canvas" />,
}));

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

const VERSION = {
  id: 'v1',
  programId: 'p1',
  programCode: 'CT1',
  programName: 'Công nghệ thông tin',
  versionNumber: '1.0',
  status: 'ACTIVE' as const,
  semesterCount: 3,
};

const node = (code: string, semester: number | null, external = false) => ({
  id: external ? `course:${code}` : `item:${code}`,
  itemId: external ? null : code,
  courseId: `c-${code}`,
  courseCode: code.toUpperCase(),
  courseName: `Học phần ${code}`,
  credits: '3',
  semester,
  sortOrder: 1,
  external,
});
const edge = (
  source: string,
  target: string,
  relationType: GraphEdge['relationType'],
): GraphEdge => ({
  id: `${source}>${target}`,
  source,
  target,
  relationType,
  minScore: null,
});

const GRAPH: CourseGraph = {
  version: VERSION,
  nodes: [
    node('a', 1),
    node('b', 2),
    node('c', 3),
    node('d', 3),
    node('x', null, true),
  ],
  edges: [
    edge('item:a', 'item:b', 'PREREQUISITE'),
    edge('item:b', 'item:c', 'PRIOR'),
    edge('course:x', 'item:a', 'PRIOR'),
    edge('item:c', 'item:d', 'COREQUISITE'),
  ],
} as CourseGraph;

function stub(
  answer: (url: string, init?: RequestInit) => Response | undefined,
) {
  const calls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string, init?: RequestInit) => {
      const url = String(input).replace(/^.*\/api/, '/api');
      calls.push(`${init?.method ?? 'GET'} ${url}`);
      return answer(url, init) ?? json({});
    }),
  );
  return calls;
}

function renderAt(path: string, pattern: string, page: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const router = createMemoryRouter([{ path: pattern, element: page }], {
    initialEntries: [path],
  });
  render(
    <QueryClientProvider client={queryClient}>
      <App>
        <RouterProvider router={router} />
      </App>
    </QueryClientProvider>,
  );
}

afterEach(() => vi.unstubAllGlobals());

describe('course graph layout (US-110)', () => {
  it('puts outside-frame requisites in their own first column', () => {
    const layout = layoutCourseGraph(GRAPH);
    expect(layout.columns.map((column) => column.label)).toEqual([
      'Ngoài khung',
      'Học kỳ 1',
      'Học kỳ 2',
      'Học kỳ 3',
    ]);
    const byId = new Map(layout.nodes.map((placed) => [placed.id, placed]));
    expect(byId.get('course:x')!.column).toBe(0);
    expect(byId.get('item:a')!.column).toBe(1);
    expect(byId.get('item:d')!.y).toBeGreaterThan(byId.get('item:c')!.y);
  });

  it('walks ordering relations both ways and stops at corequisites and cycles', () => {
    const chain = dependencyChain(
      [...GRAPH.edges, edge('item:c', 'item:a', 'PRIOR')],
      'item:b',
    );
    expect([...chain.ancestors].sort()).toEqual([
      'course:x',
      'item:a',
      'item:c',
    ]);
    expect([...chain.descendants].sort()).toEqual(['item:a', 'item:c']);
    expect(chain.corequisites.size).toBe(0);
    expect(dependencyChain(GRAPH.edges, 'item:c').corequisites).toEqual(
      new Set(['item:d']),
    );
  });
});

describe('CourseGraphPage (MH-20)', () => {
  it('lists what a chosen course needs and what needs it', async () => {
    stub((url) => (url.endsWith('/course-graph') ? json(GRAPH) : undefined));
    renderAt(
      '/programs/p1/versions/v1/course-graph',
      '/programs/:programId/versions/:versionId/course-graph',
      <CourseGraphPage />,
    );
    expect(await screen.findByTestId('graph-canvas')).toBeTruthy();
    expect(
      screen.getByText('1 học phần điều kiện nằm ngoài khung chương trình'),
    ).toBeTruthy();
    fireEvent.mouseDown(screen.getByLabelText('Chọn học phần'));
    const options = await screen.findAllByTitle('B — Học phần b');
    fireEvent.click(options[options.length - 1]!);
    expect(await screen.findByText('Phụ thuộc vào học phần này')).toBeTruthy();
    expect(screen.getByText(/HK1 · A Học phần a/)).toBeTruthy();
    expect(screen.getByText(/X Học phần x/)).toBeTruthy();
    expect(screen.getByText(/HK3 · C Học phần c/)).toBeTruthy();
  });
});

describe('ProgramHealthPage (MH-28)', () => {
  it('shows issues worst first with a link to where they are fixed', async () => {
    const health: ProgramHealth = {
      version: VERSION,
      checkedAt: '2026-10-31T00:00:00Z',
      complete: true,
      categories: [
        { category: 'CREDIT', count: 1, checked: true },
        { category: 'ASSESSMENT_CLO', count: 1, checked: true },
      ],
      issues: [
        {
          category: 'CREDIT',
          code: 'CREDIT_TOTAL_MISMATCH',
          severity: 'ERROR',
          message: 'Tổng tín chỉ 122 khác 130',
          semester: null,
          courseCode: null,
          itemId: null,
          courseId: null,
          target: 'CURRICULUM',
        },
        {
          category: 'ASSESSMENT_CLO',
          code: 'CLO_NOT_ASSESSED',
          severity: 'HIGH',
          message: 'CLO2 của A chưa được đánh giá',
          semester: 1,
          courseCode: 'A',
          itemId: 'i1',
          courseId: 'c1',
          target: 'ITEM_CLO_PLO',
        },
      ],
      errorCount: 1,
      warningCount: 1,
    } as ProgramHealth;
    stub((url) => (url.endsWith('/health') ? json(health) : undefined));
    renderAt(
      '/programs/p1/versions/v1/health',
      '/programs/:programId/versions/:versionId/health',
      <ProgramHealthPage />,
    );
    expect(await screen.findByText('Tổng tín chỉ 122 khác 130')).toBeTruthy();
    expect(
      screen
        .getByRole('link', { name: 'Khung chương trình' })
        .getAttribute('href'),
    ).toBe('/programs/p1/versions/v1/curriculum');
    expect(
      screen
        .getByRole('link', { name: 'CLO–PLO của học phần' })
        .getAttribute('href'),
    ).toBe('/programs/p1/versions/v1/items/i1/clo-plo');
    fireEvent.click(screen.getByText('Đánh giá CLO (1)'));
    await waitFor(() =>
      expect(screen.queryByText('Tổng tín chỉ 122 khác 130')).toBeNull(),
    );
  });

  it('never claims "no issues" when a check could not run', async () => {
    stub((url) =>
      url.endsWith('/health')
        ? json({
            version: VERSION,
            checkedAt: '2026-10-31T00:00:00Z',
            complete: false,
            categories: [],
            issues: [],
            errorCount: 0,
            warningCount: 0,
          })
        : undefined,
    );
    renderAt(
      '/programs/p1/versions/v1/health',
      '/programs/:programId/versions/:versionId/health',
      <ProgramHealthPage />,
    );
    expect(await screen.findByText('Báo cáo chưa đầy đủ')).toBeTruthy();
    expect(screen.queryByText('Không có cảnh báo')).toBeNull();
  });
});

describe('VersionTimelinePage (MH-46)', () => {
  it('shows each issued version with its cohorts and a compare link', async () => {
    const timeline: ProgramTimeline = {
      programId: 'p1',
      programCode: 'CT1',
      programName: 'Công nghệ thông tin',
      events: [
        {
          versionId: 'v2',
          versionNumber: '2.0',
          status: 'ACTIVE',
          decisionNumber: '12/QĐ',
          publishedAt: '2024-05-01T00:00:00Z',
          effectiveSemester: {
            id: 's',
            semesterCode: '2024-1',
            startDate: null,
          },
          previousVersion: { id: 'v1', versionNumber: '1.0' },
          correctionOf: null,
          assignments: [
            {
              id: 'a1',
              cohortCode: 'K24',
              intakeYear: 2024,
              fromSemester: {
                id: 's',
                semesterCode: '2024-1',
                startDate: null,
              },
            },
          ],
        },
      ],
    };
    stub((url) =>
      url.endsWith('/version-timeline') ? json(timeline) : undefined,
    );
    renderAt(
      '/programs/p1/version-timeline',
      '/programs/:programId/version-timeline',
      <VersionTimelinePage />,
    );
    expect(await screen.findByText('K24 từ 2024-1')).toBeTruthy();
    expect(
      screen
        .getByRole('link', { name: 'So sánh với phiên bản 1.0' })
        .getAttribute('href'),
    ).toBe(
      '/programs/p1/version-comparison?beforeVersionId=v1&afterVersionId=v2',
    );
  });
});
