import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ploList, ME } from '../testFixtures';
import { json, renderOutcomePage } from '../testRender';
import { PloListPage } from './PloListPage';

const URL = '/api/program-versions/v1/plos';

function renderPage(
  data = ploList(),
  me: Record<string, unknown> = ME,
  writeResponse?: Parameters<typeof renderOutcomePage>[0]['writeResponse'],
) {
  return renderOutcomePage({
    path: '/programs/:programId/versions/:versionId/plos',
    entry: '/programs/p1/versions/v1/plos',
    element: <PloListPage />,
    reads: { [URL]: data },
    me,
    writeResponse,
  });
}

afterEach(() => vi.unstubAllGlobals());

describe('PloListPage', () => {
  it('lists the PLOs with their usage and offers editing to a direct editor', async () => {
    renderPage();
    expect(
      await screen.findByRole('heading', { name: /PLO — Kỹ thuật máy tính/ }),
    ).toBeInTheDocument();
    const row = screen.getByText('PLO1').closest('tr')!;
    expect(row).toHaveTextContent('Mô tả PLO1');
    expect(row).toHaveTextContent('3');
    expect(row).toHaveTextContent('5');
    expect(
      screen.getByRole('button', { name: 'Thêm PLO' }),
    ).toBeInTheDocument();
  });

  it('is read-only for a viewer', async () => {
    renderPage(ploList({ editPath: null, canEdit: false }));
    await screen.findByText('PLO1');
    expect(
      screen.queryByRole('button', { name: 'Thêm PLO' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Sửa' }),
    ).not.toBeInTheDocument();
  });

  it('explains that a released program changes through a request', async () => {
    renderPage(ploList({ editPath: 'VIA_REQUEST', canEdit: false }));
    expect(await screen.findByText(/đề xuất thay đổi/)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Thêm PLO' }),
    ).not.toBeInTheDocument();
  });

  it('names the cells and CLO links a delete takes with it', async () => {
    const { writes } = renderPage();
    const row = (await screen.findByText('PLO1')).closest('tr')!;
    fireEvent.click(within(row).getByRole('button', { name: 'Xóa' }));
    expect(
      await screen.findByText(
        'Xóa PLO này sẽ xóa 3 ô học phần–PLO và 5 liên kết CLO.',
      ),
    ).toBeInTheDocument();
    expect(writes).toHaveLength(0);
    fireEvent.click(
      within(
        screen.getByText('Xóa PLO1?').closest('.ant-popover')! as HTMLElement,
      ).getByRole('button', { name: 'Xóa' }),
    );
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]).toMatchObject({
      method: 'DELETE',
      url: '/api/plos/p-PLO1',
    });
  });

  it('adds a PLO and shows a duplicate code under the field', async () => {
    const { writes } = renderPage(ploList(), ME, () =>
      json(
        {
          code: 'PLO_CODE_TAKEN',
          message: 'Mã PLO đã có trong phiên bản này.',
          details: [{ field: 'ploCode', constraints: ['unique'] }],
        },
        409,
      ),
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Thêm PLO' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Mã PLO'), {
      target: { value: 'plo1' },
    });
    fireEvent.change(within(dialog).getByLabelText('Mô tả (tiếng Việt)'), {
      target: { value: 'Áp dụng kiến thức' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu' }));
    expect(
      await within(dialog).findByText('Mã PLO đã có trong phiên bản này.'),
    ).toBeInTheDocument();
    expect(writes[0]).toMatchObject({
      method: 'POST',
      url: URL,
      body: {
        ploCode: 'plo1',
        description: 'Áp dụng kiến thức',
        englishDescription: null,
        competencyGroup: null,
      },
    });
  });

  it('shows a student the list without the matrix links', async () => {
    renderPage(ploList({ editPath: null, canEdit: false }), {
      ...ME,
      roles: [{ roleCode: 'R6' }],
    });
    await screen.findByText('PLO1');
    expect(screen.queryByRole('link', { name: 'Ma trận CLO–PLO' })).toBeNull();
  });
});
