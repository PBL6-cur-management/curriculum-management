import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { curriculum } from '../testFixtures';
import { conditionalItemFixture } from '../eligibilityTestFixtures';
import { SemesterBoard } from './SemesterBoard';

describe('semester board eligibility parity', () => {
  it('uses the same status and reasons with no authoring in student mode', () => {
    const data = curriculum();
    const onShow = vi.fn();
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <SemesterBoard
            curriculum={data}
            items={data.items}
            studentMode
            eligibilityByItemId={
              new Map(
                data.items.map((item) => [
                  item.id,
                  conditionalItemFixture(item.id),
                ]),
              )
            }
            onShowEligibility={onShow}
            onEdit={() => {}}
            onRequisites={() => {}}
          />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getAllByText('Được có điều kiện')).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: 'Xem lý do MAT101' }));
    expect(onShow).toHaveBeenCalledWith('i-MAT101');
    expect(
      screen.queryByRole('button', { name: /Sửa/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getAllByRole('link', { name: 'Đề cương' })[0],
    ).toHaveAttribute('href', '/courses/c-MAT101/syllabus?versionId=v1');
  });
});
