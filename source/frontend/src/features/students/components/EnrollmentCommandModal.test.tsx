import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EnrollmentCommandModal } from './EnrollmentCommandModal';
import {
  json,
  program,
  renderStudentPage,
  semester,
  student,
} from '../testRender';

afterEach(() => vi.unstubAllGlobals());
async function choose(label: string, text: string) {
  const control = await screen.findByLabelText(label);
  await waitFor(() => expect(control).not.toBeDisabled());
  fireEvent.keyDown(control, {
    key: 'ArrowDown',
    code: 'ArrowDown',
    keyCode: 40,
    which: 40,
  });
  await waitFor(() => expect(control).toHaveAttribute('aria-expanded', 'true'));
  fireEvent.click(
    await screen.findByText(text, {
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
describe('EnrollmentCommandModal', () => {
  it('assigns a program with no existing enrollments to an unassigned student', async () => {
    const newProgram = {
      ...program,
      id: 'p-new',
      programCode: 'NEW',
      programName: 'Chương trình chưa có sinh viên',
    };
    const onClose = vi.fn();
    const { writes, fetchMock } = renderStudentPage({
      element: (
        <EnrollmentCommandModal
          student={{ ...student, enrollments: [] }}
          sourceEnrollment={null}
          operation="ASSIGN_EXCEPTION"
          open
          onClose={onClose}
          onReload={vi.fn()}
        />
      ),
      responses: new Map<string, unknown>([
        ['/api/students/program-options?semesterId=s1', [newProgram]],
        [
          '/api/students/st1/enrollment-targets?programId=p-new&semesterId=s1',
          [
            {
              program: newProgram,
              version: { id: 'v-new', versionNumber: '1.0', status: 'ACTIVE' },
              effectiveSemester: semester,
            },
          ],
        ],
      ]),
      writeResponse: () =>
        json({
          ...student.enrollments[0],
          program: newProgram,
          appliedVersion: {
            id: 'v-new',
            versionNumber: '1.0',
            status: 'ACTIVE',
          },
        }),
    });
    await choose('Học kỳ bắt đầu', '2025-1 · 2025-08-01');
    await choose('Chương trình đích', 'NEW — Chương trình chưa có sinh viên');
    await choose('Phiên bản đã ban hành', '1.0 · 2025-1');
    fireEvent.change(screen.getByLabelText('Căn cứ / số quyết định'), {
      target: { value: 'QĐ tổng hợp mới' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Xem lại và xác nhận' }),
    );
    fireEvent.click(
      await screen.findByRole('button', { name: 'Xác nhận ghi danh' }),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(writes).toHaveLength(1);
    expect(writes[0].body).toEqual({
      operation: 'ASSIGN_EXCEPTION',
      targetVersionId: 'v-new',
      fromSemesterId: 's1',
      basisDecision: 'QĐ tổng hợp mới',
      expectedStudentUpdatedAt: student.updatedAt,
    });
    expect(
      fetchMock.mock.calls.some(
        ([path]) =>
          String(path) === '/api/students/program-options?semesterId=s1',
      ),
    ).toBe(true);
  });

  it('cannot submit when the staff scope has no program options', async () => {
    const { writes, client } = renderStudentPage({
      element: (
        <EnrollmentCommandModal
          student={{ ...student, enrollments: [] }}
          sourceEnrollment={null}
          operation="ASSIGN_EXCEPTION"
          open
          onClose={vi.fn()}
          onReload={vi.fn()}
        />
      ),
      responses: new Map([['/api/students/program-options?semesterId=s1', []]]),
    });
    await choose('Học kỳ bắt đầu', '2025-1 · 2025-08-01');
    await waitFor(() =>
      expect(client.getQueryData(['students', 'programs', 's1'])).toEqual([]),
    );
    expect(
      screen.getByRole('button', { name: 'Xem lại và xác nhận' }),
    ).toBeDisabled();
    expect(writes).toHaveLength(0);
  });

  it('explains an empty issued-target list without allowing an enrollment command', async () => {
    const { writes } = renderStudentPage({
      element: (
        <EnrollmentCommandModal
          student={{ ...student, enrollments: [] }}
          sourceEnrollment={null}
          operation="ASSIGN_EXCEPTION"
          open
          onClose={vi.fn()}
          onReload={vi.fn()}
        />
      ),
      responses: new Map([
        ['/api/students/st1/enrollment-targets?programId=p1&semesterId=s1', []],
      ]),
    });
    await choose('Học kỳ bắt đầu', '2025-1 · 2025-08-01');
    await choose('Chương trình đích', 'CT01 — Chương trình tổng hợp');
    expect(
      await screen.findByText(
        'Chưa có phiên bản đã ban hành phù hợp với chương trình và học kỳ này.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Xem lại và xác nhận' }),
    ).toBeDisabled();
    expect(writes).toHaveLength(0);
  });

  it('requires evidence, confirms the source tokens and retains input after a conflict', async () => {
    const reloaded = { ...student, updatedAt: '2026-10-02T00:00:00.000Z' };
    const reload = vi.fn().mockResolvedValue(reloaded);
    const { writes } = renderStudentPage({
      element: (
        <EnrollmentCommandModal
          student={student}
          sourceEnrollment={student.enrollments[0]}
          operation="TRANSFER"
          open
          onClose={vi.fn()}
          onReload={reload}
        />
      ),
      responses: new Map([
        [
          '/api/students/st1/enrollment-targets?programId=p1&semesterId=s1',
          [
            {
              program,
              version: { id: 'v2', versionNumber: '2.0', status: 'ACTIVE' },
              effectiveSemester: semester,
            },
          ],
        ],
      ]),
      writeResponse: () => json({ message: 'Hồ sơ đã thay đổi.' }, 409),
    });
    await choose('Học kỳ bắt đầu', '2025-1 · 2025-08-01');
    await choose('Chương trình đích', 'CT01 — Chương trình tổng hợp');
    await choose('Phiên bản đã ban hành', '2.0 · 2025-1');
    fireEvent.change(screen.getByLabelText('Căn cứ / số quyết định'), {
      target: { value: '   ' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Xem lại và xác nhận' }),
    );
    expect(
      await screen.findByText('Nhập căn cứ hoặc số quyết định.'),
    ).toBeInTheDocument();
    expect(writes).toHaveLength(0);
    fireEvent.change(screen.getByLabelText('Căn cứ / số quyết định'), {
      target: { value: '  QĐ tổng hợp  ' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Xem lại và xác nhận' }),
    );
    const button = await screen.findByRole('button', {
      name: 'Xác nhận ghi danh',
    });
    fireEvent.click(button);
    await screen.findByText(/Hồ sơ đã thay đổi. Tải lại/);
    expect(writes).toHaveLength(1);
    expect(writes[0].body).toMatchObject({
      basisDecision: 'QĐ tổng hợp',
      sourceEnrollmentId: 'en1',
      expectedStudentUpdatedAt: student.updatedAt,
      expectedEnrollmentUpdatedAt: student.enrollments[0].updatedAt,
    });
    expect(screen.getByLabelText('Căn cứ / số quyết định')).toHaveValue(
      '  QĐ tổng hợp  ',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Tải lại hồ sơ' }));
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    expect(writes).toHaveLength(1);
  });
});
