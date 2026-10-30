import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ROUTES } from '../../../routes';
import {
  graduationAudit,
  jsonGraduation,
  renderGraduationPage,
} from '../testRender';
import { GraduationAuditPage } from './GraduationAuditPage';

afterEach(() => vi.unstubAllGlobals());
describe('immutable graduation audit detail', () => {
  it.each([
    ['RECHECK_PENDING', 'Kết quả học tập đã thay đổi, đang chờ xét lại'],
    ['RECHECK_FAILED', 'Không thể tự động xét lại, cần kiểm tra dữ liệu'],
  ] as const)(
    'labels %s as historical and keeps R3 away from task controls',
    async (freshness, label) => {
      const { writes, fetchMock } = renderGraduationPage({
        element: <GraduationAuditPage />,
        path: ROUTES.graduationAudit,
        entry: '/graduation/audits/audit',
        roleCodes: ['R3'],
        reads: {
          '/api/graduation-audits/audit': {
            ...graduationAudit,
            auditedBy: null,
            trigger: 'RESULT_CHANGE',
            freshness,
          },
        },
      });
      expect(await screen.findByText(label)).toBeInTheDocument();
      expect(screen.getByText('Hệ thống')).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'Thử xét lại' }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'Lưu lần xét' }),
      ).not.toBeInTheDocument();
      expect(
        fetchMock.mock.calls.some(([path]) =>
          String(path).includes('reaudit-tasks'),
        ),
      ).toBe(false);
      expect(writes).toEqual([]);
    },
  );
  it('offers R1 a failed-task retry without exposing feed snapshots', async () => {
    const { writes, fetchMock } = renderGraduationPage({
      element: <GraduationAuditPage />,
      path: ROUTES.graduationAudit,
      entry: '/graduation/audits/audit',
      roleCodes: ['R1'],
      reads: {
        '/api/students/student/graduation-reaudit-tasks?programId=program&semesterId=semester&page=1&pageSize=20':
          {
            items: [
              {
                id: 'task',
                contextId: 'context',
                status: 'FAILED',
                attempts: 3,
                completedAuditId: null,
                errorCode: 'GRADUATION_INPUT_INVALID',
              },
            ],
            total: 1,
            page: 1,
            pageSize: 20,
          },
      },
      writeResponse: () =>
        jsonGraduation({
          id: 'task',
          contextId: 'context',
          status: 'PENDING',
          attempts: 0,
          completedAuditId: null,
          errorCode: null,
        }),
    });
    const panelTitle = await screen.findByText('Tác vụ xét lại tự động');
    const panel = panelTitle.closest<HTMLElement>('.ant-card');
    expect(panel).not.toBeNull();
    const taskRow = await within(panel!).findByRole('row', {
      name: /GRADUATION_INPUT_INVALID/,
    });
    expect(
      within(taskRow).getByText('Cần kiểm tra dữ liệu'),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/students/student/graduation-reaudit-tasks?programId=program&semesterId=semester&page=1&pageSize=20',
      expect.any(Object),
    );
    const retry = within(taskRow).getByRole('button', { name: 'Thử xét lại' });
    expect(retry).toBeEnabled();
    fireEvent.click(retry);
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]).toMatchObject({
      path: '/api/graduation-reaudit-tasks/task/retry',
      method: 'POST',
      body: undefined,
    });
    expect(screen.queryByText('score10')).not.toBeInTheDocument();
  });
  it('shows unsupported stored versions explicitly instead of a green conclusion', async () => {
    renderGraduationPage({
      element: <GraduationAuditPage />,
      path: ROUTES.graduationAudit,
      entry: '/graduation/audits/audit',
      reads: {
        '/api/graduation-audits/audit': {
          ...graduationAudit,
          result: { ...graduationAudit.result, schemaVersion: 2 },
        },
      },
    });
    expect(
      await screen.findByText('Chưa hỗ trợ phiên bản kết quả này'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Đủ điều kiện')).not.toBeInTheDocument();
  });
  it.each([403, 404])(
    'shows a scoped transport error %s without personal results',
    async (status) => {
      renderGraduationPage({
        element: <GraduationAuditPage />,
        path: ROUTES.graduationAudit,
        entry: '/graduation/audits/audit',
        reads: {
          '/api/graduation-audits/audit': jsonGraduation(
            { message: 'Ngoài phạm vi.' },
            status,
          ),
        },
      });
      expect(
        await screen.findByText(
          status === 404
            ? 'Không tìm thấy hồ sơ trong chương trình và học kỳ đã chọn'
            : 'Phiên đăng nhập hoặc quyền xét tốt nghiệp không còn hợp lệ',
        ),
      ).toBeInTheDocument();
      expect(
        screen.queryByText('SYN001 — Sinh viên tổng hợp'),
      ).not.toBeInTheDocument();
    },
  );
});
