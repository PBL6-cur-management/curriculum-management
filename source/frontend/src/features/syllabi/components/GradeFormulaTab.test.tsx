import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from 'antd';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  assessmentComponent,
  courseSyllabus,
  gradeFormula,
  RULES,
  syllabus,
} from '../testFixtures';
import { GradeFormulaTab } from './GradeFormulaTab';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

function renderTab(
  formula = gradeFormula([
    assessmentComponent('gk', { weight: '40', componentName: 'Giữa kỳ' }),
    assessmentComponent('ck', { weight: '60', componentName: 'Cuối kỳ' }),
  ]),
  put: () => Response = () => json(formula),
) {
  const current = syllabus({ gradingFormula: formula });
  const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
    if (init?.method === 'PUT') return Promise.resolve(put());
    return Promise.resolve(json(courseSyllabus({ draft: current })));
  });
  vi.stubGlobal('fetch', fetchMock);
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <App>
        <GradeFormulaTab
          courseId="c1"
          syllabus={current}
          attachmentRules={RULES}
          canEditClos
          canEditContent
          canEditGradingFormula
        />
      </App>
    </QueryClientProvider>,
  );
  return fetchMock;
}

const puts = (fetchMock: ReturnType<typeof vi.fn>) =>
  fetchMock.mock.calls.filter(
    ([, init]) => (init as RequestInit | undefined)?.method === 'PUT',
  );

afterEach(() => vi.unstubAllGlobals());

describe('GradeFormulaTab', () => {
  it('shows the exact total and keeps save off until the rows total 100 and something changed', async () => {
    renderTab();
    const save = screen.getByRole('button', { name: 'Lưu công thức điểm' });
    expect(screen.getByRole('status')).toHaveTextContent('đủ 100%');
    expect(save).toBeDisabled();

    fireEvent.change(screen.getAllByLabelText('Tỷ trọng (%)')[0]!, {
      target: { value: '30' },
    });
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('còn thiếu 10%'),
    );
    expect(save).toBeDisabled();

    fireEvent.change(screen.getAllByLabelText('Tỷ trọng (%)')[0]!, {
      target: { value: '35,5' },
    });
    fireEvent.change(screen.getAllByLabelText('Tỷ trọng (%)')[1]!, {
      target: { value: '64.5' },
    });
    await waitFor(() => expect(save).toBeEnabled());
  });

  it('sends decimal strings, keeps ids of retained rows and drops the threshold of an unconditional row', async () => {
    const fetchMock = renderTab(
      gradeFormula([
        assessmentComponent('gk', {
          weight: '40',
          isConditional: true,
          conditionThreshold: '5',
        }),
        assessmentComponent('ck', { weight: '60' }),
      ]),
    );
    fireEvent.click(screen.getAllByRole('switch')[0]!);
    fireEvent.change(screen.getByLabelText('Điểm liệt học phần'), {
      target: { value: '4,5' },
    });
    const save = screen.getByRole('button', { name: 'Lưu công thức điểm' });
    await waitFor(() => expect(save).toBeEnabled());
    fireEvent.click(save);

    await waitFor(() => expect(puts(fetchMock)).toHaveLength(1));
    const [url, init] = puts(fetchMock)[0] as [string, RequestInit];
    expect(url).toBe('/api/syllabi/s1/grading-formula');
    expect(JSON.parse(String(init.body))).toEqual({
      expectedUpdatedAt: '2026-10-19T03:00:00.000Z',
      failingScore: '4.5',
      components: [
        expect.objectContaining({
          id: 'gk',
          componentCode: 'GK',
          weight: '40',
          isConditional: false,
          conditionThreshold: null,
        }),
        expect.objectContaining({ id: 'ck', weight: '60' }),
      ],
    });
  });

  it('names a duplicate code on the row and refuses to save it', async () => {
    const fetchMock = renderTab();
    fireEvent.change(screen.getAllByLabelText('Mã')[1]!, {
      target: { value: 'gk' },
    });
    expect(
      await screen.findAllByText('Mã thành phần bị trùng.'),
    ).not.toHaveLength(0);
    expect(puts(fetchMock)).toHaveLength(0);
  });

  it('keeps what was typed on a stale refusal and offers the reload', async () => {
    renderTab(undefined, () =>
      json(
        {
          statusCode: 409,
          code: 'ASSESSMENT_STALE',
          message: 'Đề cương đã thay đổi.',
        },
        409,
      ),
    );
    fireEvent.change(screen.getByLabelText('Điểm liệt học phần'), {
      target: { value: '3' },
    });
    const save = screen.getByRole('button', { name: 'Lưu công thức điểm' });
    await waitFor(() => expect(save).toBeEnabled());
    fireEvent.click(save);

    expect(
      await screen.findByRole('button', { name: 'Tải lại dữ liệu' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Điểm liệt học phần')).toHaveValue('3');
  });

  it('asks before removing a saved row because its mappings go with it', async () => {
    renderTab();
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Xóa thành phần' })[0]!,
    );
    expect(
      await screen.findByText('Xóa thành phần đã lưu?'),
    ).toBeInTheDocument();
  });
});
