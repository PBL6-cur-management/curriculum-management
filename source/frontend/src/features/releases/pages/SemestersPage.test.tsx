import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { json, renderReleasePage, SEMESTER } from '../testRender';
import { SemestersPage } from './SemestersPage';

const COHORT = { id: 'k1', cohortCode: 'K2026', intakeYear: 2026 };

function renderPage(
  writeResponse?: Parameters<typeof renderReleasePage>[0]['writeResponse'],
  semesters: unknown = [
    SEMESTER,
    { ...SEMESTER, id: 's2', semesterCode: 'CHUA', startDate: null },
  ],
) {
  return renderReleasePage({
    path: '/semesters',
    entry: '/semesters',
    element: <SemestersPage />,
    permissions: ['semester.manage'],
    reads: { '/api/semesters': semesters, '/api/cohorts': [COHORT] },
    writeResponse,
  });
}

afterEach(() => vi.unstubAllGlobals());

describe('SemestersPage (MH-10)', () => {
  it('links assignment management only with the assignment permission', async () => {
    renderReleasePage({
      path: '/semesters',
      entry: '/semesters',
      element: <SemestersPage />,
      permissions: ['semester.manage', 'version.assignCohort'],
      reads: { '/api/semesters': [], '/api/cohorts': [] },
    });
    expect(
      await screen.findByRole('link', { name: 'Gán phiên bản cho khóa' }),
    ).toHaveAttribute('href', '/cohort-versions');
  });
  it('does not expose assignment navigation to a semester manager without assignment permission', async () => {
    renderPage();
    await screen.findByText('K2026');
    expect(
      screen.queryByRole('link', { name: 'Gán phiên bản cho khóa' }),
    ).not.toBeInTheDocument();
  });
  it('lists semesters with their start dates (or none yet) and the cohorts', async () => {
    renderPage();

    expect(await screen.findByText('2026-2027-2')).toBeInTheDocument();
    expect(screen.getByText('18/01/2027')).toBeInTheDocument();
    expect(screen.getByText('Chưa có')).toBeInTheDocument();
    expect(screen.getByText('K2026')).toBeInTheDocument();
  });

  it('adds a semester with the date as a calendar day, not a timestamp', async () => {
    const { writes } = renderPage(() => json({ ...SEMESTER, id: 's3' }, 201));

    fireEvent.click(await screen.findByRole('button', { name: /Thêm học kỳ/ }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Mã học kỳ'), {
      target: { value: '2027-2028-1' },
    });
    fireEvent.change(within(dialog).getByLabelText('Năm học'), {
      target: { value: '2027-2028' },
    });
    const date = within(dialog).getByLabelText('Ngày bắt đầu');
    fireEvent.mouseDown(date);
    fireEvent.change(date, { target: { value: '06/09/2027' } });
    fireEvent.keyDown(date, { key: 'Enter' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu' }));

    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]).toEqual({
      method: 'POST',
      url: '/api/semesters',
      body: {
        semesterCode: '2027-2028-1',
        academicYear: '2027-2028',
        termInYear: 1,
        startDate: '2027-09-06',
      },
    });
  });

  it('puts a duplicate code under the field', async () => {
    renderPage(() =>
      json(
        {
          code: 'SEMESTER_EXISTS',
          message: 'Mã học kỳ hoặc cặp năm học - học kỳ đã tồn tại.',
        },
        409,
      ),
    );

    fireEvent.click(await screen.findByRole('button', { name: /Thêm học kỳ/ }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Mã học kỳ'), {
      target: { value: 'X' },
    });
    fireEvent.change(within(dialog).getByLabelText('Năm học'), {
      target: { value: 'Y' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu' }));

    expect(
      await within(dialog).findByText(
        'Mã học kỳ hoặc cặp năm học - học kỳ đã tồn tại.',
      ),
    ).toBeInTheDocument();
  });

  it('shows a refused date change under the date (the version standing on it cannot move)', async () => {
    renderPage(() =>
      json(
        {
          code: 'SEMESTER_IN_USE',
          message:
            'Không đổi được ngày bắt đầu của học kỳ đã có phiên bản ban hành hiệu lực.',
        },
        409,
      ),
    );

    fireEvent.click(
      await screen.findByRole('button', { name: 'Sửa học kỳ 2026-2027-2' }),
    );
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu' }));

    expect(
      await within(dialog).findByText(/Không đổi được ngày bắt đầu/),
    ).toBeInTheDocument();
  });

  it('adds a cohort', async () => {
    const { writes } = renderPage(() =>
      json({ id: 'k2', cohortCode: 'K2027', intakeYear: 2027 }, 201),
    );

    fireEvent.click(await screen.findByRole('button', { name: /Thêm khóa/ }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Mã khóa'), {
      target: { value: 'K2027' },
    });
    fireEvent.change(within(dialog).getByLabelText('Năm tuyển sinh'), {
      target: { value: '2027' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu' }));

    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]).toMatchObject({
      url: '/api/cohorts',
      body: { cohortCode: 'K2027', intakeYear: 2027 },
    });
  });

  it('offers no delete and no reassignment (F-16)', async () => {
    renderPage();

    await screen.findByText('2026-2027-2');
    expect(screen.queryByRole('button', { name: /Xóa/ })).toBeNull();
    expect(screen.queryByText(/Chuyển khóa/)).toBeNull();
  });
});
