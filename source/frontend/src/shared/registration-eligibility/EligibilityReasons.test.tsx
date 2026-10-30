import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  conditionalItemFixture,
  ineligibleItemFixture,
} from '../../features/curriculum/eligibilityTestFixtures';
import { EligibilityReasons } from './EligibilityReasons';

describe('eligibility reasons drawer', () => {
  it('shows every concurrent course, not just a direct dependency', () => {
    render(
      <EligibilityReasons
        item={conditionalItemFixture('i-SYN')}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText('Phải đăng ký cùng')).toBeInTheDocument();
    expect(
      screen.getAllByText('SYN-B — Học phần giả lập SYN-B').length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText('SYN-C — Học phần giả lập SYN-C').length,
    ).toBeGreaterThan(0);
  });
  it('keeps zero distinct from null, displays leaf/path/evidence and escapes hostile text', () => {
    const item = ineligibleItemFixture('i-SYN');
    item.reasons[0].message = '<img src=x onerror=alert(1)>';
    const onClose = vi.fn();
    render(<EligibilityReasons item={item} onClose={onClose} />);
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText('2.5')).toBeInTheDocument();
    expect(screen.getByText('SYN-A → SYN-B → SYN-C')).toBeInTheDocument();
    expect(screen.getByText('PREREQUISITE_SCORE_TOO_LOW')).toBeInTheDocument();
    expect(
      screen.getByText('<img src=x onerror=alert(1)>'),
    ).toBeInTheDocument();
    expect(document.querySelector('img')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
