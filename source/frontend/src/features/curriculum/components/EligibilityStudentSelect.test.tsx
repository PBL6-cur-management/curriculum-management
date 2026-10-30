import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EligibilityStudentSelect } from './EligibilityStudentSelect';

afterEach(() => vi.unstubAllGlobals());
function show(semesterId = 'sem') {
  const onChange = vi.fn();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <label htmlFor="student-picker">Sinh viên xét</label>
      <EligibilityStudentSelect
        id="student-picker"
        programId="program"
        semesterId={semesterId}
        onChange={onChange}
      />
    </QueryClientProvider>,
  );
  return onChange;
}
describe('scoped eligibility student select', () => {
  it('requires a semester before issuing any directory request', () => {
    vi.stubGlobal('fetch', vi.fn());
    show('');
    expect(
      screen.getByRole('combobox', { name: 'Sinh viên xét' }),
    ).toBeDisabled();
    expect(fetch).not.toHaveBeenCalled();
  });
  it('searches the scoped server endpoint and uses code/name labels', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              items: [
                {
                  id: 'student',
                  studentCode: 'SYN001',
                  fullName: 'Sinh viên giả lập',
                },
              ],
              total: 1,
              page: 1,
              pageSize: 20,
            }),
          ),
        ),
      ),
    );
    const onChange = show();
    fireEvent.mouseDown(
      screen.getByRole('combobox', { name: 'Sinh viên xét' }),
    );
    fireEvent.click(await screen.findByText('SYN001 — Sinh viên giả lập'));
    expect(onChange).toHaveBeenCalledWith('student');
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'SYN' },
    });
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        '/api/programs/program/registration-eligibility/students?semesterId=sem&q=SYN&page=1&pageSize=20',
        expect.any(Object),
      ),
    );
  });
});
