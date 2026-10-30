import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SummaryStrip } from './SummaryStrip';

describe('SummaryStrip', () => {
  it('lists every label with its value inside one named group', () => {
    render(
      <SummaryStrip
        label="Tín chỉ"
        items={[
          { label: 'Bắt buộc', value: 120 },
          { label: 'Lệch', value: 3, tone: 'warning' },
        ]}
      />,
    );
    const group = screen.getByRole('group', { name: 'Tín chỉ' });
    expect(within(group).getByText('Bắt buộc')).toBeInTheDocument();
    expect(within(group).getByText('120')).toBeInTheDocument();
    expect(within(group).getByText('3')).toBeInTheDocument();
  });
});
