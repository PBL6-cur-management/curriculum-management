import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from 'antd';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CurriculumItem } from '../api/curriculum';
import { item } from '../testFixtures';
import { RequisitesModal } from './RequisitesModal';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

const ROW: CurriculumItem = item('IT202', 'Cấu trúc dữ liệu', {
  plannedSemester: 3,
  requisites: [
    {
      id: 'r1',
      relationType: 'PREREQUISITE',
      minScore: '2',
      sourceSemester: 2,
      sourceCourse: {
        id: 'c-IT101',
        courseCode: 'IT101',
        courseName: 'Lập trình cơ bản',
        credits: '3',
        status: 'DISCONTINUED',
      },
    },
  ],
});

function renderModal(
  write: (body: Record<string, unknown>) => Response = () => json({}),
) {
  const onClose = vi.fn();
  const puts: { url: string; body: Record<string, unknown> }[] = [];
  const searches: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (init?.method === 'PUT') {
        const body = JSON.parse(String(init.body)) as Record<string, unknown>;
        puts.push({ url, body });
        return Promise.resolve(write(body));
      }
      if (url.startsWith('/api/courses?')) {
        searches.push(url);
        return Promise.resolve(
          json({ items: [], total: 0, page: 1, pageSize: 20 }),
        );
      }
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
        <RequisitesModal versionId="v1" item={ROW} onClose={onClose} />
      </App>
    </QueryClientProvider>,
  );
  return { onClose, puts, searches };
}

afterEach(() => vi.unstubAllGlobals());

describe('RequisitesModal', () => {
  it('starts from the requisites the row has, naming the course rather than its id', () => {
    renderModal();
    expect(
      screen.getByText(/Điều kiện ở đây chỉ áp dụng cho khung này/),
    ).toBeInTheDocument();
    expect(screen.getByText(/IT101 — Lập trình cơ bản/)).toBeInTheDocument();
    expect(screen.getByLabelText('Ngưỡng điểm')).toHaveValue('2');
  });

  it('searches Active and Discontinued courses as sources', async () => {
    const { searches } = renderModal();
    await waitFor(() => expect(searches.length).toBeGreaterThan(0));
    expect(searches[0]).toContain('status=ACTIVE');
    expect(searches[0]).toContain('status=DISCONTINUED');
  });

  it('puts the row requisites in one replacing call', async () => {
    const { puts, onClose } = renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(puts).toEqual([
      {
        url: '/api/curriculum-items/i-IT202/requisites',
        body: {
          requisites: [
            {
              sourceCourseId: 'c-IT101',
              relationType: 'PREREQUISITE',
              minScore: '2',
            },
          ],
        },
      },
    ]);
  });

  it('removes a requisite and sends the empty list', async () => {
    const { puts, onClose } = renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Bỏ điều kiện' }));
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(puts[0].body).toEqual({ requisites: [] });
  });

  it('accepts 0..10 thresholds (DEC-11) and refuses a threshold above 10 before sending', async () => {
    const { puts, onClose } = renderModal();
    fireEvent.change(screen.getByLabelText('Ngưỡng điểm'), {
      target: { value: '10.5' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));
    expect(
      await screen.findByText(/Ngưỡng điểm theo thang 10/),
    ).toBeInTheDocument();
    expect(puts).toHaveLength(0);

    fireEvent.change(screen.getByLabelText('Ngưỡng điểm'), {
      target: { value: '5.5' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(puts[0].body).toEqual({
      requisites: [
        {
          sourceCourseId: 'c-IT101',
          relationType: 'PREREQUISITE',
          minScore: '5.5',
        },
      ],
    });
  });

  it('shows the cycle refusal with its path inside the dialog and stays open (KB-020)', async () => {
    const message =
      'Điều kiện này tạo thành vòng học trước/tiên quyết nên không lưu được. Đường đi của vòng: IT101 → IT202 → IT101.';
    const { onClose } = renderModal(() =>
      json({ code: 'REQUISITE_CYCLE', message }, 409),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));
    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Lưu' })).toBeInTheDocument();
  });
});
