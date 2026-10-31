import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { formatDecisionNumber } from '../../../shared/releases/decisionNumber';
import { SemesterStartDate } from './SemesterStartDate';

describe('SemesterStartDate', () => {
  it('labels an estimated date in text, not only by colour', () => {
    render(<SemesterStartDate startDate="2015-06-08" estimated />);
    expect(screen.getByText('08/06/2015')).toBeInTheDocument();
    expect(screen.getByText('Ngày ước lượng')).toBeInTheDocument();
  });
  it('shows an official date without the label', () => {
    render(<SemesterStartDate startDate="2026-08-10" estimated={false} />);
    expect(screen.getByText('10/08/2026')).toBeInTheDocument();
    expect(screen.queryByText('Ngày ước lượng')).not.toBeInTheDocument();
  });
  it('says when there is no date', () => {
    render(<SemesterStartDate startDate={null} estimated={false} />);
    expect(screen.getByText('Chưa có')).toBeInTheDocument();
  });
});

describe('formatDecisionNumber', () => {
  it('names a missing decision number instead of leaving a blank', () => {
    expect(formatDecisionNumber(null)).toBe('Chưa có số quyết định');
    expect(formatDecisionNumber('  ')).toBe('Chưa có số quyết định');
    expect(formatDecisionNumber('123/QĐ-ĐHBK')).toBe('123/QĐ-ĐHBK');
  });
});
