import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ComingSoonGate, EmailRemindersNotice } from './ComingSoon';

afterEach(() => vi.unstubAllEnvs());

describe('ComingSoonGate', () => {
  it('renders the real page when the feature is not listed', () => {
    render(
      <ComingSoonGate feature="backups">
        <div>real page</div>
      </ComingSoonGate>,
    );
    expect(screen.getByText('real page')).toBeInTheDocument();
  });
  it('renders the description page when the demo build lists it', () => {
    vi.stubEnv('VITE_COMING_SOON', 'backups,school-sync');
    render(
      <ComingSoonGate feature="backups">
        <div>real page</div>
      </ComingSoonGate>,
    );
    expect(screen.queryByText('real page')).not.toBeInTheDocument();
    expect(screen.getByText('Sắp có')).toBeInTheDocument();
    expect(screen.getByText('Vì sao chưa bật')).toBeInTheDocument();
  });
  it('shows the email note only when email reminders are listed', () => {
    const { rerender } = render(<EmailRemindersNotice />);
    expect(screen.queryByText(/Gửi email nhắc việc/)).not.toBeInTheDocument();
    vi.stubEnv('VITE_COMING_SOON', 'email-reminders');
    rerender(<EmailRemindersNotice key="on" />);
    expect(screen.getByText('Gửi email nhắc việc: Sắp có')).toBeInTheDocument();
  });
});
