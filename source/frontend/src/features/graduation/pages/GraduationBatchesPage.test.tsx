import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { App } from 'antd';
import { useEffect } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ROUTES } from '../../../routes';
import {
  graduationBatch,
  jsonGraduation,
  renderGraduationPage,
} from '../testRender';
import { GraduationBatchesPage } from './GraduationBatchesPage';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function observeConfirmations() {
  const actions: Array<() => unknown> = [];
  const completions: unknown[] = [];
  function ObservedBatchesPage() {
    const { modal } = App.useApp();
    useEffect(() => {
      const originalConfirm = modal.confirm;
      const spy = vi.spyOn(modal, 'confirm').mockImplementation((options) => {
        const action = () => options.onOk?.();
        actions.push(action);
        return originalConfirm({
          ...options,
          onOk: () => {
            const completion = action();
            completions.push(completion);
            return completion;
          },
        });
      });
      return () => spy.mockRestore();
    }, [modal]);
    return <GraduationBatchesPage />;
  }
  return { element: <ObservedBatchesPage />, actions, completions };
}
async function choose(name: string, label: string) {
  const control = await screen.findByLabelText(name);
  await waitFor(() => expect(control).not.toBeDisabled());
  fireEvent.keyDown(control, {
    key: 'ArrowDown',
    code: 'ArrowDown',
    keyCode: 40,
    which: 40,
  });
  await waitFor(() => expect(control).toHaveAttribute('aria-expanded', 'true'));
  fireEvent.click(
    await screen.findByText(label, {
      selector: '.ant-select-item-option-content',
    }),
  );
  fireEvent.keyDown(control, {
    key: 'Escape',
    code: 'Escape',
    keyCode: 27,
    which: 27,
  });
}
const preview = {
  filters: { semesterId: 'semester', programId: 'program', cohortId: null },
  studentCount: 1,
  enrollmentCount: 2,
  previewRevision: 'a'.repeat(64),
};
describe('graduation batch preview and confirmation', () => {
  it('requires a directed program for R3 even when a cohort is selected', async () => {
    const { writes } = renderGraduationPage({
      element: <GraduationBatchesPage />,
      path: ROUTES.graduationBatches,
      entry: ROUTES.graduationBatches,
      roleCodes: ['R3'],
    });
    await choose('Học kỳ xét', '2026-1 · 2026-09-01');
    await choose('Khóa', 'K26');
    expect(
      screen.getByRole('button', { name: 'Xem trước danh sách' }),
    ).toBeDisabled();
    expect(writes).toHaveLength(0);
  });
  it('does not enable confirmation for an empty frozen roster', async () => {
    const { writes } = renderGraduationPage({
      element: <GraduationBatchesPage />,
      path: ROUTES.graduationBatches,
      entry: ROUTES.graduationBatches,
      writeResponse: () =>
        jsonGraduation({ ...preview, studentCount: 0, enrollmentCount: 0 }),
    });
    await choose('Học kỳ xét', '2026-1 · 2026-09-01');
    await choose('Chương trình', 'SYN-P — Chương trình tổng hợp');
    fireEvent.click(
      screen.getByRole('button', { name: 'Xem trước danh sách' }),
    );
    await screen.findByText('0 sinh viên · 0 lượt chương trình');
    expect(
      screen.getByRole('button', { name: 'Xác nhận đợt xét' }),
    ).toBeDisabled();
    expect(writes).toHaveLength(1);
  });
  it('previews without creating, confirms frozen dual-major counts and sends a revision/key', async () => {
    const { writes, router } = renderGraduationPage({
      element: <GraduationBatchesPage />,
      path: ROUTES.graduationBatches,
      entry: ROUTES.graduationBatches,
      writeResponse: (write) =>
        jsonGraduation(
          write.path.endsWith('/preview') ? preview : graduationBatch,
          write.path.endsWith('/preview') ? 200 : 201,
        ),
    });
    expect(
      screen.getByRole('button', { name: 'Xác nhận đợt xét' }),
    ).toBeDisabled();
    expect(writes).toHaveLength(0);
    await choose('Học kỳ xét', '2026-1 · 2026-09-01');
    await choose('Chương trình', 'SYN-P — Chương trình tổng hợp');
    fireEvent.click(
      screen.getByRole('button', { name: 'Xem trước danh sách' }),
    );
    expect(
      await screen.findByText('1 sinh viên · 2 lượt chương trình'),
    ).toBeInTheDocument();
    expect(writes).toHaveLength(1);
    expect(writes[0].path).toBe('/api/graduation-batches/preview');
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận đợt xét' }));
    const dialog = await screen.findByRole('dialog', {
      name: 'Bắt đầu xét tốt nghiệp?',
    });
    expect(screen.getAllByRole('dialog', { hidden: true })).toHaveLength(1);
    expect(
      within(dialog).getByText(
        /Danh sách cố định gồm 1 sinh viên, 2 lượt chương trình/,
      ),
    ).toBeInTheDocument();
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Bắt đầu xét' }),
    );
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/graduation/batches/batch'),
    );
    expect(writes).toHaveLength(2);
    expect(writes[1].body).toMatchObject({
      semesterId: 'semester',
      programId: 'program',
      previewRevision: 'a'.repeat(64),
      requestKey: expect.any(String),
    });
  });
  it('clears a confirmed preview when a filter changes', async () => {
    const { writes } = renderGraduationPage({
      element: <GraduationBatchesPage />,
      path: ROUTES.graduationBatches,
      entry: ROUTES.graduationBatches,
      writeResponse: () => jsonGraduation(preview),
    });
    await choose('Học kỳ xét', '2026-1 · 2026-09-01');
    await choose('Chương trình', 'SYN-P — Chương trình tổng hợp');
    fireEvent.click(
      screen.getByRole('button', { name: 'Xem trước danh sách' }),
    );
    await screen.findByText('1 sinh viên · 2 lượt chương trình');
    await choose('Khóa', 'K26');
    expect(
      screen.getByRole('button', { name: 'Xác nhận đợt xét' }),
    ).toBeDisabled();
    expect(
      screen.queryByText('1 sinh viên · 2 lượt chương trình'),
    ).not.toBeInTheDocument();
    expect(writes).toHaveLength(1);
  });
  it('resolves a stale confirmation without submitting and explains the changed filters', async () => {
    const confirmation = observeConfirmations();
    const { writes } = renderGraduationPage({
      element: confirmation.element,
      path: ROUTES.graduationBatches,
      entry: ROUTES.graduationBatches,
      writeResponse: () => jsonGraduation(preview),
    });
    await choose('Học kỳ xét', '2026-1 · 2026-09-01');
    await choose('Chương trình', 'SYN-P — Chương trình tổng hợp');
    fireEvent.click(
      screen.getByRole('button', { name: 'Xem trước danh sách' }),
    );
    await screen.findByText('1 sinh viên · 2 lượt chương trình');
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận đợt xét' }));
    await screen.findByRole('dialog', { name: 'Bắt đầu xét tốt nghiệp?' });
    expect(confirmation.actions).toHaveLength(1);
    await choose('Khóa', 'K26');
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { hidden: true }),
      ).not.toBeInTheDocument(),
    );
    await act(async () => {
      await expect(confirmation.actions[0]()).resolves.toBeUndefined();
    });
    expect(
      await screen.findByText('Bộ lọc đã thay đổi. Xem trước lại danh sách.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Xác nhận đợt xét' }),
    ).toBeDisabled();
    expect(writes).toHaveLength(1);
  });
  it.each(['network', 'server'] as const)(
    'closes a %s failure without rejection and reuses the confirmation key',
    async (failure) => {
      const confirmation = observeConfirmations();
      let attempts = 0;
      const { writes, router } = renderGraduationPage({
        element: confirmation.element,
        path: ROUTES.graduationBatches,
        entry: ROUTES.graduationBatches,
        writeResponse: (write) => {
          if (write.path.endsWith('/preview')) return jsonGraduation(preview);
          attempts += 1;
          if (attempts === 1) {
            if (failure === 'network')
              throw new Error('Synthetic connection interruption');
            return jsonGraduation(
              {
                code: 'GRADUATION_JOB_FAILED',
                message: 'Chưa tạo được đợt xét. Thử xác nhận lại.',
              },
              503,
            );
          }
          return jsonGraduation(graduationBatch, 201);
        },
      });
      await choose('Học kỳ xét', '2026-1 · 2026-09-01');
      await choose('Chương trình', 'SYN-P — Chương trình tổng hợp');
      fireEvent.click(
        screen.getByRole('button', { name: 'Xem trước danh sách' }),
      );
      await screen.findByText('1 sinh viên · 2 lượt chương trình');
      fireEvent.click(screen.getByRole('button', { name: 'Xác nhận đợt xét' }));
      const dialog = await screen.findByRole('dialog', {
        name: 'Bắt đầu xét tốt nghiệp?',
      });
      fireEvent.click(
        within(dialog).getByRole('button', { name: 'Bắt đầu xét' }),
      );
      expect(confirmation.completions).toHaveLength(1);
      await act(async () => {
        await expect(confirmation.completions[0]).resolves.toBeUndefined();
      });
      expect(
        await screen.findByText(
          failure === 'network'
            ? /Kết nối bị gián đoạn/
            : /Chưa tạo được đợt xét\. Thử xác nhận lại\./,
        ),
      ).toBeInTheDocument();
      await waitFor(() =>
        expect(
          screen.queryByRole('dialog', { hidden: true }),
        ).not.toBeInTheDocument(),
      );
      expect(
        screen.getByRole('button', { name: 'Xác nhận đợt xét' }),
      ).toBeEnabled();
      fireEvent.click(screen.getByRole('button', { name: 'Xác nhận đợt xét' }));
      const retryDialog = await screen.findByRole('dialog', {
        name: 'Bắt đầu xét tốt nghiệp?',
      });
      fireEvent.click(
        within(retryDialog).getByRole('button', { name: 'Bắt đầu xét' }),
      );
      expect(confirmation.completions).toHaveLength(2);
      await act(async () => {
        await expect(confirmation.completions[1]).resolves.toBeUndefined();
      });
      await waitFor(() =>
        expect(router.state.location.pathname).toBe(
          '/graduation/batches/batch',
        ),
      );
      const creations = writes.filter(
        (write) => write.path === '/api/graduation-batches',
      );
      expect(creations).toHaveLength(2);
      expect(creations[0].body).toEqual(creations[1].body);
      expect(creations[0].body).toMatchObject({
        requestKey: expect.any(String),
        previewRevision: preview.previewRevision,
      });
      expect(
        writes.filter((write) => write.path.endsWith('/preview')),
      ).toHaveLength(1);
    },
  );
  it('invalidates preview after 409 drift instead of silently creating a new batch', async () => {
    const confirmation = observeConfirmations();
    const { writes } = renderGraduationPage({
      element: confirmation.element,
      path: ROUTES.graduationBatches,
      entry: ROUTES.graduationBatches,
      writeResponse: (write) =>
        write.path.endsWith('/preview')
          ? jsonGraduation(preview)
          : jsonGraduation(
              {
                code: 'GRADUATION_STATE_CHANGED',
                message: 'Danh sách đã đổi, xem trước lại.',
              },
              409,
            ),
    });
    await choose('Học kỳ xét', '2026-1 · 2026-09-01');
    await choose('Chương trình', 'SYN-P — Chương trình tổng hợp');
    fireEvent.click(
      screen.getByRole('button', { name: 'Xem trước danh sách' }),
    );
    await screen.findByText('1 sinh viên · 2 lượt chương trình');
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận đợt xét' }));
    const dialog = await screen.findByRole('dialog', {
      name: 'Bắt đầu xét tốt nghiệp?',
    });
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Bắt đầu xét' }),
    );
    expect(confirmation.completions).toHaveLength(1);
    await act(async () => {
      await expect(confirmation.completions[0]).resolves.toBeUndefined();
    });
    expect(
      await screen.findByText(
        /GRADUATION_STATE_CHANGED — Danh sách đã đổi, xem trước lại\./,
      ),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { hidden: true }),
      ).not.toBeInTheDocument(),
    );
    expect(
      screen.queryByText('1 sinh viên · 2 lượt chương trình'),
    ).not.toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Xác nhận đợt xét' }),
      ).toBeDisabled(),
    );
    expect(
      writes.filter((write) => write.path === '/api/graduation-batches'),
    ).toHaveLength(1);
  });
});
