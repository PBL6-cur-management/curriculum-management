import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ApiError,
  downloadFile,
  fileNameFromHeader,
  getJson,
  sendForm,
  sendJson,
  withQuery,
} from './client';

afterEach(() => vi.unstubAllGlobals());

describe('API client', () => {
  it('parses the error envelope', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            code: 'BAD_REQUEST',
            message: 'Lỗi',
            details: [{ property: 'name' }],
          }),
          { status: 400 },
        ),
      ),
    );
    await expect(getJson('/x')).rejects.toMatchObject({
      status: 400,
      code: 'BAD_REQUEST',
      message: 'Lỗi',
      details: [{ property: 'name' }],
    });
  });
  it('uses a fallback for non-JSON errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('nope', { status: 502 })),
    );
    try {
      await getJson('/x');
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).code).toBeUndefined();
      expect((error as Error).message).toContain('502');
    }
  });
  it('returns undefined on 204', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(null, { status: 204 })),
    );
    await expect(sendJson<void>('POST', '/x')).resolves.toBeUndefined();
  });
  it('sends the CSRF header on every request', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}'));
    vi.stubGlobal('fetch', fetchMock);
    await getJson('/x');
    expect(fetchMock.mock.calls[0][1].headers).toMatchObject({
      'X-Requested-With': 'XMLHttpRequest',
    });
  });
  it('returns a body for an accepted error status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('{"ok":false}', { status: 503 })),
    );
    await expect(getJson('/health', [503])).resolves.toEqual({ ok: false });
  });
});

describe('withQuery', () => {
  it('writes an array as a repeated key', () => {
    expect(withQuery('/courses', { status: ['ACTIVE', 'DISCONTINUED'] })).toBe(
      '/courses?status=ACTIVE&status=DISCONTINUED',
    );
  });

  it('keeps scalars as they were and skips empty values', () => {
    expect(
      withQuery('/courses', {
        q: 'it',
        page: 2,
        foreign: false,
        empty: '',
        none: undefined,
        nothing: null,
        statuses: [],
      }),
    ).toBe('/courses?q=it&page=2&foreign=false');
  });

  it('returns the bare path when there is nothing to send', () => {
    expect(withQuery('/courses', { status: [] })).toBe('/courses');
  });
});

describe('file helpers', () => {
  it('propagates an expired upload session instead of returning a batch', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            code: 'UNAUTHORIZED',
            message: 'Phiên đăng nhập đã hết hạn.',
          }),
          { status: 401 },
        ),
      ),
    );
    await expect(sendForm('/imports', new FormData())).rejects.toMatchObject({
      status: 401,
      code: 'UNAUTHORIZED',
    });
  });
  it('sends a form without a Content-Type of its own', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"id":"a"}'));
    vi.stubGlobal('fetch', fetchMock);
    const form = new FormData();
    form.append('file', new Blob(['x']), 'a.pdf');

    await expect(sendForm('/up', form)).resolves.toEqual({ id: 'a' });

    const init = fetchMock.mock.calls[0][1];
    expect(init.method).toBe('POST');
    expect(init.body).toBe(form);
    expect(init.headers).not.toHaveProperty('Content-Type');
    expect(init.headers).toMatchObject({
      'X-Requested-With': 'XMLHttpRequest',
    });
  });

  it('reads the UTF-8 name from Content-Disposition', () => {
    const header = `attachment; filename="De cuong.pdf"; filename*=UTF-8''${encodeURIComponent('Đề cương.pdf')}`;

    expect(fileNameFromHeader(header, 'x.pdf')).toBe('Đề cương.pdf');
    expect(fileNameFromHeader(null, 'x.pdf')).toBe('x.pdf');
    expect(
      fileNameFromHeader("attachment; filename*=UTF-8''%E0%A4%A", 'x'),
    ).toBe('x');
  });

  it('downloads through a link named by the server', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('pdf', {
          headers: {
            'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent('Đề cương.pdf')}`,
          },
        }),
      ),
    );
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function (this: HTMLAnchorElement) {
        expect(this.download).toBe('Đề cương.pdf');
      });

    await downloadFile('/file', 'fallback.pdf');

    expect(click).toHaveBeenCalledOnce();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:x');
    click.mockRestore();
  });

  it('throws the API error instead of saving an error page', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('{"code":"FILE_MISSING","message":"Mất tệp"}', {
          status: 404,
        }),
      ),
    );

    await expect(downloadFile('/file', 'x.pdf')).rejects.toMatchObject({
      status: 404,
      code: 'FILE_MISSING',
    });
  });
});
