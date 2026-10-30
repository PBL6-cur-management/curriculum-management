import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  completedItemFixture,
  conditionalItemFixture,
  eligibleItemFixture,
  ineligibleItemFixture,
} from '../../features/curriculum/eligibilityTestFixtures';
import { EligibilityStatus } from './EligibilityStatus';

describe('eligibility status presentation', () => {
  it.each([
    completedItemFixture,
    eligibleItemFixture,
    conditionalItemFixture,
    ineligibleItemFixture,
  ])('renders the server statusText, not a client verdict', (fixture) => {
    const item = fixture('i-SYN');
    render(<EligibilityStatus item={item} />);
    expect(screen.getByText(item.statusText)).toBeInTheDocument();
  });
  it('opens reasons through a keyboard-focusable named button', () => {
    const onShowReasons = vi.fn();
    render(
      <EligibilityStatus
        item={ineligibleItemFixture('i-SYN')}
        onShowReasons={onShowReasons}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Xem lý do SYN' }));
    expect(onShowReasons).toHaveBeenCalledOnce();
  });
  it('never paints malformed null eligibility green', () => {
    render(
      <EligibilityStatus
        item={{ ...eligibleItemFixture('i-SYN'), eligibility: null }}
      />,
    );
    expect(
      screen.getByText('Dữ liệu điều kiện không hợp lệ; hãy tính lại.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Được')).not.toBeInTheDocument();
  });
});
