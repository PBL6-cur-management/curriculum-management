import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { json, renderReleasePage, syllabusComparison } from '../testRender';
import { PinnedSyllabusComparisonPage } from './PinnedSyllabusComparisonPage';

afterEach(() => vi.unstubAllGlobals());
function renderPage(response: unknown = syllabusComparison()) {
  return renderReleasePage({
    path: '/programs/:programId/version-comparison/syllabi/:courseId',
    entry:
      '/programs/p1/version-comparison/syllabi/c1?beforeVersionId=v1&afterVersionId=v2',
    element: <PinnedSyllabusComparisonPage />,
    reads: {
      '/api/programs/p1/version-comparison/syllabi/c1?beforeVersionId=v1&afterVersionId=v2':
        response,
    },
  });
}
describe('PinnedSyllabusComparisonPage', () => {
  it('uses actual pin revisions, preserves the back pair and never fetches latest syllabus', async () => {
    const { reads, writes } = renderPage();
    expect(
      await screen.findByText(/đề cương lần 1.*sy1.*đề cương lần 2.*sy2/),
    ).toBeInTheDocument();
    expect(screen.getAllByText('Không thay đổi')).toHaveLength(3);
    expect(
      screen.getByRole('link', { name: 'So sánh phiên bản' }),
    ).toHaveAttribute(
      'href',
      '/programs/p1/version-comparison?beforeVersionId=v1&afterVersionId=v2',
    );
    expect(reads).not.toContain('/api/courses/c1/syllabus');
    expect(writes).toEqual([]);
  });
  it.each([403, 404, 409])('shows pin refusal %s', async (status) => {
    renderPage(json({ message: 'Không có hai pin để so sánh' }, status));
    expect(
      await screen.findByRole('button', { name: 'Thử lại' }),
    ).toBeInTheDocument();
  });
});
