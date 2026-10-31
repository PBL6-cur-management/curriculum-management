import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  json,
  renderReleasePage,
  versionDetail,
  type Write,
} from '../testRender';
import { VersionDetailPage } from './VersionDetailPage';

const URL = '/api/programs/p1/versions/v1';

function renderPage(
  detail: ReturnType<typeof versionDetail>,
  permissions = ['program.view', 'outcome.view'],
  writeResponse?: (write: Write) => Response | undefined,
) {
  return renderReleasePage({
    path: '/programs/:programId/versions/:versionId',
    entry: '/programs/p1/versions/v1',
    element: <VersionDetailPage />,
    permissions,
    reads: { [URL]: detail },
    writeResponse,
    extraRoutes: [
      {
        path: '/programs/:programId/versions/:versionId/corrections/:correctionId',
        element: <p>Trang đính chính</p>,
      },
    ],
  });
}

afterEach(() => vi.unstubAllGlobals());

describe('VersionDetailPage (MH-47)', () => {
  it('opens elective groups in the same historical version context without inline editing', async () => {
    renderPage(versionDetail({ status: 'HISTORICAL' }));
    expect(
      await screen.findByRole('link', { name: 'Nhóm tự chọn' }),
    ).toHaveAttribute('href', '/programs/p1/versions/v1/elective-groups');
    expect(
      screen.queryByRole('button', { name: 'Lưu' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Sửa thông tin' }),
    ).not.toBeInTheDocument();
  });
  it('shows the name and credits the version was released with and links each syllabus to the revision it pins (US-079 AC3)', async () => {
    renderPage(versionDetail());

    expect(
      await screen.findByText('Nhập môn lập trình (tên khi ban hành)'),
    ).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /Bản 1/ });
    expect(link).toHaveAttribute('href', '/courses/c1/syllabus?versionId=v1');
    expect(link).toHaveTextContent('đã thay bằng bản mới');
  });

  it('shows the decision, the semester, the cohorts and who released it', async () => {
    renderPage(versionDetail());

    expect(await screen.findByText('QĐ-100/2026')).toBeInTheDocument();
    expect(screen.getByText('01/09/2026')).toBeInTheDocument();
    expect(screen.getByText('2026-2027-2 · từ')).toBeInTheDocument();
    expect(screen.getByText('18/01/2027')).toBeInTheDocument();
    expect(screen.queryByText('Ngày ước lượng')).not.toBeInTheDocument();
    expect(screen.getByText('K2026')).toBeInTheDocument();
    expect(screen.getByText(/Phòng Đào tạo —/)).toBeInTheDocument();
  });

  it('links the request a version came from to its approval history (G-6)', async () => {
    renderPage(
      versionDetail({
        originRequest: { id: 'r9', requestCode: 'DX-2026-0009' },
      }),
    );

    expect(
      await screen.findByRole('link', { name: 'DX-2026-0009' }),
    ).toHaveAttribute('href', '/change-requests/r9');
  });

  it('names a correction and what it corrects, and the one that corrected the version', async () => {
    renderPage(
      versionDetail({
        status: 'HISTORICAL',
        correctedBy: { id: 'v2', versionNumber: '1.1' },
        correctionOf: { id: 'v0', versionNumber: '0.9' },
        correctionReason: 'Sai mã học phần',
      }),
    );

    expect(
      await screen.findByText('Đã được đính chính bởi'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '1.1' })).toHaveAttribute(
      'href',
      '/programs/p1/versions/v2',
    );
    expect(screen.getByText(/Sai mã học phần/)).toBeInTheDocument();
  });

  it('offers no editing at all to a reader, and no correction either', async () => {
    renderPage(versionDetail({ canCorrect: false }));

    await screen.findByText('QĐ-100/2026');
    expect(screen.queryByRole('button', { name: 'Đính chính' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Sửa|Thêm|Xóa/ })).toBeNull();
  });

  it('opens a correction once and moves to its page', async () => {
    const { writes } = renderPage(
      versionDetail({ canCorrect: true }),
      ['program.view'],
      () =>
        json(
          versionDetail({ id: 'd1', status: 'DRAFT', isCorrectionDraft: true }),
          201,
        ),
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Đính chính' }));

    expect(await screen.findByText('Trang đính chính')).toBeInTheDocument();
    expect(writes).toEqual([
      { method: 'POST', url: `${URL}/corrections`, body: undefined },
    ]);
  });

  it('continues an open correction instead of offering a second one', async () => {
    renderPage(
      versionDetail({
        canCorrect: true,
        openCorrection: { id: 'd1', versionNumber: null },
      }),
    );

    expect(
      await screen.findByRole('link', {
        name: 'Tiếp tục bản đính chính đang soạn',
      }),
    ).toHaveAttribute('href', '/programs/p1/versions/v1/corrections/d1');
    expect(screen.queryByRole('button', { name: 'Đính chính' })).toBeNull();
  });

  it('hides the outcome links from someone without outcome.view', async () => {
    renderPage(versionDetail(), ['program.view']);

    await screen.findByText('QĐ-100/2026');
    expect(screen.queryByRole('link', { name: 'PLO' })).toBeNull();
    await waitFor(() =>
      expect(
        screen.getByRole('link', { name: 'Khung chương trình' }),
      ).toBeInTheDocument(),
    );
  });
});
