import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { curriculum } from '../testFixtures';
import { ineligibleItemFixture } from '../eligibilityTestFixtures';
import { CurriculumTable } from './CurriculumTable';

describe('curriculum eligibility column', () => {
  function show(studentMode: boolean) {
    const data = curriculum();
    const onShowEligibility = vi.fn();
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <CurriculumTable
            curriculum={data}
            items={data.items}
            sortable={false}
            onEdit={() => {}}
            onRequisites={() => {}}
            studentMode={studentMode}
            eligibilityByItemId={
              new Map(
                data.items.map((item) => [
                  item.id,
                  ineligibleItemFixture(item.id),
                ]),
              )
            }
            onShowEligibility={onShowEligibility}
          />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    return onShowEligibility;
  }
  it('does not add a status column to ordinary browsing', () => {
    show(false);
    expect(
      screen.queryByRole('columnheader', { name: 'Đăng ký được?' }),
    ).not.toBeInTheDocument();
  });
  it('shows named reason actions and version-pinned syllabus links in student mode', () => {
    const onShow = show(true);
    expect(
      screen.getByRole('columnheader', { name: 'Đăng ký được?' }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Xem lý do MAT101' }));
    expect(onShow).toHaveBeenCalledWith('i-MAT101');
    expect(
      screen.getAllByRole('link', { name: 'Đề cương' })[0],
    ).toHaveAttribute('href', '/courses/c-MAT101/syllabus?versionId=v1');
    expect(
      screen.queryByRole('button', { name: /Sửa/ }),
    ).not.toBeInTheDocument();
  });
});
