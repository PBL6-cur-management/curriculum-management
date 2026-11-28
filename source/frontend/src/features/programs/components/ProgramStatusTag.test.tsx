import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProgramStatusTag } from './ProgramStatusTag';

describe('ProgramStatusTag', () => {
  it('shows "Đang soạn thảo" for an active program without released version', () => {
    render(<ProgramStatusTag status="ACTIVE" hasReleasedVersion={false} />);
    expect(screen.getByText('Đang soạn thảo')).toBeInTheDocument();
  });

  it('shows "Đang đào tạo" for an active program with a released version', () => {
    render(<ProgramStatusTag status="ACTIVE" hasReleasedVersion />);
    expect(screen.getByText('Đang đào tạo')).toBeInTheDocument();
  });

  it('defaults to "Đang đào tạo" when hasReleasedVersion is omitted', () => {
    render(<ProgramStatusTag status="ACTIVE" />);
    expect(screen.getByText('Đang đào tạo')).toBeInTheDocument();
  });

  it('shows "Ngừng sử dụng" for an inactive program', () => {
    render(<ProgramStatusTag status="INACTIVE" hasReleasedVersion={false} />);
    expect(screen.getByText('Ngừng sử dụng')).toBeInTheDocument();
  });
});
