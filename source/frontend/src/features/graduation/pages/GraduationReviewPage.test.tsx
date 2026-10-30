import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ROUTES } from '../../../routes';
import {
  graduationAudit,
  jsonGraduation,
  renderGraduationPage,
  shortfallGraduation,
} from '../testRender';
import { GraduationReviewPage } from './GraduationReviewPage';

afterEach(() => vi.unstubAllGlobals());
describe('single graduation review', () => {
  it('requires an explicit view action, preserves deep-link context and never saves on mount', async () => {
    const { writes, fetchMock } = renderGraduationPage({
      element: <GraduationReviewPage />,
    });
    await screen.findByRole('button', { name: 'Xem kết quả' });
    expect(
      fetchMock.mock.calls.some(([path]) =>
        String(path).includes('/student/graduation?'),
      ),
    ).toBe(false);
    expect(writes).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Xem kết quả' }));
    expect(
      await screen.findByText('Không còn thiếu hạng mục nào'),
    ).toBeInTheDocument();
    expect(writes).toEqual([]);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/students/student/graduation?programId=program&semesterId=semester',
      expect.any(Object),
    );
  });
  it('displays the returned saved result instead of treating the live preview as a saved snapshot', async () => {
    const { writes } = renderGraduationPage({
      element: <GraduationReviewPage />,
      writeResponse: () =>
        jsonGraduation(
          { ...graduationAudit, result: shortfallGraduation },
          201,
        ),
    });
    fireEvent.click(screen.getByRole('button', { name: 'Xem kết quả' }));
    await screen.findByText('Không còn thiếu hạng mục nào');
    fireEvent.click(screen.getByRole('button', { name: 'Lưu lần xét' }));
    expect(await screen.findByText('Chưa đủ điều kiện')).toBeInTheDocument();
    expect(
      screen.queryByText('Không còn thiếu hạng mục nào'),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Phòng Đào tạo tổng hợp')).toBeInTheDocument();
    expect(writes).toHaveLength(1);
    expect(writes[0].headers.get('X-Requested-With')).toBe('XMLHttpRequest');
    expect(screen.getByRole('link', { name: /30\/10\/2026/ })).toHaveAttribute(
      'href',
      '/graduation/audits/audit',
    );
  });
  it('retains a save request key across a network retry and makes a new one after deliberate success', async () => {
    let attempts = 0;
    const { writes } = renderGraduationPage({
      element: <GraduationReviewPage />,
      writeResponse: () => {
        attempts += 1;
        if (attempts === 1) throw new Error('synthetic network interruption');
        return jsonGraduation(graduationAudit, 201);
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Xem kết quả' }));
    await screen.findByText('Không còn thiếu hạng mục nào');
    fireEvent.click(screen.getByRole('button', { name: 'Lưu lần xét' }));
    await screen.findByText(/Kết nối bị gián đoạn/);
    fireEvent.click(screen.getByRole('button', { name: 'Lưu lần xét' }));
    await screen.findByText('Phòng Đào tạo tổng hợp');
    expect(writes[0].body).toEqual(writes[1].body);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Lưu lần xét' })).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Lưu lần xét' }));
    await waitFor(() => expect(writes).toHaveLength(3));
    expect(writes[2].body).not.toEqual(writes[1].body);
  });
  it('distinguishes CANNOT_AUDIT from an academic rejection and disables save', async () => {
    renderGraduationPage({
      element: <GraduationReviewPage />,
      reads: {
        '/api/students/student/graduation?programId=program&semesterId=semester':
          {
            status: 'CANNOT_AUDIT',
            result: null,
            error: {
              code: 'APPLIED_VERSION_UNRESOLVED',
              message: 'Chưa có phiên bản áp dụng.',
              enrollmentId: null,
            },
          },
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Xem kết quả' }));
    expect(await screen.findByText('Chưa thể kết luận')).toBeInTheDocument();
    expect(screen.getByText(/Liên hệ Phòng Đào tạo/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lưu lần xét' })).toBeDisabled();
    expect(screen.queryByText('Chưa đủ điều kiện')).not.toBeInTheDocument();
  });
  it('hides the old result immediately when a different deep-link context is opened', async () => {
    const { router } = renderGraduationPage({
      element: <GraduationReviewPage />,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Xem kết quả' }));
    await screen.findByText('Không còn thiếu hạng mục nào');
    await router.navigate(
      `${ROUTES.graduation}?studentId=other&programId=foreign&semesterId=semester`,
    );
    await waitFor(() =>
      expect(
        screen.queryByText('Không còn thiếu hạng mục nào'),
      ).not.toBeInTheDocument(),
    );
    expect(
      screen.queryByText('SYN001 — Sinh viên tổng hợp'),
    ).not.toBeInTheDocument();
    expect(
      new URLSearchParams(router.state.location.search).get('studentId'),
    ).toBe('other');
    expect(
      new URLSearchParams(router.state.location.search).get('programId'),
    ).toBe('foreign');
  });
  it('hides a saved snapshot and history after live access is revoked', async () => {
    let revoked = false;
    const { client } = renderGraduationPage({
      element: <GraduationReviewPage />,
      readResponse: (path) =>
        revoked && path.includes('/student/graduation?')
          ? jsonGraduation({ message: 'Ngoài phạm vi.' }, 403)
          : undefined,
      writeResponse: () => jsonGraduation(graduationAudit, 201),
    });
    fireEvent.click(screen.getByRole('button', { name: 'Xem kết quả' }));
    await screen.findByText('Không còn thiếu hạng mục nào');
    fireEvent.click(screen.getByRole('button', { name: 'Lưu lần xét' }));
    await screen.findByText('Phòng Đào tạo tổng hợp');
    revoked = true;
    await act(async () => {
      await client.invalidateQueries({ queryKey: ['graduation', 'live'] });
    });
    expect(
      await screen.findByText(
        'Phiên đăng nhập hoặc quyền xét tốt nghiệp không còn hợp lệ',
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Phòng Đào tạo tổng hợp'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('Không còn thiếu hạng mục nào'),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Lịch sử các lần xét')).not.toBeInTheDocument();
  });
  it('requires explicit program and semester before enabling the student directory', async () => {
    const { fetchMock } = renderGraduationPage({
      element: <GraduationReviewPage />,
      entry: ROUTES.graduation,
    });
    expect(screen.getByRole('combobox', { name: 'Sinh viên' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Xem kết quả' }));
    expect(
      await screen.findByText('Chọn học kỳ cần xét tốt nghiệp.'),
    ).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some(([path]) =>
        String(path).includes('/graduation/student-options'),
      ),
    ).toBe(false);
  });
});
