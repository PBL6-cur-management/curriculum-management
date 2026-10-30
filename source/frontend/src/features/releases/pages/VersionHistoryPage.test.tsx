import { fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { comparison, renderReleasePage, versionRef } from '../testRender';
import { VersionComparisonPage } from './VersionComparisonPage';
import { VersionHistoryPage } from './VersionHistoryPage';

function renderPage(
  versions: ReturnType<typeof versionRef>[],
  permissions = ['program.view'],
) {
  return renderReleasePage({
    path: '/programs/:programId/versions',
    entry: '/programs/p1/versions',
    element: <VersionHistoryPage />,
    permissions,
    reads: {
      '/api/programs/p1/versions': { versions },
      '/api/programs/p1/version-comparison?beforeVersionId=v1&afterVersionId=v2':
        comparison(),
    },
    extraRoutes: [
      {
        path: '/programs/:programId/version-comparison',
        element: <VersionComparisonPage />,
      },
    ],
  });
}

afterEach(() => vi.unstubAllGlobals());

describe('VersionHistoryPage (MH-46)', () => {
  it('navigates a selected history pair to the comparison and back without writes', async () => {
    const { router, writes } = renderPage(
      [versionRef(), versionRef({ id: 'v2', versionNumber: '2.0' })],
      ['program.view', 'version.compare'],
    );
    await screen.findByRole('button', { name: 'So sánh hai phiên bản' });
    fireEvent.click(screen.getByLabelText('Chọn phiên bản 1.0'));
    fireEvent.click(screen.getByLabelText('Chọn phiên bản 2.0'));
    fireEvent.click(
      screen.getByRole('button', { name: 'So sánh hai phiên bản' }),
    );
    expect(await screen.findAllByText('Không thay đổi')).toHaveLength(6);
    expect(router.state.location.search).toBe(
      '?beforeVersionId=v1&afterVersionId=v2',
    );
    fireEvent.click(screen.getByRole('link', { name: 'Lịch sử phiên bản' }));
    await screen.findByRole('heading', { name: 'Lịch sử phiên bản' });
    expect(router.state.location.pathname).toBe('/programs/p1/versions');
    expect(writes).toEqual([]);
  });
  it('requires exactly two issued selections and never displaces them with a third or Draft', async () => {
    renderPage(
      [
        versionRef(),
        versionRef({ id: 'v2', versionNumber: '2.0' }),
        versionRef({ id: 'v3', versionNumber: '3.0' }),
        versionRef({ id: 'd1', versionNumber: null, status: 'DRAFT' }),
      ],
      ['program.view', 'version.compare'],
    );
    const button = await screen.findByRole('button', {
      name: 'So sánh hai phiên bản',
    });
    expect(button).toBeDisabled();
    fireEvent.click(screen.getByLabelText('Chọn phiên bản 1.0'));
    fireEvent.click(screen.getByLabelText('Chọn phiên bản 2.0'));
    expect(button).toBeEnabled();
    expect(screen.getByLabelText('Chọn phiên bản 3.0')).toBeDisabled();
    expect(screen.getByLabelText('Chọn phiên bản Nháp')).toBeDisabled();
  });
  it('hides comparison selection without permission', async () => {
    renderPage([versionRef()]);
    await screen.findByRole('link', { name: '1.0' });
    expect(
      screen.queryByRole('button', { name: 'So sánh hai phiên bản' }),
    ).not.toBeInTheDocument();
  });
  it('lists each version with its decision, semester, cohorts and origin request, newest first as served', async () => {
    renderPage([
      versionRef({
        id: 'v2',
        versionNumber: '2.0',
        status: 'PENDING',
        originRequest: { id: 'r1', requestCode: 'DX-2026-0001' },
      }),
      versionRef({
        id: 'v1',
        versionNumber: '1.0',
        status: 'HISTORICAL',
        correctedBy: { id: 'v3', versionNumber: '1.1' },
      }),
    ]);

    expect(await screen.findByText('Chờ hiệu lực')).toBeInTheDocument();
    expect(screen.getByText('Lịch sử')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'DX-2026-0001' })).toHaveAttribute(
      'href',
      '/change-requests/r1',
    );
    expect(screen.getByText('Đã được đính chính bởi 1.1')).toBeInTheDocument();
    expect(screen.getAllByText('QĐ-100/2026')).toHaveLength(2);
    const rows = screen.getAllByRole('row').map((row) => row.textContent);
    expect(rows[1]).toContain('2.0');
    expect(rows[2]).toContain('1.0');
  });

  it('sends an issued version to its read-only detail and the Draft to the curriculum it is built in', async () => {
    renderPage([
      versionRef({ id: 'v1', versionNumber: '1.0' }),
      versionRef({
        id: 'd1',
        versionNumber: null,
        status: 'DRAFT',
        decisionNumber: null,
        signedDate: null,
        effectiveSemester: null,
        cohorts: [],
      }),
    ]);

    expect(await screen.findByRole('link', { name: '1.0' })).toHaveAttribute(
      'href',
      '/programs/p1/versions/v1',
    );
    expect(screen.getByRole('link', { name: 'Nháp' })).toHaveAttribute(
      'href',
      '/programs/p1/versions/d1/curriculum',
    );
  });

  it('says so when a program has no version', async () => {
    renderPage([]);

    expect(
      await screen.findByText('Chương trình chưa có phiên bản nào.'),
    ).toBeInTheDocument();
  });
});
