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

async function chooseKind(label = 'Đề cương đã ký') {
  fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Loại tài liệu' }));
  fireEvent.click(
    await screen.findByText(label, {
      selector: '.ant-select-item-option-content',
    }),
  );
  // Form.useWatch reports the choice on a later render, so the drop zone unlocks asynchronously.
  await waitFor(() =>
    expect(document.querySelector('input[type="file"]')).not.toBeDisabled(),
  );
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
      screen.getByText('Nhận tệp PDF, Word, Excel, Ảnh; tối đa 50 MB mỗi tệp.'),
    ).toBeInTheDocument();
  });

  it('requires a material kind before posting a small PDF', async () => {
    const { fetchMock, container } = renderPanel();

    expect(screen.getByRole('combobox', { name: 'Loại tài liệu' })).toHaveValue(
      '',
    );
    expect(container.querySelector('input[type="file"]')).toBeDisabled();
    drop(container, fileOfSize('no-kind.pdf', 1024));
    expect(fetchMock).not.toHaveBeenCalled();
    await chooseKind();
    expect(container.querySelector('input[type="file"]')).not.toBeDisabled();

    drop(container, fileOfSize('Đề cương ký.pdf', 1024));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe('/api/syllabi/s1/attachments');
    expect(init.method).toBe('POST');
    expect((init.body as FormData).get('file')).toBeInstanceOf(File);
    expect((init.body as FormData).get('materialKind')).toBe('SIGNED_SYLLABUS');
    expect(await screen.findByText('Đã đính kèm tệp.')).toBeInTheDocument();
  });

  it('refuses a file over the limit before any request (US-041 AC2)', async () => {
    const { fetchMock, container } = renderPanel();
    await chooseKind();

    drop(container, fileOfSize('big.pdf', 51 * MB));

    expect(
      await screen.findByText(/Không nhận tệp "big.pdf"/),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuses a type that is not accepted before any request', async () => {
    const { fetchMock, container } = renderPanel();
    await chooseKind();

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
    await chooseKind();

    drop(container, fileOfSize('a.pdf', 1024));

    expect(
      await screen.findByText(/Tệp quá lớn\. Nhận tệp.*50 MB/),
    ).toBeInTheDocument();
  });

  it('groups attachments in material order with counts and hides empty groups', () => {
    renderPanel(
      syllabus({
        attachments: [
          attachment({
            id: 'other',
            fileName: 'Khác.pdf',
            materialKind: 'OTHER',
          }),
          attachment({
            id: 'slides',
            fileName: 'Slide.pdf',
            materialKind: 'LECTURE_SLIDES',
          }),
          attachment({ id: 'signed', materialKind: 'SIGNED_SYLLABUS' }),
          attachment({
            id: 'book1',
            fileName: 'Sách 1.pdf',
            materialKind: 'TEXTBOOK',
          }),
          attachment({
            id: 'book2',
            fileName: 'Sách 2.pdf',
            materialKind: 'TEXTBOOK',
          }),
        ],
      }),
    );
    expect(
      screen
        .getAllByRole('heading', { level: 5 })
        .map((heading) => heading.textContent),
    ).toEqual([
      'Đề cương đã ký (1)',
      'Giáo trình (2)',
      'Slide bài giảng (1)',
      'Tài liệu khác (1)',
    ]);
  });

  it('hides empty material groups', () => {
    renderPanel(
      syllabus({ attachments: [attachment({ materialKind: 'TEXTBOOK' })] }),
    );
    expect(
      screen
        .getAllByRole('heading', { level: 5 })
        .map((heading) => heading.textContent),
    ).toEqual(['Giáo trình (1)']);
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
