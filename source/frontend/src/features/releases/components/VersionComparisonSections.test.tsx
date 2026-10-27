import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { comparison, renderReleasePage } from '../testRender';
import { VersionComparisonSections } from './VersionComparisonSections';

afterEach(() => vi.unstubAllGlobals());
describe('VersionComparisonSections', () => {
  it('retains six unchanged groups', () => {
    renderReleasePage({
      path: '/',
      entry: '/',
      element: (
        <VersionComparisonSections
          programId="p1"
          beforeVersionId="v1"
          afterVersionId="v2"
          sections={comparison().sections}
        />
      ),
    });
    expect(screen.getAllByText('Không thay đổi')).toHaveLength(6);
  });
  it('groups operations in order, escapes text and links only two-sided pins', () => {
    const data = comparison();
    data.sections[0]!.rows = ['CHANGED', 'REMOVED', 'ADDED'].map((change) => ({
      itemKey: change,
      label: change,
      change: change as 'CHANGED' | 'REMOVED' | 'ADDED',
      fields: [
        {
          name: 'name',
          label: 'Tên',
          before: null,
          after: '<img src=x onerror=alert(1)>\nDòng mới',
        },
      ],
      syllabusComparison:
        change === 'CHANGED'
          ? { courseId: 'c1', beforeSyllabusId: 'sy1', afterSyllabusId: 'sy2' }
          : null,
    }));
    const { writes } = renderReleasePage({
      path: '/',
      entry: '/',
      element: (
        <VersionComparisonSections
          programId="p1"
          beforeVersionId="v1"
          afterVersionId="v2"
          sections={data.sections}
        />
      ),
    });
    expect(
      screen
        .getAllByRole('region')
        .map((region) => region.getAttribute('aria-label')),
    ).toEqual(['INFO — Thêm', 'INFO — Bớt', 'INFO — Sửa']);
    expect(document.querySelector('img')).toBeNull();
    expect(screen.getAllByText(/<img src=x/)).toHaveLength(3);
    expect(
      screen.getByRole('link', { name: 'Xem khác biệt đề cương' }),
    ).toHaveAttribute(
      'href',
      '/programs/p1/version-comparison/syllabi/c1?beforeVersionId=v1&afterVersionId=v2',
    );
    expect(writes).toEqual([]);
  });
});
