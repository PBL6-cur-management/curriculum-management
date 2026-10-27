import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { batch, renderImport } from '../testFixtures';
import { ImportReport } from './ImportReport';
import { CommitImportButton } from './CommitImportButton';

describe('ImportReport', () => {
  it('shows source row 15 and groups all three severities with the column', () => {
    renderImport(
      <ImportReport
        batch={batch({
          errorRows: 1,
          canCommit: false,
          report: {
            formatErrors: [],
            issues: [
              {
                rowNumber: 15,
                column: 'Mã HP',
                code: 'COURSE_UNKNOWN',
                severity: 'ERROR',
                message: 'Mã HP ABC không tồn tại.',
              },
              {
                rowNumber: 2,
                column: 'Số TC',
                code: 'ZERO_CREDITS',
                severity: 'HIGH',
                message: 'Không tín chỉ.',
              },
              {
                rowNumber: null,
                column: null,
                code: 'UNKNOWN_COLUMN',
                severity: 'INFO',
                message: 'Bỏ qua cột lạ.',
              },
            ],
          },
        })}
      />,
    );
    expect(
      screen.getByText('Dòng 15: LỖI — Mã HP ABC không tồn tại.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Cột: Mã HP')).toBeInTheDocument();
    expect(screen.getByText('CẢNH BÁO', { exact: true })).toBeInTheDocument();
    expect(
      screen.getByText('Toàn tệp: LƯU Ý — Bỏ qua cột lạ.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Tổng: 2 · Hợp lệ: 2 · Lỗi: 1'),
    ).toBeInTheDocument();
  });
  it('shows format errors and disables confirmation even if canCommit is stale', () => {
    const data = batch({
      report: {
        formatErrors: [{ column: 'Học kỳ', message: 'Thiếu cột bắt buộc.' }],
        issues: [],
      },
    });
    renderImport(
      <>
        <ImportReport batch={data} />
        <CommitImportButton batch={data} />
      </>,
    );
    expect(screen.getByText('Học kỳ: Thiếu cột bắt buộc.')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Xác nhận nhập' }),
    ).toBeDisabled();
  });
  it('does not present a transient batch as a successful zero-row report', () => {
    renderImport(
      <ImportReport batch={batch({ status: 'VALIDATING', report: null })} />,
    );
    expect(screen.getByText('Đang chạy thử')).toBeInTheDocument();
    expect(screen.queryByText(/Tổng:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Tệp không có lỗi/)).not.toBeInTheDocument();
  });
  it('allows warnings but blocks errors, expired files and terminal batches', () => {
    const data = batch({
      report: {
        formatErrors: [],
        issues: [
          {
            severity: 'HIGH',
            rowNumber: 2,
            column: null,
            code: 'ZERO',
            message: 'Không tín chỉ.',
          },
        ],
      },
    });
    renderImport(<CommitImportButton batch={data} />);
    expect(screen.getByRole('button', { name: 'Xác nhận nhập' })).toBeEnabled();
  });
  it.each([
    batch({ status: 'ABORTED' }),
    batch({ status: 'COMMITTED' }),
    batch({ status: 'COMMITTING' }),
    batch({ status: 'VALIDATING' }),
    batch({ fileAvailable: false }),
    batch({ canCommit: false }),
    batch({
      report: {
        formatErrors: [],
        issues: [
          {
            severity: 'ERROR',
            rowNumber: 15,
            column: 'Mã HP',
            code: 'UNKNOWN',
            message: 'Không tồn tại.',
          },
        ],
      },
    }),
  ])('blocks confirmation for a non-committable report %#', (data) => {
    renderImport(<CommitImportButton batch={data} />);
    expect(
      screen.getByRole('button', { name: 'Xác nhận nhập' }),
    ).toBeDisabled();
  });
});
