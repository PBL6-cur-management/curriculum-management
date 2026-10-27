import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  COHORT,
  SEMESTER,
  cohortSchedule,
  json,
  renderReleasePage,
  selectReleaseOption,
  versionRef,
} from '../testRender';
import { CohortVersionAssignmentForm } from './CohortVersionAssignmentForm';

afterEach(() => vi.unstubAllGlobals());
function renderForm({ edit = false, stale = false, refused = false } = {}) {
  const saved = vi.fn();
  function Harness() {
    const [revision, setRevision] = useState('a'.repeat(64));
    return (
      <>
        <button onClick={() => setRevision('b'.repeat(64))}>
          Đổi revision nền
        </button>
        <CohortVersionAssignmentForm
          assignments={cohortSchedule({
            revision,
            ...(edit ? {} : { assignments: [] }),
          })}
          versions={[
            versionRef({ id: 'v2', versionNumber: '2.0' }),
            versionRef({ id: 'draft', status: 'DRAFT' }),
          ]}
          assignmentId={edit ? 'a1' : undefined}
          initialCohortId="k1"
          onCancel={vi.fn()}
          onSaved={saved}
        />
      </>
    );
  }
  const result = renderReleasePage({
    path: '/',
    entry: '/',
    element: <Harness />,
    reads: {
      '/api/cohorts': [COHORT],
      '/api/semesters': [
        SEMESTER,
        {
          ...SEMESTER,
          id: 's2',
          semesterCode: 'NEXT',
          startDate: '2027-06-01',
        },
        {
          ...SEMESTER,
          id: 'unknown',
          semesterCode: 'UNKNOWN',
          startDate: null,
        },
      ],
    },
    writeResponse: () =>
      refused
        ? json(
            {
              code: 'COHORT_VERSION_START_CONFLICT',
              message: 'Mốc học kỳ bị trùng.',
            },
            409,
          )
        : stale
          ? json(
              { code: 'ASSIGNMENT_STATE_CHANGED', message: 'Đã thay đổi' },
              409,
            )
          : json(cohortSchedule()),
  });
  return { ...result, saved };
}
async function createConfirmation() {
  await selectReleaseOption('Phiên bản ban hành', '2.0 · QĐ-100/2026');
  await selectReleaseOption('Từ học kỳ', '2026-2027-2 · 2027-01-18');
  fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục xác nhận' }));
  const title = await screen.findByText('Xác nhận gán phiên bản', {
    selector: '.ant-modal-confirm-title',
  });
  return title.closest<HTMLElement>('[role=dialog]')!;
}
describe('CohortVersionAssignmentForm', () => {
  it('keeps the editable form and choices after a non-stale server refusal', async () => {
    const { writes, saved } = renderForm({ refused: true });
    const dialog = await createConfirmation();
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Xác nhận gán phiên bản' }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Tiếp tục xác nhận' }),
      ).toBeEnabled(),
    );
    expect(
      screen.getByLabelText('Phiên bản ban hành').closest('.ant-select'),
    ).toHaveTextContent('2.0 · QĐ-100/2026');
    expect(screen.getAllByText('Mốc học kỳ bị trùng.').length).toBeGreaterThan(
      0,
    );
    expect(writes).toHaveLength(1);
    expect(saved).not.toHaveBeenCalled();
  });
  it('requires explicit version and semester; cancellation sends no request', async () => {
    const { writes } = renderForm();
    fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục xác nhận' }));
    expect(
      await screen.findByText('Chọn phiên bản đã ban hành.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Chọn học kỳ có ngày bắt đầu.'),
    ).toBeInTheDocument();
    const dialog = await createConfirmation();
    expect(within(dialog).getByText(/Khóa: K2026/)).toBeInTheDocument();
    expect(
      within(dialog).getByText(/kết quả tra cứu.*có thể thay đổi/),
    ).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Hủy' }));
    expect(writes).toEqual([]);
  });
  it('POSTs only selected cohorts and the captured revision after confirmation', async () => {
    const { writes, saved } = renderForm();
    const dialog = await createConfirmation();
    expect(writes).toEqual([]);
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Xác nhận gán phiên bản' }),
    );
    await waitFor(() => expect(saved).toHaveBeenCalledOnce());
    expect(writes).toEqual([
      {
        method: 'POST',
        url: '/api/programs/p1/cohort-versions',
        body: {
          cohortIds: ['k1'],
          programVersionId: 'v2',
          fromSemesterId: 's1',
          expectedRevision: 'a'.repeat(64),
        },
      },
    ]);
  });
  it('PATCHes only the starting semester and revision, keeping pair identity read-only', async () => {
    const { writes, saved } = renderForm({ edit: true });
    expect(
      screen.queryByLabelText('Phiên bản ban hành'),
    ).not.toBeInTheDocument();
    await selectReleaseOption('Từ học kỳ', 'NEXT · 2027-06-01');
    fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục xác nhận' }));
    const title = await screen.findByText('Xác nhận sửa học kỳ áp dụng', {
      selector: '.ant-modal-confirm-title',
    });
    const dialog = title.closest<HTMLElement>('[role=dialog]')!;
    fireEvent.click(
      within(dialog).getByRole('button', {
        name: 'Xác nhận sửa học kỳ áp dụng',
      }),
    );
    await waitFor(() => expect(saved).toHaveBeenCalledOnce());
    expect(writes[0]).toEqual({
      method: 'PATCH',
      url: '/api/programs/p1/cohort-versions/a1',
      body: { fromSemesterId: 's2', expectedRevision: 'a'.repeat(64) },
    });
  });
  it('closes a confirmation if a background revision changes without submitting', async () => {
    const { writes } = renderForm();
    const dialog = await createConfirmation();
    fireEvent.click(screen.getByRole('button', { name: 'Đổi revision nền' }));
    await waitFor(() => expect(dialog).not.toBeVisible());
    expect(
      screen.getByText(/Lịch gán hoặc lịch học kỳ đã thay đổi/),
    ).toBeInTheDocument();
    expect(writes).toEqual([]);
  });
  it('keeps choices after stale 409, never retries and requires reload plus reconfirmation', async () => {
    const { writes, saved } = renderForm({ stale: true });
    const dialog = await createConfirmation();
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Xác nhận gán phiên bản' }),
    );
    expect(
      await screen.findByRole('button', { name: 'Nạp lại dữ liệu' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Tiếp tục xác nhận' }),
    ).toBeDisabled();
    expect(
      screen.getByLabelText('Phiên bản ban hành').closest('.ant-select'),
    ).toHaveTextContent('2.0 · QĐ-100/2026');
    expect(writes).toHaveLength(1);
    expect(saved).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Nạp lại dữ liệu' }));
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Tiếp tục xác nhận' }),
      ).toBeEnabled(),
    );
    expect(writes).toHaveLength(1);
  });
  it('excludes Draft and disables semesters without a start date', async () => {
    renderForm();
    fireEvent.mouseDown(screen.getByLabelText('Phiên bản ban hành'));
    await screen.findByText('2.0 · QĐ-100/2026', {
      selector: '.ant-select-item-option-content',
    });
    expect(
      screen.queryByText('Nháp', {
        selector: '.ant-select-item-option-content',
      }),
    ).not.toBeInTheDocument();
    fireEvent.keyDown(screen.getByLabelText('Phiên bản ban hành'), {
      key: 'Escape',
    });
    fireEvent.mouseDown(screen.getByLabelText('Từ học kỳ'));
    const option = await screen.findByText('UNKNOWN · Chưa có ngày bắt đầu', {
      selector: '.ant-select-item-option-content',
    });
    expect(option.closest('.ant-select-item-option')).toHaveClass(
      'ant-select-item-option-disabled',
    );
  });
});
