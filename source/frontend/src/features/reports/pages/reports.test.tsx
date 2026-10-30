import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from 'antd';
import type { ReactNode } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  ChangeRequestStatistics,
  CreditDistribution,
  ProgramComparison,
} from '../api/reports';
import AccreditationExportPage from './AccreditationExportPage';
import ChangeRequestStatisticsPage from './ChangeRequestStatisticsPage';
import CreditDistributionPage from './CreditDistributionPage';
import ProgramComparisonPage from './ProgramComparisonPage';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

const PROGRAMS = ['A', 'B'].map((code) => ({
  id: `p${code}`,
  programCode: `CT${code}`,
  programName: `Chương trình ${code}`,
  degreeLevel: 'UNDERGRADUATE',
  status: 'ACTIVE',
  faculty: { id: 'f', unitCode: 'CNTT', unitName: 'Khoa CNTT' },
  currentVersion: { id: `v${code}`, versionNumber: '1.0', status: 'ACTIVE' },
  directors: [],
}));

const ref = (code: string) => ({
  id: `v${code}`,
  programCode: `CT${code}`,
  programName: `Chương trình ${code}`,
  versionNumber: '1.0',
  status: 'ACTIVE' as const,
  totalCredits: '130',
});

type Answer = (url: string) => Response | undefined;

function stub(answer: Answer) {
  const calls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string) => {
      const url = String(input).replace(/^.*\/api/, '/api');
      calls.push(url);
      const path = url.split('?')[0];
      if (path === '/api/programs')
        return json({ items: PROGRAMS, total: 2, page: 1, pageSize: 100 });
      const detail = /^\/api\/programs\/(p\w)$/.exec(path);
      if (detail) {
        const program = PROGRAMS.find((item) => item.id === detail[1])!;
        return json({
          ...program,
          versions: [
            program.currentVersion,
            { id: `${program.id}-draft`, versionNumber: null, status: 'DRAFT' },
          ],
        });
      }
      return answer(url) ?? json({});
    }),
  );
  return calls;
}

function renderPage(page: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const router = createMemoryRouter([{ path: '/', element: page }]);
  render(
    <QueryClientProvider client={queryClient}>
      <App>
        <RouterProvider router={router} />
      </App>
    </QueryClientProvider>,
  );
}

async function pickProgram(label: string, optionTitle: string) {
  fireEvent.mouseDown(screen.getByLabelText(`${label}: chương trình`));
  const options = await screen.findAllByTitle(optionTitle);
  fireEvent.click(options[options.length - 1]!);
}

afterEach(() => vi.unstubAllGlobals());

describe('ProgramComparisonPage (MH-60)', () => {
  it('compares the current versions of two programs', async () => {
    const result: ProgramComparison = {
      left: ref('A'),
      right: ref('B'),
      summary: {
        sharedCount: 1,
        equivalentCount: 0,
        leftOnlyCount: 0,
        rightOnlyCount: 0,
        sharedCreditsLeft: '3',
        sharedCreditsRight: '3',
      },
      shared: [
        {
          courseCode: 'HP1',
          courseName: 'Lập trình',
          left: {
            plannedSemester: 1,
            credits: '3',
            isElective: false,
            blockSymbol: null,
          },
          right: {
            plannedSemester: 2,
            credits: '3',
            isElective: false,
            blockSymbol: null,
          },
          differences: ['SEMESTER'],
        },
      ],
      equivalent: [],
      leftOnly: [],
      rightOnly: [],
    };
    const calls = stub((url) =>
      url.startsWith('/api/reports/program-comparison')
        ? json(result)
        : undefined,
    );
    renderPage(<ProgramComparisonPage />);
    expect(
      screen.getByText('Chọn phiên bản của hai chương trình để so sánh.'),
    ).toBeInTheDocument();
    await pickProgram('Chương trình A', 'CTA — Chương trình A');
    await pickProgram('Chương trình B', 'CTB — Chương trình B');
    expect(await screen.findByText('Lập trình')).toBeInTheDocument();
    expect(screen.getByText('Học kỳ')).toBeInTheDocument();
    expect(
      calls.some((url) => url.includes('leftVersionId=vA&rightVersionId=vB')),
    ).toBe(true);
    expect(screen.getByRole('button', { name: 'Xuất Excel' })).toBeEnabled();
  });
});

describe('CreditDistributionPage (MH-61)', () => {
  it('warns when the requirement does not match the declared total', async () => {
    const result: CreditDistribution = {
      version: ref('A'),
      totals: {
        allRows: '152',
        compulsory: '122',
        electiveOffered: '30',
        required: '122',
        declaredTotal: '130',
        declaredCompulsory: '122',
        declaredElective: '8',
        requiredIsPartial: true,
      },
      byBlock: [
        {
          key: '',
          label: 'Chưa gán khối kiến thức',
          compulsory: '122',
          elective: '30',
          total: '152',
          courseCount: 50,
        },
      ],
      bySemester: [],
      byCourseType: [],
      electiveGroups: [],
    };
    stub((url) =>
      url.startsWith('/api/reports/credit-distribution')
        ? json(result)
        : undefined,
    );
    renderPage(<CreditDistributionPage />);
    await pickProgram('Chương trình', 'CTA — Chương trình A');
    expect(
      await screen.findByText('Số tín chỉ yêu cầu chưa khớp tổng công bố'),
    ).toBeInTheDocument();
    expect(screen.getByText('Chưa gán khối kiến thức')).toBeInTheDocument();
  });
});

describe('AccreditationExportPage (MH-62)', () => {
  it('names the courses that block the dossier', async () => {
    stub((url) =>
      url.includes('/accreditation/export')
        ? json(
            {
              code: 'REPORT_GRADING_UNAVAILABLE',
              message: 'Chưa đủ dữ liệu đánh giá.',
              details: [
                { field: 'HP1', constraints: ['gradingMissing'] },
                { field: 'HP2', constraints: ['gradingMissing'] },
              ],
            },
            409,
          )
        : undefined,
    );
    renderPage(<AccreditationExportPage />);
    await pickProgram('Chương trình', 'CTA — Chương trình A');
    const button = screen.getByRole('button', { name: 'Tải hồ sơ' });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    expect(
      await screen.findByText('Học phần cần bổ sung: HP1, HP2'),
    ).toBeInTheDocument();
  });

  it('offers only issued versions', async () => {
    stub(() => undefined);
    renderPage(<AccreditationExportPage />);
    await pickProgram('Chương trình', 'CTA — Chương trình A');
    fireEvent.mouseDown(screen.getByLabelText('Chương trình: phiên bản'));
    expect(
      (await screen.findAllByTitle('1.0 · Đang hiệu lực')).length,
    ).toBeGreaterThan(0);
    expect(screen.queryByTitle('Nháp · Nháp')).toBeNull();
  });
});

describe('ChangeRequestStatisticsPage (MH-44)', () => {
  it('shows counts and per-level timing', async () => {
    const result: ChangeRequestStatistics = {
      total: 3,
      byStatus: [
        { key: 'EFFECTIVE', count: 2 },
        { key: 'REJECTED', count: 1 },
      ],
      byType: [{ key: 'CURRICULUM', count: 3 }],
      byOrigin: [{ key: 'FACULTY', count: 3 }],
      levels: [
        { approvalLevel: 1, visitCount: 3, averageHours: 5.5 },
        { approvalLevel: 2, visitCount: 2, averageHours: 12 },
        { approvalLevel: 3, visitCount: 0, averageHours: null },
      ],
      scoped: true,
    };
    stub((url) =>
      url.startsWith('/api/reports/change-request-statistics')
        ? json(result)
        : undefined,
    );
    renderPage(<ChangeRequestStatisticsPage />);
    expect(await screen.findByText('5.5')).toBeInTheDocument();
    expect(screen.getByText('Chưa có lượt')).toBeInTheDocument();
    expect(
      screen.getByText('Chỉ tính các đề xuất trong phạm vi được giao.'),
    ).toBeInTheDocument();
  });
});
