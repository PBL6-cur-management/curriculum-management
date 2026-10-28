import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ME, conflict, detail } from '../testFixtures';
import { json, renderRequestPage } from '../testRender';
import { ChangeRequestFormPage } from './ChangeRequestFormPage';

const PROGRAM = {
  id: 'p1',
  programCode: '1024034',
  programName: 'Kỹ thuật máy tính',
};

function renderForm(entry: string, extra: Record<string, unknown> = {}) {
  return renderRequestPage({
    path: '/change-requests/new',
    entry,
    element: <ChangeRequestFormPage />,
    reads: {
      '/api/programs/p1': PROGRAM,
      '/api/programs?pageSize=20': {
        items: [PROGRAM],
        total: 1,
        page: 1,
        pageSize: 20,
      },
      '/api/change-requests/conflicts?targetType=PROGRAM&targetId=p1': [],
      ...extra,
    },
    writeResponse: () => json(detail({ id: 'r9' }), 201),
    extraRoutes: [
      {
        path: '/change-requests/:requestId/edit',
        element: <p>Bàn soạn đề xuất</p>,
      },
    ],
  });
}

const PREFILLED =
  '/change-requests/new?type=CURRICULUM&targetType=PROGRAM&targetId=p1';

async function fillHeader() {
  fireEvent.change(await screen.findByLabelText('Tiêu đề'), {
    target: { value: 'Đổi học kỳ' },
  });
  fireEvent.change(screen.getByLabelText('Lý do'), {
    target: { value: 'Cân đối tải' },
  });
}

describe('ChangeRequestFormPage', () => {
  it('fills the type and the target from the link (US-053 AC1)', async () => {
    renderForm(PREFILLED);
    expect(await screen.findByText('Khung chương trình')).toBeInTheDocument();
    expect(
      await screen.findByText('1024034 — Kỹ thuật máy tính'),
    ).toBeInTheDocument();
  });

  it('creates the request and moves to its workbench', async () => {
    const { writes } = renderForm(PREFILLED);
    await fillHeader();
    await screen.findByText('1024034 — Kỹ thuật máy tính');
    fireEvent.click(screen.getByRole('button', { name: 'Tạo đề xuất' }));
    expect(await screen.findByText('Bàn soạn đề xuất')).toBeInTheDocument();
    expect(writes[0]).toMatchObject({
      method: 'POST',
      url: '/api/change-requests',
      body: {
        requestType: 'CURRICULUM',
        targetType: 'PROGRAM',
        targetId: 'p1',
        title: 'Đổi học kỳ',
        reason: 'Cân đối tải',
        origin: 'FACULTY',
        basisDocumentNumber: null,
      },
    });
  });

  it('requires the basis number for the "Trường" origin and posts nothing without it (US-055 AC1)', async () => {
    const { writes } = renderForm(PREFILLED);
    await fillHeader();
    await screen.findByText('1024034 — Kỹ thuật máy tính');
    fireEvent.click(screen.getByLabelText('Theo yêu cầu của Trường'));
    await waitFor(() =>
      expect(
        screen
          .getByText('Số văn bản căn cứ')
          .closest('.ant-form-item-required'),
      ).not.toBeNull(),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Tạo đề xuất' }));
    expect(
      await screen.findByText(
        'Nhập số văn bản căn cứ của Trường.',
        {},
        { timeout: 3000 },
      ),
    ).toBeInTheDocument();
    expect(writes).toEqual([]);
    fireEvent.change(screen.getByLabelText('Số văn bản căn cứ'), {
      target: { value: '123/QĐ-ĐHBK' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Tạo đề xuất' }));
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0].body).toMatchObject({
      origin: 'UNIVERSITY',
      basisDocumentNumber: '123/QĐ-ĐHBK',
    });
  });

  it('offers the grading formula type to a holder of gradingFormula.edit and not to anyone else', async () => {
    renderRequestPage({
      path: '/change-requests/new',
      entry: '/change-requests/new',
      element: <ChangeRequestFormPage />,
      me: {
        ...ME,
        permissions: [
          'changeRequest.view',
          'changeRequest.create',
          'gradingFormula.edit',
        ],
      },
    });
    fireEvent.mouseDown(
      await screen.findByRole('combobox', { name: 'Loại đề xuất' }),
    );
    const grading = await screen.findByText('Công thức tính điểm');
    expect(grading.closest('.ant-select-item')).not.toHaveClass(
      'ant-select-item-option-disabled',
    );
    expect(
      screen.getByText('Nội dung đề cương').closest('.ant-select-item'),
    ).toHaveClass('ant-select-item-option-disabled');
  });

  it('offers only the types the user may edit', async () => {
    renderRequestPage({
      path: '/change-requests/new',
      entry: '/change-requests/new',
      element: <ChangeRequestFormPage />,
      me: {
        ...ME,
        permissions: [
          'changeRequest.view',
          'changeRequest.create',
          'syllabus.edit',
        ],
      },
    });
    fireEvent.mouseDown(
      await screen.findByRole('combobox', { name: 'Loại đề xuất' }),
    );
    const syllabus = await screen.findByText('Nội dung đề cương');
    expect(syllabus.closest('.ant-select-item')).not.toHaveClass(
      'ant-select-item-option-disabled',
    );
    expect(
      screen.getByText('Khung chương trình').closest('.ant-select-item'),
    ).toHaveClass('ant-select-item-option-disabled');
  });

  it('shows the conflicting request with its code, creator and status, and still allows saving (US-058 AC1)', async () => {
    renderForm(PREFILLED, {
      '/api/change-requests/conflicts?targetType=PROGRAM&targetId=p1': [
        conflict(),
      ],
    });
    expect(await screen.findByText('DX-2026-0000')).toBeInTheDocument();
    expect(screen.getByText(/Giảng viên B/)).toBeInTheDocument();
    expect(screen.getByText('Chờ Điều phối duyệt')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tạo đề xuất' })).toBeEnabled();
  });

  it('puts a server refusal about the target under the target field', async () => {
    renderRequestPage({
      path: '/change-requests/new',
      entry: PREFILLED,
      element: <ChangeRequestFormPage />,
      reads: {
        '/api/programs/p1': PROGRAM,
        '/api/programs?pageSize=20': {
          items: [PROGRAM],
          total: 1,
          page: 1,
          pageSize: 20,
        },
      },
      writeResponse: () =>
        json(
          {
            statusCode: 409,
            code: 'TARGET_NOT_RELEASED',
            message:
              'Đối tượng chưa ban hành; hãy sửa trực tiếp, không cần đề xuất.',
          },
          409,
        ),
    });
    await fillHeader();
    await screen.findByText('1024034 — Kỹ thuật máy tính');
    fireEvent.click(screen.getByRole('button', { name: 'Tạo đề xuất' }));
    expect(await screen.findByText(/hãy sửa trực tiếp/)).toBeInTheDocument();
  });
});
