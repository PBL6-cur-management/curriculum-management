import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from 'antd';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CREDITS_MESSAGE } from '../../../shared/forms/credits';
import { ProgramFormPage } from './ProgramFormPage';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });
const INFO = {
  id: 'v1',
  versionNumber: null,
  status: 'DRAFT',
  programName: 'Kỹ thuật máy tính',
  majorCode: '7480106',
  majorName: 'Kỹ thuật máy tính',
  semesterCount: 10,
  totalCredits: '150',
  compulsoryCredits: '140',
  electiveCredits: '10',
  updatedAt: '2026-10-19T00:00:00.000Z',
};
const PROGRAM = {
  id: 'p1',
  programCode: '1024034',
  degreeLevel: 'ENGINEER',
  status: 'ACTIVE',
  faculty: { id: 'f1', unitCode: 'KHOA_CNTT', unitName: 'Khoa CNTT' },
  programName: 'Kỹ thuật máy tính',
  currentVersion: { id: 'v1', versionNumber: null, status: 'DRAFT' },
  directors: [],
  currentVersionInfo: INFO,
  draftVersion: INFO,
  versions: [{ id: 'v1', versionNumber: null, status: 'DRAFT' }],
  clonedFrom: null,
  editPath: 'DIRECT',
  canManage: true,
  canClone: true,
  createdAt: '2026-10-19T00:00:00.000Z',
  updatedAt: '2026-10-19T00:00:00.000Z',
};

function renderForm(
  path: string,
  options: {
    program?: Record<string, unknown>;
    write?: () => Response;
  } = {},
) {
  const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
    if (init?.method === 'POST' || init?.method === 'PATCH')
      return Promise.resolve((options.write ?? (() => json(PROGRAM, 201)))());
    return Promise.resolve(json(options.program ?? PROGRAM));
  });
  vi.stubGlobal('fetch', fetchMock);
  const router = createMemoryRouter(
    [
      { path: '/programs', element: <p>Danh sách chương trình</p> },
      { path: '/programs/:programId/edit', element: <ProgramFormPage /> },
      { path: '/programs/:programId', element: <p>Tổng quan chương trình</p> },
    ],
    { initialEntries: [path] },
  );
  render(
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
        <RouterProvider router={router} />
      </App>
    </QueryClientProvider>,
  );
  return fetchMock;
}

const writes = (fetchMock: ReturnType<typeof renderForm>) =>
  fetchMock.mock.calls.filter(
    ([, init]) => init?.method === 'POST' || init?.method === 'PATCH',
  );

const EDIT_PATH = '/programs/p1/edit';

function fill(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

async function openFilled() {
  const code = await screen.findByLabelText('Mã chương trình');
  await waitFor(() => expect(code).toHaveValue('1024034'));
}

afterEach(() => vi.unstubAllGlobals());

describe('ProgramFormPage', () => {
  it('names the emptied required fields without sending a request', async () => {
    const fetchMock = renderForm(EDIT_PATH);
    await openFilled();
    fill('Tên chương trình', '');
    fill('Tổng số tín chỉ', '');
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));
    expect(
      await screen.findByText('Nhập tên chương trình.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Nhập tổng số tín chỉ.')).toBeInTheDocument();
    expect(writes(fetchMock)).toHaveLength(0);
  });

  it('refuses a malformed credit number with the range', async () => {
    const fetchMock = renderForm(EDIT_PATH);
    await openFilled();
    fill('Tổng số tín chỉ', '-1');
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));
    expect(await screen.findByText(CREDITS_MESSAGE)).toBeInTheDocument();
    expect(writes(fetchMock)).toHaveLength(0);
  });

  it('shows the gap while typing and clears it once the sums agree (KB-011)', async () => {
    const fetchMock = renderForm(EDIT_PATH);
    await openFilled();
    fill('Tín chỉ bắt buộc', '120');
    fill('Tín chỉ tự chọn', '25');
    expect(
      await screen.findByText('Chênh lệch 5 tín chỉ.'),
    ).toBeInTheDocument();
    fill('Tín chỉ tự chọn', '30');
    expect(await screen.findByText('Khớp tổng tín chỉ.')).toBeInTheDocument();
    expect(writes(fetchMock)).toHaveLength(0);
  });

  it('still sends a mismatch and shows the server refusal under the total', async () => {
    const message =
      'Tín chỉ bắt buộc cộng tín chỉ tự chọn phải bằng tổng tín chỉ (chênh lệch 5 tín chỉ).';
    const fetchMock = renderForm(EDIT_PATH, {
      write: () =>
        json(
          {
            code: 'CREDITS_MISMATCH',
            message,
            details: [{ field: 'totalCredits', constraints: ['creditsSum'] }],
          },
          400,
        ),
    });
    await openFilled();
    fill('Tín chỉ bắt buộc', '120');
    fill('Tín chỉ tự chọn', '25');
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));
    await waitFor(() => expect(writes(fetchMock)).toHaveLength(1));
    expect(await screen.findByText(message)).toBeInTheDocument();
  });

  it('fills from the Draft, disables the code and patches without it', async () => {
    const fetchMock = renderForm(EDIT_PATH);
    const code = await screen.findByLabelText('Mã chương trình');
    await waitFor(() => expect(code).toHaveValue('1024034'));
    expect(code).toBeDisabled();
    expect(screen.getByLabelText('Tổng số tín chỉ')).toHaveValue('150');
    fill('Tên chương trình', 'Tên đã sửa');
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));
    await waitFor(() => expect(writes(fetchMock)).toHaveLength(1));
    const [url, init] = writes(fetchMock)[0];
    expect(String(url)).toBe('/api/programs/p1');
    expect(init?.method).toBe('PATCH');
    const body = JSON.parse(String(init?.body));
    expect(body).not.toHaveProperty('programCode');
    expect(body).toMatchObject({
      programName: 'Tên đã sửa',
      totalCredits: '150',
      semesterCount: 10,
    });
  });

  it('sends the caller back to the overview when the edit must go through a request', async () => {
    renderForm(EDIT_PATH, {
      program: { ...PROGRAM, editPath: 'VIA_REQUEST', draftVersion: null },
    });
    expect(
      await screen.findByText('Tổng quan chương trình'),
    ).toBeInTheDocument();
  });
});
