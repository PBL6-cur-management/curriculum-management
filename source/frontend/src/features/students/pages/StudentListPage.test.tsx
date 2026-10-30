import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RequireStudentStaff } from '../components/RequireStudentStaff';
import { json, renderStudentPage, student } from '../testRender';
import { StudentListPage } from './StudentListPage';

afterEach(() => vi.unstubAllGlobals());
describe('StudentListPage', () => {
  it('requires an explicit semester without fetching a global student list', async () => {
    const { fetchMock } = renderStudentPage({ element: <StudentListPage /> });
    expect(
      await screen.findByText('Chọn học kỳ để xem sinh viên'),
    ).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some(([path]) =>
        String(path).startsWith('/api/students?'),
      ),
    ).toBe(false);
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
    fireEvent.change(screen.getByRole('textbox', { name: 'Tìm sinh viên' }), {
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
