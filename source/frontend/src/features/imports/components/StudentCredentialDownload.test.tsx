import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StudentCredentialDownload } from './StudentCredentialDownload';
import { downloadStudentCredentials } from '../api/imports';
import { json, renderImport } from '../testFixtures';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
describe('student credentials', () => {
  it('uses a no-store POST and revokes its object URL even when browser download fails', async () => {
    const revoke = vi.fn();
    vi.stubGlobal(
      'URL',
      class extends URL {
        static createObjectURL = vi.fn(() => 'blob:synthetic');
        static revokeObjectURL = revoke;
      },
    );
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {
      throw new Error('download refused');
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response('synthetic bytes'));
    vi.stubGlobal('fetch', fetchMock);
    await expect(downloadStudentCredentials('a/b')).rejects.toThrow(
      'download refused',
    );
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/imports/a%2Fb/student-credentials/download',
      expect.objectContaining({
        method: 'POST',
        cache: 'no-store',
        credentials: 'same-origin',
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      }),
    );
    expect(revoke).toHaveBeenCalledWith('blob:synthetic');
  });
  it('confirms once, explains 410, refreshes status and never caches credential bytes', async () => {
    let available = true;
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        if (String(input).endsWith('/auth/me'))
          return json({
            roles: [{ roleCode: 'R1' }],
            permissions: ['data.importExcel'],
          });
        if (init?.method === 'POST') {
          available = false;
          return json({ message: 'Đã sử dụng.' }, 410);
        }
        return json({
          available,
          accountCount: available ? 1 : 0,
          expiresAt: null,
          downloadedAt: null,
        });
      },
    );
    vi.stubGlobal('fetch', fetchMock);
    const { client } = renderImport(
      <StudentCredentialDownload batchId="b1" committed />,
    );
    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Tải mật khẩu ban đầu (một lần)',
      }),
    );
    expect(
      fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST'),
    ).toHaveLength(0);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Tải tệp mật khẩu' }),
    );
    expect(
      await screen.findByText(/Tệp đã hết hạn hoặc đã được tải/),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.queryByRole('button', {
          name: 'Tải mật khẩu ban đầu (một lần)',
        }),
      ).not.toBeInTheDocument(),
    );
    expect(
      fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST'),
    ).toHaveLength(1);
    expect(
      client
        .getQueryCache()
        .getAll()
        .some((query) => query.state.data instanceof Blob),
    ).toBe(false);
  });
});
