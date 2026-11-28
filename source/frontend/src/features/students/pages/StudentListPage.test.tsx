import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RequireStudentStaff } from '../components/RequireStudentStaff';
import { json, renderStudentPage, student } from '../testRender';
import { StudentListPage } from './StudentListPage';

afterEach(() => vi.unstubAllGlobals());
describe('StudentListPage', () => {
  it('lists and searches students without choosing a semester', async () => {
    const { fetchMock } = renderStudentPage({
      element: <StudentListPage />,
      responses: new Map([
        [
          '/api/students?page=1&pageSize=20',
          { items: [student], total: 1, page: 1, pageSize: 20 },
        ],
      ]),
    });
    expect(
      await screen.findByRole('link', { name: '000123' }),
    ).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some(([path]) =>
        String(path).startsWith('/api/students?page=1'),
      ),
    ).toBe(true);
  });
  it('carries filters into profile links and resets page after debounced search', async () => {
    const params = 'semesterId=s1&programId=p1&page=2';
    const { router, fetchMock } = renderStudentPage({
      element: <StudentListPage />,
      path: `/students?${params}`,
      responses: new Map([
        [
          '/api/students?semesterId=s1&programId=p1&page=2&pageSize=20',
          { items: [student], total: 21, page: 2, pageSize: 20 },
        ],
        [
          '/api/students?semesterId=s1&programId=p1&q=000&page=1&pageSize=20',
          { items: [student], total: 1, page: 1, pageSize: 20 },
        ],
      ]),
    });
    expect(await screen.findByRole('link', { name: '000123' })).toHaveAttribute(
      'href',
      `/students/st1?${params}`,
    );
    fireEvent.change(screen.getByLabelText('Tìm sinh viên'), {
      target: { value: '000' },
    });
    await waitFor(() =>
      expect(router.state.location.search).not.toContain('page='),
    );
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([path]) => String(path).includes('q=000')),
      ).toBe(true),
    );
  });
  it('refuses R6 staff navigation before sending student requests', async () => {
    const { fetchMock } = renderStudentPage({
      element: (
        <RequireStudentStaff>
          <StudentListPage />
        </RequireStudentStaff>
      ),
      roleCodes: ['R6'],
    });
    expect(
      await screen.findByText('Bạn không có quyền truy cập hồ sơ sinh viên'),
    ).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some(([path]) => String(path).includes('/students')),
    ).toBe(false);
  });
  it('allows a custom dynamic staff role holding student.viewProgress', async () => {
    renderStudentPage({
      element: (
        <RequireStudentStaff>
          <StudentListPage />
        </RequireStudentStaff>
      ),
      roleCodes: ['CVHT'],
      permissions: ['student.viewProgress'],
      responses: new Map([
        [
          '/api/students?page=1&pageSize=20',
          { items: [student], total: 1, page: 1, pageSize: 20 },
        ],
      ]),
    });
    expect(
      await screen.findByRole('link', { name: '000123' }),
    ).toBeInTheDocument();
  });
  it('exports transfer Excel respecting active filters and runs bulk transfer with summary', async () => {
    vi.stubGlobal(
      'URL',
      class extends URL {
        static createObjectURL = vi.fn(() => 'blob:transfer');
        static revokeObjectURL = vi.fn();
      },
    );
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    const student2 = {
      ...student,
      id: 'st2',
      studentCode: '000124',
      fullName: 'Sinh viên hai',
    };
    const { fetchMock, writes } = renderStudentPage({
      element: <StudentListPage />,
      path: '/students?cohortId=c1&programId=p1',
      responses: new Map<string, unknown>([
        [
          '/api/students?programId=p1&cohortId=c1&page=1&pageSize=20',
          { items: [student, student2], total: 2, page: 1, pageSize: 20 },
        ],
        [
          '/api/students/enrollments/transfers/export?cohortId=c1&programId=p1',
          new Response('xlsx-bytes'),
        ],
        [
          '/api/students/st1/enrollment-targets?programId=p1&semesterId=s1',
          [
            {
              program: {
                id: 'p1',
                programCode: 'CT01',
                programName: 'Chương trình tổng hợp',
              },
              version: { id: 'v2', versionNumber: '2.0', status: 'ACTIVE' },
              effectiveSemester: {
                id: 's1',
                semesterCode: '2025-1',
                academicYear: '2025-2026',
                termInYear: 1,
                startDate: '2025-08-01',
                startDateEstimated: false,
              },
            },
          ],
        ],
      ]),
      writeResponse: () =>
        json({
          total: 2,
          succeeded: 1,
          failed: 1,
          results: [
            { studentCode: '000123', status: 'OK', newEnrollmentId: 'en2' },
            {
              studentCode: '000124',
              status: 'FAILED',
              errorMessage: 'Đã học cùng phiên bản.',
            },
          ],
        }),
    });
    await screen.findByRole('link', { name: '000123' });
    fireEvent.click(
      screen.getByRole('button', { name: 'Xuất Excel chuyển CTĐT' }),
    );
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([path]) =>
          String(path).includes(
            '/api/students/enrollments/transfers/export?cohortId=c1&programId=p1',
          ),
        ),
      ).toBe(true),
    );
    const bulkBtn = screen.getByRole('button', {
      name: 'Chuyển CTĐT hàng loạt',
    });
    expect(bulkBtn).toBeDisabled();
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    const activeBulkBtn = await screen.findByRole('button', {
      name: 'Chuyển CTĐT hàng loạt (2)',
    });
    expect(activeBulkBtn).toBeEnabled();
    fireEvent.click(activeBulkBtn);

    const choose = async (label: string, text: string) => {
      const control = await screen.findByLabelText(label);
      await waitFor(() => expect(control).not.toBeDisabled());
      fireEvent.keyDown(control, {
        key: 'ArrowDown',
        code: 'ArrowDown',
        keyCode: 40,
      });
      fireEvent.click(
        await screen.findByText(text, {
          selector: '.ant-select-item-option-content',
        }),
      );
    };
    await choose('Học kỳ hiệu lực', '2025-1 · 2025-08-01');
    await choose('Chương trình đích', 'CT01 — Chương trình tổng hợp');
    await choose('Phiên bản đã ban hành', '2.0 · 2025-1');
    fireEvent.change(screen.getByLabelText('Số quyết định (tùy chọn)'), {
      target: { value: 'QĐ-99' },
    });
    fireEvent.change(screen.getByLabelText('Lý do / căn cứ chuyển'), {
      target: { value: 'Chuyển diện đại trà' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Thực hiện chuyển CTĐT' }),
    );
    expect(
      await screen.findByText(
        'Đã xử lý 2 sinh viên: thành công 1, thất bại 1.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Đã học cùng phiên bản.')).toBeInTheDocument();
    expect(writes[0]).toEqual({
      method: 'POST',
      path: '/api/students/enrollments/bulk-transfer',
      body: {
        studentIds: ['st1', 'st2'],
        targetVersionId: 'v2',
        fromSemesterId: 's1',
        basisDecision: 'QĐ-99 — Chuyển diện đại trà',
      },
    });
    click.mockRestore();
  });
  it('shows a recoverable error rather than treating refusal as an empty list', async () => {
    renderStudentPage({
      element: <StudentListPage />,
      path: '/students?semesterId=s1',
      responses: new Map([
        ['/api/students?semesterId=s1&page=1&pageSize=20', json({}, 403)],
      ]),
    });
    expect(
      await screen.findByText(
        'Không tải được sinh viên trong phạm vi của bạn.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeEnabled();
  });
});
