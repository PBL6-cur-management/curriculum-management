import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RequireAnyPermission } from './RequireAnyPermission';
import { PERMISSIONS } from './permissions';

const useMe = vi.hoisted(() => vi.fn());
vi.mock('./useMe', () => ({ useMe }));

const FORBIDDEN = 'Bạn không có quyền truy cập trang này';

function renderGuard(
  codes: Parameters<typeof RequireAnyPermission>[0]['codes'],
) {
  render(<RequireAnyPermission codes={codes}>Nội dung</RequireAnyPermission>);
}

describe('RequireAnyPermission', () => {
  beforeEach(() => useMe.mockReset());

  it('renders children when one of the codes is held', () => {
    useMe.mockReturnValue({
      data: { permissions: [PERMISSIONS.gradingFormulaEdit] },
    });
    renderGuard([PERMISSIONS.syllabusEdit, PERMISSIONS.gradingFormulaEdit]);
    expect(screen.getByText('Nội dung')).toBeInTheDocument();
  });

  it('shows forbidden when none is held', () => {
    useMe.mockReturnValue({ data: { permissions: [PERMISSIONS.userManage] } });
    renderGuard([PERMISSIONS.syllabusEdit, PERMISSIONS.cloEdit]);
    expect(screen.getByText(FORBIDDEN)).toBeInTheDocument();
  });

  it('denies an empty list and an unloaded session', () => {
    useMe.mockReturnValue({
      data: { permissions: [PERMISSIONS.syllabusEdit] },
    });
    renderGuard([]);
    expect(screen.getByText(FORBIDDEN)).toBeInTheDocument();
  });
});
