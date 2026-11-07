import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FinalApprovalPreview } from '../api/changeRequests';
import { COURSE_CHANGE_NOTICE } from '../constants/courseChangeNotice';
import { renderRequestPage } from '../testRender';
import { FinalApprovalPage } from './FinalApprovalPage';

const PREVIEW_URL = '/api/change-requests/r1/final-approval';
const SEMESTER = {
  id: 's1',
  semesterCode: '2026-2027-2',
  academicYear: '2026-2027',
  termInYear: 2,
  startDate: '2027-01-18',
};

const preview = (
  patch: Partial<FinalApprovalPreview> = {},
): FinalApprovalPreview => ({
  requestId: 'r1',
  requestCode: 'DX-2026-0001',
  requestType: 'SYLLABUS_CONTENT',
  kind: 'SYLLABUS',
  stale: false,
  affectedPrograms: [],
  copyIssues: [],
  authoredLabels: [],
  canAssignCohorts: false,
  canAllowPastSemester: false,
  ...patch,
});

function renderPage(
  data: FinalApprovalPreview | null,
  writeResponse?: Parameters<typeof renderRequestPage>[0]['writeResponse'],
) {
  return renderRequestPage({
    path: '/change-requests/:requestId/final-approval',
    entry: '/change-requests/r1/final-approval',
    element: <FinalApprovalPage />,
    reads: {
      ...(data ? { [PREVIEW_URL]: data } : {}),
      '/api/semesters': [SEMESTER],
    },
    writeResponse,
    extraRoutes: [
      { path: '/change-requests/:requestId', element: <p>Chi tiết đề xuất</p> },
    ],
  });
}

afterEach(() => vi.unstubAllGlobals());

describe('FinalApprovalPage', () => {
  it('warns that released versions keep their snapshot for a course relation request', async () => {
    renderPage(preview({ requestType: 'COURSE_RELATION', kind: 'AUTHORED' }));
    expect(await screen.findByText(COURSE_CHANGE_NOTICE)).toBeInTheDocument();
  });

  it('shows no snapshot warning for a curriculum request', async () => {
    renderPage(preview({ requestType: 'CURRICULUM', kind: 'PROGRAM_VERSION' }));
    await screen.findByRole('heading', { name: 'Phê duyệt cuối và ban hành' });
    expect(screen.queryByText(COURSE_CHANGE_NOTICE)).toBeNull();
  });

  it('links back to the request above the page title', async () => {
    renderPage(preview());
    const back = await screen.findByRole('link', {
      name: 'Đề xuất DX-2026-0001',
    });
    expect(back).toHaveAttribute('href', '/change-requests/r1');
    expect(
      screen.getByRole('heading', { name: 'Phê duyệt cuối và ban hành' }),
    ).toBeInTheDocument();
  });

  it('sends the decision after the confirmation and returns to the request (US-072)', async () => {
    const { writes } = renderPage(preview());
    fireEvent.change(await screen.findByLabelText('Số quyết định'), {
      target: { value: 'QĐ-123/ĐHBK' },
    });
    fireEvent.mouseDown(screen.getByLabelText('Học kỳ hiệu lực'));
    fireEvent.click(await screen.findByText('2026-2027-2 · 2027-01-18'));
    const date = screen.getByLabelText('Ngày ký');
    fireEvent.mouseDown(date);
    fireEvent.change(date, { target: { value: '01/09/2026' } });
    fireEvent.keyDown(date, { key: 'Enter' });
    fireEvent.click(screen.getByRole('button', { name: 'Phê duyệt cuối' }));

    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getByText('Chấp thuận và ban hành?'),
    ).toBeInTheDocument();
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Phê duyệt cuối' }),
    );
    await screen.findByText('Chi tiết đề xuất');
    expect(writes).toHaveLength(1);
    expect(writes[0].url).toBe('/api/change-requests/r1/final-approve');
    expect(writes[0].body).toMatchObject({
      decisionNumber: 'QĐ-123/ĐHBK',
      signedDate: '2026-09-01',
      effectiveSemesterId: 's1',
    });
  });

  it('cannot be approved while the base has moved', async () => {
    renderPage(preview({ stale: true }));
    expect(
      await screen.findByRole('button', { name: 'Phê duyệt cuối' }),
    ).toBeDisabled();
  });

  it("shows the server's reason and a way back when the preview cannot load", async () => {
    renderPage(null);
    // The stub answers an unknown read with 404 { message: 'Not found' }.
    expect(await screen.findByText('Not found')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('link', { name: 'Về đề xuất' })).toHaveAttribute(
        'href',
        '/change-requests/r1',
      ),
    );
  });
});
