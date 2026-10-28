import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from 'antd';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { attachment, RULES, syllabus } from '../testFixtures';
import type { Syllabus } from '../api/syllabi';
import { AttachmentPanel } from './AttachmentPanel';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });
const MB = 1024 * 1024;

function renderPanel(
  current: Syllabus = syllabus(),
  respond: () => Response = () => json(attachment(), 201),
) {
  const fetchMock = vi.fn(() => Promise.resolve(respond()));
  vi.stubGlobal('fetch', fetchMock);
  const { container } = render(
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
        <AttachmentPanel
          courseId="c1"
          syllabus={current}
          attachmentRules={RULES}
          canEditClos
          canEditContent
          canEditGradingFormula={false}
        />
      </App>
    </QueryClientProvider>,
  );
  return { fetchMock, container };
}

function drop(container: HTMLElement, file: File) {
  const input = container.querySelector('input[type="file"]')!;
  fireEvent.change(input, { target: { files: [file] } });
}

const fileOfSize = (name: string, size: number) => {
  const file = new File(['x'], name, { type: 'application/octet-stream' });
  Object.defineProperty(file, 'size', { value: size });
  return file;
};

afterEach(() => vi.unstubAllGlobals());

describe('AttachmentPanel', () => {
  it('states the accepted types and the size limit', () => {
    renderPanel();
    expect(
      screen.getByText('Nhận tệp PDF, Word, Excel, Ảnh; tối đa 20 MB mỗi tệp.'),
    ).toBeInTheDocument();
  });

  it('posts a small PDF as the form field "file"', async () => {
    const { fetchMock, container } = renderPanel();

    drop(container, fileOfSize('Đề cương ký.pdf', 1024));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe('/api/syllabi/s1/attachments');
    expect(init.method).toBe('POST');
    expect((init.body as FormData).get('file')).toBeInstanceOf(File);
    expect(await screen.findByText('Đã đính kèm tệp.')).toBeInTheDocument();
  });

  it('refuses a file over the limit before any request (US-041 AC2)', async () => {
    const { fetchMock, container } = renderPanel();

    drop(container, fileOfSize('big.pdf', 21 * MB));

    expect(
      await screen.findByText(/Không nhận tệp "big.pdf"/),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuses a type that is not accepted before any request', async () => {
    const { fetchMock, container } = renderPanel();

    drop(container, fileOfSize('x.exe', 10));

    expect(
      await screen.findByText(/Không nhận tệp "x.exe". Nhận tệp PDF, Word/),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('names the limit when the server answers 413', async () => {
    const { container } = renderPanel(syllabus(), () =>
      json({ code: 'PAYLOAD_TOO_LARGE', message: 'Tệp quá lớn.' }, 413),
    );

    drop(container, fileOfSize('a.pdf', 1024));

    expect(
      await screen.findByText(/Tệp quá lớn\. Nhận tệp.*20 MB/),
    ).toBeInTheDocument();
  });

  it('offers removal only on the rows the caller may delete (US-041 AC3)', () => {
    renderPanel(
      syllabus({
        attachments: [
          attachment({ id: 'a1', fileName: 'của tôi.pdf', canDelete: true }),
          attachment({
            id: 'a2',
            fileName: 'của người khác.pdf',
            canDelete: false,
          }),
        ],
      }),
    );
    expect(
      screen.getByRole('button', { name: 'Gỡ tệp của tôi.pdf' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Gỡ tệp của người khác.pdf' }),
    ).not.toBeInTheDocument();
  });
});
