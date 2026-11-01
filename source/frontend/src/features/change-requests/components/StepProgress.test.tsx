import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ApprovalStep } from '../api/changeRequests';
import { step } from '../testFixtures';
import { groupByLevel } from '../utils/groupByLevel';
import { StepProgress } from './StepProgress';

describe('StepProgress', () => {
  it('shows one line per approver of a level, so two coordinators of one group show two lines (EC-22)', () => {
    render(
      <StepProgress
        steps={[
          step('1', 1, {
            approver: { id: 'a', fullName: 'Điều phối An' },
            forSubjectGroup: { id: 'g', groupCode: 'G1', groupName: 'Nhóm 1' },
          }),
          step('2', 1, {
            approver: { id: 'b', fullName: 'Điều phối Bình' },
            forSubjectGroup: { id: 'g', groupCode: 'G1', groupName: 'Nhóm 1' },
          }),
          step('3', 3, { approver: null }),
        ]}
      />,
    );
    expect(
      screen.getByText('Cấp 1 — Điều phối nhóm chuyên môn'),
    ).toBeInTheDocument();
    expect(screen.getByText('Điều phối An')).toBeInTheDocument();
    expect(screen.getByText('Điều phối Bình')).toBeInTheDocument();
    expect(screen.getAllByText('(G1)')).toHaveLength(2);
    expect(
      screen.getByText('Phòng Đào tạo', { selector: 'span' }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Cấp 2/)).not.toBeInTheDocument();
  });

  it('marks a skipped row with its reason and an approved one with its time', () => {
    render(
      <StepProgress
        steps={[
          step('1', 2, {
            isSkipped: true,
            action: 'APPROVE',
            skipReason: 'Người duyệt là người tạo đề xuất',
          }),
          step('2', 3, {
            approver: null,
            action: 'APPROVE',
            recordedAt: '2026-10-19T03:30:00.000Z',
          }),
        ]}
      />,
    );
    expect(screen.getByText('Bỏ qua')).toBeInTheDocument();
    expect(
      screen.getByText('Người duyệt là người tạo đề xuất'),
    ).toBeInTheDocument();
    expect(screen.getByText('Đã duyệt')).toBeInTheDocument();
  });
});

describe('StepProgress merging', () => {
  it('shows one director of many programmes as one line naming them', () => {
    const director = { id: 'd', fullName: 'Tài khoản demo' };
    render(
      <StepProgress
        steps={['A', 'B', 'C', 'D', 'E'].map((code, index) =>
          step(String(index), 2, {
            approver: director,
            forProgram: { id: code, programCode: `CNTT-${code}` },
          } as Partial<ApprovalStep>),
        )}
      />,
    );
    expect(screen.getAllByText('Tài khoản demo')).toHaveLength(1);
    expect(
      screen.getByText('(5 CTĐT: CNTT-A, CNTT-B, CNTT-C và 2 CTĐT khác)'),
    ).toBeInTheDocument();
  });

  it('keeps two directors apart and names nobody for a skipped level-1 row', () => {
    render(
      <StepProgress
        steps={[
          step('1', 1, {
            approver: null,
            isSkipped: true,
            skipReason: 'Đề xuất không thay đổi học phần nào',
          }),
          step('2', 2, { approver: { id: 'x', fullName: 'GĐ X' } }),
          step('3', 2, { approver: { id: 'y', fullName: 'GĐ Y' } }),
        ]}
      />,
    );
    expect(screen.getByText('Không có người duyệt')).toBeInTheDocument();
    expect(screen.queryByText('Phòng Đào tạo')).not.toBeInTheDocument();
    expect(screen.getByText('GĐ X')).toBeInTheDocument();
    expect(screen.getByText('GĐ Y')).toBeInTheDocument();
  });
});

describe('groupByLevel', () => {
  it('orders the levels and keeps only those that have rows', () => {
    const groups = groupByLevel([step('3', 3), step('1', 1), step('1b', 1)]);
    expect(
      groups.map((group) => [group.approvalLevel, group.rows.length]),
    ).toEqual([
      [1, 2],
      [3, 1],
    ]);
  });

  it('names both people on an override row and tags it', () => {
    render(
      <StepProgress
        steps={[
          step('1', 1, {
            approver: { id: 'a', fullName: 'Điều phối An' },
            action: 'APPROVE',
            isOverride: true,
            kind: 'OVERRIDE',
            performedBy: { id: 'o', fullName: 'Chuyên viên Phòng ĐT' },
            recordedAt: '2026-10-19T03:30:00.000Z',
          }),
        ]}
      />,
    );
    expect(screen.getByText('Phòng Đào tạo duyệt thay')).toBeInTheDocument();
    expect(
      screen.getByText(
        /Người duyệt: Điều phối An · Thực hiện: Chuyên viên Phòng ĐT/,
      ),
    ).toBeInTheDocument();
  });
});
