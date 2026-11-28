import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { App } from 'antd';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Curriculum } from '../api/curriculum';
import { curriculum as fixture, item, trackFixture } from '../testFixtures';
import { ProgramTrackBar } from './ProgramTrackBar';

function renderBar(
  props: Partial<Parameters<typeof ProgramTrackBar>[0]> = {},
  data: Curriculum = fixture(),
) {
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ permissions: [], roles: [] }), {
          status: 200,
        }),
      ),
    ),
  );
  const onChange = vi.fn();
  const onAdd = vi.fn();
  const onEdit = vi.fn();
  const onBulkAssign = vi.fn();
  const onToggleIncludeCommon = vi.fn();

  render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: { queries: { retry: false } },
        })
      }
    >
      <App>
        <MemoryRouter>
          <ProgramTrackBar
            curriculum={data}
            value="ALL"
            canEdit
            onChange={onChange}
            onAdd={onAdd}
            onEdit={onEdit}
            onBulkAssign={onBulkAssign}
            onToggleIncludeCommon={onToggleIncludeCommon}
            {...props}
          />
        </MemoryRouter>
      </App>
    </QueryClientProvider>,
  );

  return { onChange, onAdd, onEdit, onBulkAssign, onToggleIncludeCommon };
}

afterEach(() => vi.unstubAllGlobals());

describe('ProgramTrackBar', () => {
  it('renders base structure badge when no tracks exist', () => {
    renderBar({}, fixture({ tracks: [] }));
    expect(screen.getByText('Cấu trúc CTĐT gốc')).toBeInTheDocument();
    expect(
      screen.getByText('Khung chung (chưa tách chuyên ngành)'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Thêm định hướng/ }),
    ).toBeInTheDocument();
  });

  it('shows compact track codes when there are more than 3 tracks to prevent overflow', () => {
    const tracks = [
      trackFixture({ id: 't1', trackCode: 'CNPM', trackName: 'Công nghệ phần mềm', itemCount: 6 }),
      trackFixture({ id: 't2', trackCode: 'HTTT', trackName: 'Hệ thống thông tin', itemCount: 5 }),
      trackFixture({ id: 't3', trackCode: 'MMT', trackName: 'Mạng máy tính', itemCount: 4 }),
      trackFixture({ id: 't4', trackCode: 'AI', trackName: 'Trí tuệ nhân tạo', itemCount: 7 }),
      trackFixture({ id: 't5', trackCode: 'ATTT', trackName: 'An toàn thông tin', itemCount: 5 }),
    ];
    renderBar({}, fixture({ tracks }));
    expect(screen.getByText('5 định hướng / chuyên ngành')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /CNPM/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ATTT/ })).toBeInTheDocument();
    // Full Vietnamese name is hidden from the compact pill text (shown in tooltip and selected info strip).
    expect(screen.queryByText(/Công nghệ phần mềm/)).not.toBeInTheDocument();
  });

  it('shows full track info strip, includeCommon toggle, and edit/delete controls when a track is selected', () => {
    const cnpm = trackFixture({
      id: 't-cnpm',
      trackCode: 'CNPM',
      trackName: 'Công nghệ phần mềm',
      englishName: 'Software Engineering',
      itemCount: 2,
    });
    const data = fixture({
      tracks: [cnpm],
      items: [
        item('MAT101', 'Giải tích 1', { track: null }),
        item('IT301', 'Mạng máy tính', {
          track: {
            id: 't-cnpm',
            trackCode: 'CNPM',
            trackName: 'Công nghệ phần mềm',
          },
        }),
      ],
    });
    const { onToggleIncludeCommon, onEdit } = renderBar(
      { value: 't-cnpm', includeCommon: true },
      data,
    );

    expect(screen.getByText(/Đang xem:/)).toBeInTheDocument();
    expect(screen.getByText('Công nghệ phần mềm')).toBeInTheDocument();
    expect(screen.getByText(/BB: 8 TC · TC: 6 TC/)).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: 'Chỉ môn chuyên ngành' }),
    );
    expect(onToggleIncludeCommon).toHaveBeenCalledWith(false);

    fireEvent.click(
      screen.getByRole('button', { name: 'Sửa định hướng CNPM' }),
    );
    expect(onEdit).toHaveBeenCalledWith(cnpm);
    expect(
      screen.getByRole('button', { name: 'Xóa định hướng CNPM' }),
    ).toBeInTheDocument();
  });
});
