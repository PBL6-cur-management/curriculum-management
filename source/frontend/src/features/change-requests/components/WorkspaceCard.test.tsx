import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from 'antd';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { detail } from '../testFixtures';
import { workspaceLinks } from '../workspaceLinks';
import { WorkspaceCard } from './WorkspaceCard';

function renderCard(request: ReturnType<typeof detail>) {
  const fetchMock = vi.fn(() =>
    Promise.resolve(new Response(JSON.stringify(detail()))),
  );
  vi.stubGlobal('fetch', fetchMock);
  render(
    <QueryClientProvider client={new QueryClient()}>
      <App>
        <MemoryRouter>
          <WorkspaceCard request={request} />
        </MemoryRouter>
      </App>
    </QueryClientProvider>,
  );
  return fetchMock;
}

const programCopy = (type: 'CURRICULUM' | 'PROGRAM_INFO' | 'OUTCOME') =>
  detail({
    requestType: type,
    workspace: {
      kind: 'PROGRAM_VERSION',
      copyId: 'v7',
      programId: 'p1',
      courseId: null,
      baseLabel: 'Phiên bản 2.1',
      isStale: false,
    },
  });

afterEach(() => vi.unstubAllGlobals());

describe('WorkspaceCard', () => {
  it('links a curriculum request to the framework and the elective groups of the copy', () => {
    renderCard(programCopy('CURRICULUM'));
    expect(screen.getByText('Dựa trên Phiên bản 2.1')).toBeInTheDocument();
    expect(
      screen
        .getByRole('button', { name: 'Sửa khung chương trình' })
        .closest('a'),
    ).toHaveAttribute('href', '/programs/p1/versions/v7/curriculum');
    expect(
      screen.getByRole('button', { name: 'Sửa nhóm tự chọn' }).closest('a'),
    ).toHaveAttribute('href', '/programs/p1/versions/v7/elective-groups');
  });

  it('points a syllabus request at the editor with the request id', () => {
    renderCard(detail());
    expect(
      screen
        .getByRole('button', { name: 'Sửa nội dung đề cương' })
        .closest('a'),
    ).toHaveAttribute('href', '/courses/c1/syllabus/edit?requestId=r1');
  });

  it('warns about a stale base and rebases only after the confirmation', async () => {
    const fetchMock = renderCard(
      detail({
        workspace: { ...detail().workspace!, isStale: true },
      }),
    );
    expect(screen.getByText(/Dữ liệu gốc đã thay đổi/)).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: 'Làm lại trên bản mới' }),
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Làm lại' }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/change-requests/r1/rebase',
        expect.objectContaining({ method: 'POST' }),
      ),
    );
  });

  it('shows no rebase button on a fresh base', () => {
    renderCard(detail());
    expect(
      screen.queryByRole('button', { name: 'Làm lại trên bản mới' }),
    ).not.toBeInTheDocument();
  });
});

describe('workspaceLinks', () => {
  it('sends a grading-formula request on a course to the formula tab and keeps the request id', () => {
    const [link] = workspaceLinks('GRADING_FORMULA', detail().workspace!, 'r1');
    expect(link).toEqual({
      label: 'Sửa công thức điểm và ánh xạ CLO',
      to: '/courses/c1/syllabus/edit?requestId=r1&tab=formula',
    });
  });

  it('sends an outcome request on a course to the CLO tab and one on a program to the three outcome screens', () => {
    const syllabus = detail().workspace!;
    expect(workspaceLinks('OUTCOME', syllabus, 'r1')[0].to).toBe(
      '/courses/c1/syllabus/edit?requestId=r1&tab=clos',
    );
    expect(
      workspaceLinks('OUTCOME', programCopy('OUTCOME').workspace!, 'r1').map(
        (link) => link.to,
      ),
    ).toEqual([
      '/programs/p1/versions/v7/plos',
      '/programs/p1/versions/v7/course-plo-matrix',
      '/programs/p1/versions/v7/clo-plo-matrix',
    ]);
    expect(
      workspaceLinks(
        'PROGRAM_INFO',
        programCopy('PROGRAM_INFO').workspace!,
        'r1',
      )[0].to,
    ).toBe('/programs/p1/versions/v7/info');
  });
});
