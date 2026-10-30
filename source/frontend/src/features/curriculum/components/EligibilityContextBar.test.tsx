import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EligibilityContextBar } from './EligibilityContextBar';

afterEach(() => vi.unstubAllGlobals());
describe('eligibility context bar', () => {
  it('associates picker labels and exposes explicit recompute and clear', () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockImplementation((input: RequestInfo | URL) =>
          Promise.resolve(
            new Response(
              JSON.stringify(
                String(input).endsWith('/semesters')
                  ? []
                  : { items: [], total: 0, page: 1, pageSize: 20 },
              ),
            ),
          ),
        ),
    );
    const onStudentChange = vi.fn();
    const onRecompute = vi.fn();
    render(
      <QueryClientProvider client={new QueryClient()}>
        <EligibilityContextBar
          programId="p"
          semesterId="sem"
          studentId="s"
          onSemesterChange={() => {}}
          onStudentChange={onStudentChange}
          onRecompute={onRecompute}
        />
      </QueryClientProvider>,
    );
    expect(
      screen.getByRole('combobox', { name: 'Học kỳ xét điều kiện' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('combobox', { name: 'Xem theo sinh viên' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Sinh viên đã chọn')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Tính lại' }));
    fireEvent.click(screen.getByRole('button', { name: 'Bỏ chọn sinh viên' }));
    expect(onRecompute).toHaveBeenCalledOnce();
    expect(onStudentChange).toHaveBeenCalledWith(undefined);
  });
});
