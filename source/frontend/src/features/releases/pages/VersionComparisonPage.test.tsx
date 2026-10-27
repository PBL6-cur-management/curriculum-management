import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { comparison, json, renderReleasePage, versionRef } from '../testRender';
import { VersionComparisonPage } from './VersionComparisonPage';

afterEach(() => vi.unstubAllGlobals());
const endpoint =
  '/api/programs/p1/version-comparison?beforeVersionId=v1&afterVersionId=v2';
function renderPage(
  pair = '?beforeVersionId=v1&afterVersionId=v2',
  response: unknown = comparison(),
) {
  return renderReleasePage({
    path: '/programs/:programId/version-comparison',
    entry: `/programs/p1/version-comparison${pair}`,
    element: <VersionComparisonPage />,
    reads: {
      '/api/programs/p1/versions': {
        versions: [
          versionRef(),
          versionRef({ id: 'v2', versionNumber: '2.0' }),
          versionRef({ id: 'd1', status: 'DRAFT' }),
        ],
      },
      [endpoint]: response,
      '/api/programs/p1/version-comparison?beforeVersionId=v1&afterVersionId=v1':
        comparison(),
    },
  });
}
describe('VersionComparisonPage', () => {
  it('does not guess a pair and never sends an incomplete comparison', async () => {
    const { reads, writes } = renderPage('');
    expect(
      await screen.findByText('Chọn hai phiên bản đã ban hành để so sánh.'),
    ).toBeInTheDocument();
    expect(reads.filter((url) => url.includes('/version-comparison'))).toEqual(
      [],
    );
    expect(writes).toEqual([]);
  });
  it('uses the URL pair, shows six groups and swaps the executed direction', async () => {
    const { router, writes } = renderPage();
    expect(await screen.findAllByText('Không thay đổi')).toHaveLength(6);
    fireEvent.click(screen.getByRole('button', { name: 'Đổi chiều so sánh' }));
    await waitFor(() =>
      expect(router.state.location.search).toBe(
        '?beforeVersionId=v2&afterVersionId=v1',
      ),
    );
    expect(writes).toEqual([]);
  });
  it('allows the identical URL pair without coercion', async () => {
    const { reads } = renderPage('?beforeVersionId=v1&afterVersionId=v1');
    expect(await screen.findAllByText('Không thay đổi')).toHaveLength(6);
    expect(reads).toContain(
      '/api/programs/p1/version-comparison?beforeVersionId=v1&afterVersionId=v1',
    );
  });
  it.each([403, 404, 409])(
    'shows backend refusal %s with retry instead of stale tables',
    async (status) => {
      renderPage(
        undefined,
        json({ message: 'Phiên bản không hợp lệ' }, status),
      );
      expect(
        await screen.findByRole('button', { name: 'Thử lại' }),
      ).toBeInTheDocument();
      expect(screen.queryByText('Không thay đổi')).not.toBeInTheDocument();
    },
  );
});
