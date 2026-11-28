import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from 'antd';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CourseDetail } from '../api/courses';
import { GRADE_POINT_MESSAGE } from '../schema/courseRules';
import { AddRelationModal } from './AddRelationModal';

const course = {
  id: 'c1',
  courseCode: 'IT001',
  courseName: 'Nhập môn lập trình',
  status: 'ACTIVE',
} as CourseDetail;

const OTHER_LABEL = 'IT002 — Toán rời rạc (3 TC)';
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

function renderModal(
  onPost: (body: Record<string, unknown>) => Response = () => json({}, 201),
) {
  const onClose = vi.fn();
  const posts: Record<string, unknown>[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith('/api/courses?'))
        return Promise.resolve(
          json({
            items: [
              {
                id: 'c2',
                courseCode: 'IT002',
                courseName: 'Toán rời rạc',
                credits: '3',
                status: 'ACTIVE',
              },
            ],
            total: 1,
            page: 1,
            pageSize: 20,
          }),
        );
      if (url === '/api/course-relations' && init?.method === 'POST') {
        const body = JSON.parse(String(init.body)) as Record<string, unknown>;
        posts.push(body);
        return Promise.resolve(onPost(body));
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
        <AddRelationModal course={course} onClose={onClose} />
      </App>
    </QueryClientProvider>,
  );
  return { onClose, posts };
}

async function choose(label: string, option: string) {
  fireEvent.mouseDown(screen.getByLabelText(label));
  fireEvent.click(await screen.findByText(option));
}

afterEach(() => vi.unstubAllGlobals());

describe('AddRelationModal', () => {
  it('shows the threshold only for a prerequisite', async () => {
    renderModal();
    expect(screen.queryByLabelText('Ngưỡng điểm')).not.toBeInTheDocument();
    await choose('IT001', 'Cần đạt tiên quyết học phần');
    expect(await screen.findByLabelText('Ngưỡng điểm')).toBeInTheDocument();
    await choose('IT001', 'Học song hành với');
    await waitFor(() =>
      expect(screen.queryByLabelText('Ngưỡng điểm')).not.toBeInTheDocument(),
    );
  });

  it('blocks a threshold above 10 before anything is sent', async () => {
    const { posts, onClose } = renderModal();
    await choose('IT001', 'Cần đạt tiên quyết học phần');
    await choose('Học phần', OTHER_LABEL);
    fireEvent.change(screen.getByLabelText('Ngưỡng điểm'), {
      target: { value: '10.5' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));
    expect(await screen.findByText(GRADE_POINT_MESSAGE)).toBeInTheDocument();
    expect(posts).toHaveLength(0);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('sends the other course as the source of a requirement this course has, with the 0..10 threshold', async () => {
    const { posts, onClose } = renderModal();
    await choose('IT001', 'Cần đạt tiên quyết học phần');
    await choose('Học phần', OTHER_LABEL);
    fireEvent.change(screen.getByLabelText('Ngưỡng điểm'), {
      target: { value: '5.5' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(posts).toEqual([
      {
        sourceCourseId: 'c2',
        targetCourseId: 'c1',
        relationType: 'PREREQUISITE',
        minScore: '5.5',
      },
    ]);
  });

  it('posts this course as the source of "Được thay thế bởi"', async () => {
    const { posts, onClose } = renderModal();
    await choose('IT001', 'Được thay thế bởi');
    await choose('Học phần', OTHER_LABEL);
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(posts).toEqual([
      {
        sourceCourseId: 'c1',
        targetCourseId: 'c2',
        relationType: 'REPLACEMENT',
        minScore: null,
      },
    ]);
  });

  it('shows the server cycle message with its path and stays open', async () => {
    const message =
      'Quan hệ này tạo thành vòng học trước/tiên quyết nên không lưu được. Đường đi của vòng: IT001 → IT002 → IT001.';
    const { onClose } = renderModal(() =>
      json({ code: 'REQUISITE_CYCLE', message }, 409),
    );
    await choose('IT001', 'Cần học trước học phần');
    await choose('Học phần', OTHER_LABEL);
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));
    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Lưu' })).toBeInTheDocument();
  });
});
