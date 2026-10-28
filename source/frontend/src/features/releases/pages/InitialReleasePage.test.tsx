import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReleaseCheck } from '../api/releases';
import {
  json,
  renderReleasePage,
  SEMESTER,
  versionDetail,
} from '../testRender';
import { InitialReleasePage } from './InitialReleasePage';

const CHECK_URL = '/api/programs/p1/versions/v1/release-check';
const SEMESTERS = [
  SEMESTER,
  { ...SEMESTER, id: 's2', semesterCode: 'CHUA-CO-NGAY', startDate: null },
];

const check = (patch: Partial<ReleaseCheck> = {}): ReleaseCheck => ({
  versionId: 'v1',
  canRelease: true,
  consistencyIssues: [],
  syllabusIssues: [],
  ...patch,
});

function renderPage(
  data: ReleaseCheck,
  writeResponse?: Parameters<typeof renderReleasePage>[0]['writeResponse'],
) {
  return renderReleasePage({
    path: '/programs/:programId/versions/:versionId/release',
    entry: '/programs/p1/versions/v1/release',
    element: <InitialReleasePage />,
    permissions: ['version.publish', 'program.view'],
    reads: {
      [CHECK_URL]: data,
      '/api/semesters': SEMESTERS,
      '/api/cohorts': [{ id: 'k1', cohortCode: 'K2026', intakeYear: 2026 }],
    },
    writeResponse,
    extraRoutes: [
      {
        path: '/programs/:programId/versions/:versionId',
        element: <p>Chi tiết phiên bản</p>,
      },
    ],
  });
}

async function fillAndSubmit() {
  fireEvent.change(await screen.findByLabelText('Số quyết định'), {
    target: { value: 'QĐ-100/2026' },
  });
  fireEvent.mouseDown(screen.getByLabelText('Học kỳ hiệu lực'));
  fireEvent.click(await screen.findByText('2026-2027-2 · 2027-01-18'));
  const date = screen.getByLabelText('Ngày ký');
  fireEvent.mouseDown(date);
  fireEvent.change(date, { target: { value: '01/09/2026' } });
  fireEvent.keyDown(date, { key: 'Enter' });
  fireEvent.click(screen.getByRole('button', { name: 'Ban hành' }));
}

afterEach(() => vi.unstubAllGlobals());

describe('InitialReleasePage (MH-45)', () => {
  it('defaults the number to 1.0 and enables the release when the check passes', async () => {
    renderPage(check());

    expect(await screen.findByDisplayValue('1.0')).toBeInTheDocument();
    expect(
      await screen.findByText(/Đủ điều kiện ban hành/),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ban hành' })).toBeEnabled();
  });

  it('blocks on an Error and on a missing or incomplete syllabus, naming each course (US-071 AC5, KB-039)', async () => {
    renderPage(
      check({
        canRelease: false,
        consistencyIssues: [
          {
            code: 'DUPLICATE_COURSE',
            severity: 'ERROR',
            message: 'Học phần IT001 xuất hiện hai lần.',
            semester: null,
            itemId: null,
            groupId: null,
          },
          {
            code: 'MISSING_SYLLABUS',
            severity: 'ERROR',
            message: 'Học phần IT002 chưa có đề cương.',
            semester: 1,
            itemId: 'i2',
            groupId: null,
          },
        ],
        syllabusIssues: [
          {
            courseId: 'c2',
            courseCode: 'IT002',
            code: 'MISSING_SYLLABUS',
            details: [],
          },
          {
            courseId: 'c3',
            courseCode: 'IT003',
            code: 'SYLLABUS_INCOMPLETE',
            details: [
              'COURSE_DESCRIPTION_EMPTY',
              'OBJECTIVES_EMPTY',
              'ASSESSMENT_FORMULA_EMPTY',
              'ASSESSMENT_CLO_UNCOVERED',
            ],
          },
        ],
      }),
    );

    expect(
      await screen.findByText('Học phần IT001 xuất hiện hai lần.'),
    ).toBeInTheDocument();
    // The missing syllabus is listed once, under the syllabi.
    expect(screen.queryByText('Học phần IT002 chưa có đề cương.')).toBeNull();
    expect(screen.getByText(/Chưa có đề cương/)).toBeInTheDocument();
    expect(
      screen.getByText(
        /chưa có mô tả học phần; chưa có mục tiêu học phần; chưa khai báo công thức điểm; còn CLO chưa được đánh giá/,
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ban hành' })).toBeDisabled();
  });

  it('shows Warnings without blocking', async () => {
    renderPage(
      check({
        consistencyIssues: [
          {
            code: 'CREDIT_MISMATCH',
            severity: 'HIGH',
            message: 'Tín chỉ khai báo 150, tính từ khung 148.',
            semester: null,
            itemId: null,
            groupId: null,
          },
        ],
      }),
    );

    expect(
      await screen.findByText('Tín chỉ khai báo 150, tính từ khung 148.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ban hành' })).toBeEnabled();
  });

  it('lists a semester without a start date but does not let it be chosen', async () => {
    renderPage(check());

    fireEvent.mouseDown(await screen.findByLabelText('Học kỳ hiệu lực'));

    const option = await screen.findByText(
      'CHUA-CO-NGAY · Chưa có ngày bắt đầu',
    );
    expect(option.closest('.ant-select-item')).toHaveClass(
      'ant-select-item-option-disabled',
    );
  });

  it('asks again before releasing and sends nothing when cancelled', async () => {
    const { writes } = renderPage(check());

    await fillAndSubmit();
    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getByText('Ban hành phiên bản này?'),
    ).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Hủy' }));

    // Nothing was sent after cancelling.
    expect(writes).toEqual([]);
  });

  it('releases with date-only strings and opens the issued version', async () => {
    const { writes } = renderPage(check(), () =>
      json(versionDetail({ id: 'v1' }), 201),
    );

    await fillAndSubmit();
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Ban hành' }));

    expect(await screen.findByText('Chi tiết phiên bản')).toBeInTheDocument();
    expect(writes).toEqual([
      {
        method: 'POST',
        url: '/api/programs/p1/versions/v1/release',
        body: {
          versionNumber: '1.0',
          decisionNumber: 'QĐ-100/2026',
          signedDate: '2026-09-01',
          effectiveSemesterId: 's1',
          cohortIds: [],
        },
      },
    ]);
  });

  it('refreshes the check when the server refuses (something moved since the preview)', async () => {
    const { reads } = renderPage(check(), () =>
      json(
        {
          code: 'SYLLABUS_INCOMPLETE',
          message: 'Có đề cương chưa đủ điều kiện ban hành.',
        },
        409,
      ),
    );

    await fillAndSubmit();
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Ban hành' }));

    expect(
      await screen.findByText('Có đề cương chưa đủ điều kiện ban hành.'),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(reads.filter((url) => url === CHECK_URL).length).toBeGreaterThan(
        1,
      ),
    );
  });

  it('refuses a malformed number without sending anything', async () => {
    const { writes } = renderPage(check());

    fireEvent.change(await screen.findByLabelText('Số phiên bản'), {
      target: { value: '1' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Ban hành' }));

    expect(
      await screen.findAllByText('Số phiên bản có dạng Chính.Phụ, ví dụ 1.0.'),
    ).not.toHaveLength(0);
    expect(writes).toEqual([]);
  });
});
