import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from 'antd';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Curriculum, CurriculumItem } from '../api/curriculum';
import { CURRICULUM_SCORE_MESSAGE } from '../schema/curriculumRules';
import { curriculum as fixture, item, trackFixture } from '../testFixtures';
import { CurriculumItemModal, toItemBody } from './CurriculumItemModal';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

const SEARCH_RESULT = {
  items: [
    {
      id: 'c-MAT101',
      courseCode: 'MAT101',
      courseName: 'Giải tích 1',
      credits: '3',
      status: 'ACTIVE',
    },
    {
      id: 'c-NEW01',
      courseCode: 'NEW01',
      courseName: 'Học phần mới',
      credits: '3',
      status: 'ACTIVE',
    },
  ],
  total: 2,
  page: 1,
  pageSize: 20,
};

function renderModal(
  row: CurriculumItem | null,
  write: (body: Record<string, unknown>) => Response = () => json({}),
  data: Curriculum = fixture(),
) {
  const onClose = vi.fn();
  const writes: {
    method: string;
    url: string;
    body: Record<string, unknown>;
  }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (init?.method === 'POST' || init?.method === 'PATCH') {
        const body = JSON.parse(String(init.body)) as Record<string, unknown>;
        writes.push({ method: init.method, url, body });
        return Promise.resolve(write(body));
      }
      if (url.startsWith('/api/courses?'))
        return Promise.resolve(json(SEARCH_RESULT));
      return Promise.resolve(json({}, 404));
    }),
  );
  render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false },
          },
        })
      }
    >
      <App>
        <CurriculumItemModal curriculum={data} item={row} onClose={onClose} />
      </App>
    </QueryClientProvider>,
  );
  return { onClose, writes };
}

afterEach(() => vi.unstubAllGlobals());

describe('toItemBody', () => {
  it('sends blank optional text as null so it clears the column', () => {
    expect(
      toItemBody({
        plannedSemester: 2,
        blockSymbol: '  ',
        isElective: false,
        htDa: true,
        tqDa: false,
        minStudiedScore: '',
        minTransferScore: ' 3 ',
        note: null,
      }),
    ).toEqual({
      plannedSemester: 2,
      blockSymbol: null,
      isElective: false,
      trackId: null,
      htDa: true,
      tqDa: false,
      minStudiedScore: null,
      minTransferScore: '3',
      note: null,
    });
  });
});

describe('CurriculumItemModal', () => {
  it('does not offer a course the curriculum already lists', async () => {
    renderModal(null);
    fireEvent.mouseDown(screen.getByLabelText('Học phần'));
    expect(await screen.findByText(/NEW01 — Học phần mới/)).toBeInTheDocument();
    expect(screen.queryByText(/MAT101 — Giải tích 1/)).not.toBeInTheDocument();
  });

  it('posts a new row with the course, the semester and the Excel columns', async () => {
    const { writes, onClose } = renderModal(null);
    fireEvent.mouseDown(screen.getByLabelText('Học phần'));
    fireEvent.click(await screen.findByText(/NEW01 — Học phần mới/));
    fireEvent.mouseDown(screen.getByLabelText('Học kỳ'));
    fireEvent.click(await screen.findByText('Học kỳ 2'));
    fireEvent.change(screen.getByLabelText('Điểm học'), {
      target: { value: '5.5' },
    });
    fireEvent.click(screen.getByLabelText('HT ĐA'));
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(writes).toEqual([
      {
        method: 'POST',
        url: '/api/program-versions/v1/curriculum-items',
        body: {
          courseId: 'c-NEW01',
          plannedSemester: 2,
          blockSymbol: null,
          isElective: false,
          trackId: null,
          htDa: true,
          tqDa: false,
          minStudiedScore: '5.5',
          minTransferScore: null,
          note: null,
        },
      },
    ]);
  });

  it('shows the course of an existing row without a picker, and patches without a course', async () => {
    const row = item('MAT101', 'Giải tích 1', {
      plannedSemester: 1,
      note: 'cũ',
    });
    const { writes, onClose } = renderModal(row);
    expect(screen.getByText('MAT101 — Giải tích 1')).toBeInTheDocument();
    expect(screen.queryByLabelText('Học phần')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Ghi chú'), {
      target: { value: 'mới' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(writes[0].method).toBe('PATCH');
    expect(writes[0].url).toBe('/api/curriculum-items/i-MAT101');
    expect(writes[0].body).not.toHaveProperty('courseId');
    expect(writes[0].body).toMatchObject({ note: 'mới', plannedSemester: 1 });
  });

  it('disables the type of a grouped row and says why', () => {
    renderModal(
      item('IT301', 'Mạng', {
        isElective: true,
        electiveGroup: { id: 'g1', groupCode: 'TC1' },
      }),
    );
    expect(screen.getByLabelText('Bắt buộc')).toBeDisabled();
    expect(screen.getByLabelText('Tự chọn')).toBeDisabled();
    expect(
      screen.getByText('Gỡ khỏi nhóm tự chọn trước khi đổi thành bắt buộc.'),
    ).toBeInTheDocument();
  });

  it('puts the server refusal of semester 9 under the semester field', async () => {
    const message = 'Học kỳ vượt quá số học kỳ của chương trình (4 học kỳ).';
    const { onClose } = renderModal(item('MAT101', 'Giải tích 1'), () =>
      json(
        {
          code: 'SEMESTER_OUT_OF_RANGE',
          message,
          details: [
            { field: 'plannedSemester', constraints: ['semesterRange'] },
          ],
        },
        400,
      ),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));
    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('allows selecting a ProgramTrack for the item', async () => {
    const { writes, onClose } = renderModal(
      item('MAT101', 'Giải tích 1'),
      () => json({}),
      fixture({ tracks: [trackFixture()] }),
    );
    fireEvent.mouseDown(screen.getByLabelText('Định hướng / Chuyên ngành'));
    fireEvent.click(await screen.findByText('CNPM — Công nghệ phần mềm'));
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(writes[0].body).toMatchObject({ trackId: 't-cnpm' });
  });

  it('blocks a threshold above 10 (DEC-11 0..10 scale) before anything is sent', async () => {
    const { writes } = renderModal(item('MAT101', 'Giải tích 1'));
    fireEvent.change(screen.getByLabelText('Điểm học'), {
      target: { value: '10.5' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));
    expect(
      await screen.findByText(CURRICULUM_SCORE_MESSAGE),
    ).toBeInTheDocument();
    expect(writes).toHaveLength(0);
  });
});
