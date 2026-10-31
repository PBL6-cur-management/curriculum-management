import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { App } from 'antd';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Curriculum } from '../api/curriculum';
import { curriculum as fixture, group, item } from '../testFixtures';
import { ElectiveGroupsPage } from './ElectiveGroupsPage';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

function renderPage(data: Curriculum = fixture()) {
  const writes: { method: string; url: string; body: unknown }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (init?.method && init.method !== 'GET') {
        writes.push({
          method: init.method,
          url,
          body: init.body ? JSON.parse(String(init.body)) : undefined,
        });
        return Promise.resolve(json(group()));
      }
      if (url === '/api/program-versions/v1/curriculum')
        return Promise.resolve(json(data));
      return Promise.resolve(json({}, 404));
    }),
  );
  const router = createMemoryRouter(
    [
      {
        path: '/programs/:programId/versions/:versionId/elective-groups',
        element: <ElectiveGroupsPage />,
      },
    ],
    { initialEntries: ['/programs/p1/versions/v1/elective-groups'] },
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
  return { writes };
}

afterEach(() => vi.unstubAllGlobals());

describe('ElectiveGroupsPage', () => {
  it('lists the groups with the minimum and the credits listed', async () => {
    renderPage();
    expect(
      await screen.findByRole('heading', { name: 'Nhóm tự chọn' }),
    ).toBeInTheDocument();
    const row = screen.getByText('TC1').closest('tr')!;
    expect(row).toHaveTextContent('Tự chọn chuyên ngành');
    expect(row).toHaveTextContent('6 TC');
    expect(row).toHaveTextContent('3');
    expect(
      screen.getByRole('button', { name: 'Thêm nhóm' }),
    ).toBeInTheDocument();
  });

  it('flags a group listing fewer credits than its minimum, in decimal arithmetic', async () => {
    renderPage();
    expect(await screen.findByText('Ít hơn yêu cầu')).toBeInTheDocument();
  });

  it('does not flag 2.5 + 3.5 against a minimum of 6', async () => {
    renderPage(
      fixture({
        electiveGroups: [
          group({ itemIds: ['a', 'b'], listedCredits: '6', itemCount: 2 }),
        ],
      }),
    );
    await screen.findByText('TC1');
    expect(screen.queryByText('Ít hơn yêu cầu')).not.toBeInTheDocument();
  });

  it('flags too few courses when the minimum counts courses', async () => {
    renderPage(
      fixture({
        electiveGroups: [
          group({
            minCredits: null,
            minCourses: 3,
            listedCredits: '9',
            itemCount: 2,
          }),
        ],
      }),
    );
    expect(await screen.findByText('Ít hơn yêu cầu')).toBeInTheDocument();
  });

  it('shows no action to a caller who cannot edit the structure', async () => {
    renderPage(fixture({ canEditStructure: false, editPath: null }));
    await screen.findByText('TC1');
    for (const name of ['Thêm nhóm', 'Sửa', 'Chọn học phần', 'Xóa'])
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
  });

  it('reminds how many elective rows belong to no group', async () => {
    renderPage(
      fixture({
        items: [
          item('IT301', 'Mạng', { isElective: true }),
          item('IT302', 'Hệ điều hành', { isElective: true }),
          item('MAT101', 'Giải tích 1'),
        ],
      }),
    );
    expect(
      await screen.findByText('2 học phần tự chọn chưa thuộc nhóm nào'),
    ).toBeInTheDocument();
  });

  it('offers only elective rows without a group or already in this group in the transfer', async () => {
    renderPage(
      fixture({
        items: [
          item('IT301', 'Mạng máy tính', {
            isElective: true,
            electiveGroup: { id: 'g1', groupCode: 'TC1' },
          }),
          item('IT302', 'Hệ điều hành', { isElective: true }),
          item('IT303', 'Của nhóm khác', {
            isElective: true,
            electiveGroup: { id: 'g2', groupCode: 'TC2' },
          }),
          item('MAT101', 'Giải tích 1'),
        ],
        electiveGroups: [
          group({ itemIds: ['i-IT301'], listedCredits: '3', itemCount: 1 }),
        ],
      }),
    );
    fireEvent.click(
      await screen.findByRole('button', { name: 'Chọn học phần' }),
    );
    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getByText(/IT301 — Mạng máy tính/),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(/IT302 — Hệ điều hành/),
    ).toBeInTheDocument();
    expect(within(dialog).queryByText(/IT303/)).not.toBeInTheDocument();
    expect(within(dialog).queryByText(/MAT101/)).not.toBeInTheDocument();
  });

  it('puts the chosen rows with the replacing call', async () => {
    const { writes } = renderPage(
      fixture({
        items: [item('IT302', 'Hệ điều hành', { isElective: true })],
        electiveGroups: [group()],
      }),
    );
    fireEvent.click(
      await screen.findByRole('button', { name: 'Chọn học phần' }),
    );
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByText(/IT302 — Hệ điều hành/));
    fireEvent.click(within(dialog).getByRole('button', { name: /right/i }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu' }));
    await waitFor(() =>
      expect(writes).toEqual([
        {
          method: 'PUT',
          url: '/api/elective-groups/g1/items',
          body: { itemIds: ['i-IT302'] },
        },
      ]),
    );
  });

  it('needs one minimum before the form is sent', async () => {
    const { writes } = renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Thêm nhóm' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Mã nhóm'), {
      target: { value: 'TC9' },
    });
    fireEvent.change(within(dialog).getByLabelText('Tên nhóm'), {
      target: { value: 'Nhóm 9' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu' }));
    expect(
      await within(dialog).findByText('Nhập ít nhất một yêu cầu tối thiểu.'),
    ).toBeInTheDocument();
    expect(writes).toHaveLength(0);
    fireEvent.change(within(dialog).getByLabelText('Số tín chỉ tối thiểu'), {
      target: { value: '6' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu' }));
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]).toEqual({
      method: 'POST',
      url: '/api/program-versions/v1/elective-groups',
      body: {
        groupCode: 'TC9',
        groupName: 'Nhóm 9',
        minCredits: '6',
        minCourses: null,
      },
    });
  });
});
