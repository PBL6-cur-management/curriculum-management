import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from 'antd';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Syllabus } from '../api/syllabi';
import {
  assessmentComponent,
  clo,
  courseSyllabus,
  gradeFormula,
  RULES,
  syllabus,
} from '../testFixtures';
import { AssessmentCloTab } from './AssessmentCloTab';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

function renderTab(current: Syllabus, canEditClos = true) {
  const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) =>
    Promise.resolve(
      init?.method === 'PUT'
        ? json(current.gradingFormula)
        : json(courseSyllabus({ draft: current })),
    ),
  );
  vi.stubGlobal('fetch', fetchMock);
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <App>
        <AssessmentCloTab
          courseId="c1"
          syllabus={current}
          attachmentRules={RULES}
          canEditClos={canEditClos}
          canEditContent
          canEditGradingFormula
          onNavigateTab={vi.fn()}
        />
      </App>
    </QueryClientProvider>,
  );
  return fetchMock;
}

const withGrid = (mappings: { cloId: string; cloWeight: string | null }[]) =>
  syllabus({
    clos: [clo('k1', 1), clo('k2', 2)],
    gradingFormula: gradeFormula([assessmentComponent('gk', { mappings })], {
      warnings: [
        {
          code: 'ASSESSMENT_CLO_UNCOVERED',
          cloId: 'k2',
          cloCode: 'CLO2',
          message: 'x',
        },
      ],
    }),
  });

afterEach(() => vi.unstubAllGlobals());

describe('AssessmentCloTab', () => {
  it('asks to save the formula first when there are no components', () => {
    renderTab(syllabus({ clos: [clo('k1', 1)] }));
    expect(
      screen.getByText('Lưu công thức điểm trước khi ánh xạ CLO.'),
    ).toBeInTheDocument();
  });

  it('says there are no CLOs, and offers the CLO tab only to someone who can edit them', () => {
    renderTab(
      syllabus({
        gradingFormula: gradeFormula([assessmentComponent('gk')]),
      }),
      false,
    );
    expect(screen.getByText('Chưa có CLO để ánh xạ.')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Mở tab CLO' }),
    ).not.toBeInTheDocument();
  });

  it('marks an unassessed CLO and sends a mapped cell with a null percentage', async () => {
    const fetchMock = renderTab(withGrid([{ cloId: 'k1', cloWeight: '50' }]));
    expect(screen.getAllByText('Chưa được đánh giá').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('checkbox', { name: 'GK – CLO2' }));
    const save = screen.getByRole('button', { name: 'Lưu ánh xạ' });
    await waitFor(() => expect(save).toBeEnabled());
    fireEvent.click(save);

    await waitFor(() => {
      const put = fetchMock.mock.calls.find(
        ([, init]) => (init as RequestInit | undefined)?.method === 'PUT',
      );
      expect(put).toBeDefined();
      expect(JSON.parse(String((put![1] as RequestInit).body))).toEqual({
        expectedUpdatedAt: '2026-10-19T03:00:00.000Z',
        mappings: [
          { assessmentComponentId: 'gk', cloId: 'k1', cloWeight: '50' },
          { assessmentComponentId: 'gk', cloId: 'k2', cloWeight: null },
        ],
      });
    });
  });

  it('refuses an unreadable percentage before sending', async () => {
    renderTab(withGrid([{ cloId: 'k1', cloWeight: null }]));
    fireEvent.change(screen.getByLabelText('Tỷ trọng CLO (%): GK – CLO1'), {
      target: { value: '120' },
    });
    expect(
      await screen.findByText(/lớn hơn 0 và không quá 100/),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lưu ánh xạ' })).toBeDisabled();
  });
});
