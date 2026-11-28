import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { eligibleGraduation, shortfallGraduation } from '../testRender';
import { GraduationResultView } from './GraduationResultView';
import { displayCredits } from './graduationPresentation';

describe('read-only graduation presentation without staff providers', () => {
  it('renders the four rule headings and both elective gaps, including the zero-credit condition', () => {
    render(<GraduationResultView result={shortfallGraduation} />);
    for (const name of [
      'Học phần bắt buộc',
      'Nhóm tự chọn',
      'Tổng tín chỉ',
      'Học phần điều kiện',
    ])
      expect(screen.getByRole('heading', { name })).toBeInTheDocument();
    expect(screen.getByText(/còn thiếu 4 tín chỉ/)).toBeInTheDocument();
    expect(screen.getByText(/còn thiếu 2 học phần/)).toBeInTheDocument();
    expect(
      screen.getByText(/Học phần điều kiện 0 tín chỉ/),
    ).toBeInTheDocument();
  });
  it('keeps warning-only eligibility, historic/exception identity and advisory minima distinct', () => {
    render(
      <GraduationResultView
        result={{
          ...eligibleGraduation,
          context: {
            ...eligibleGraduation.context,
            versionSource: 'EXCEPTION',
            versionNumber: '0.9',
          },
          warnings: [
            {
              code: 'CURRENT_CATALOG_CREDIT_BASIS',
              curriculumItemId: null,
              courseId: 'course',
              creditGap: null,
              message: 'Dùng tín chỉ danh mục hiện tại.',
            },
          ],
        }}
      />,
    );
    expect(screen.getByText('Đủ điều kiện')).toBeInTheDocument();
    expect(
      screen.getByText('Không còn thiếu hạng mục nào'),
    ).toBeInTheDocument();
    expect(screen.getByText('0.9 · Ngoại lệ')).toBeInTheDocument();
    expect(
      screen.getByText('Tham khảo, không phải điều kiện xét riêng'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Dùng tín chỉ danh mục hiện tại.'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Lưu lần xét' }),
    ).not.toBeInTheDocument();
  });
  it('shows a 3-to-2 equivalent as completed while retaining the server credit shortfall', () => {
    render(
      <GraduationResultView
        result={{
          ...eligibleGraduation,
          conclusion: 'NOT_ELIGIBLE',
          recognitions: [
            {
              ...eligibleGraduation.recognitions[0],
              requiredCredits: '3',
              recognizedCredits: '2',
            },
          ],
          shortfalls: [
            {
              code: 'TOTAL_CREDITS_MISSING',
              category: 'TOTAL_CREDITS',
              requiredCredits: '3',
              earnedCredits: '2',
              missingCredits: '1',
              message: 'Còn thiếu một tín chỉ.',
            },
          ],
          warnings: [
            {
              code: 'EQUIVALENT_CREDIT_GAP',
              curriculumItemId: 'item',
              courseId: 'old-course',
              creditGap: '1',
              message: 'Học phần tương đương thiếu một tín chỉ.',
            },
          ],
          freeCredits: [
            {
              course: eligibleGraduation.recognitions[0].studiedCourse,
              attemptId: 'outside',
              credits: '0.125',
              creditBasis: 'CURRENT_CATALOG',
              reason: 'OUTSIDE_FRAME',
            },
          ],
        }}
      />,
    );
    expect(screen.getByText('Tương đương · Đã đạt')).toBeInTheDocument();
    expect(screen.getByText('3 / 2')).toBeInTheDocument();
    expect(
      screen.getByText('Học phần tương đương thiếu một tín chỉ.'),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Thiếu học phần bắt buộc'),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Học phần ngoài khung')).toBeInTheDocument();
    expect(screen.getByText('0,125')).toBeInTheDocument();
    expect(displayCredits('12345678901234567890.123456789')).toBe(
      '12345678901234567890,123456789',
    );
  });
  it('renders cumulative GPA vs minimum GPA and LOW_GPA / TRACK_NOT_SELECTED shortfalls', () => {
    render(
      <GraduationResultView
        result={{
          ...eligibleGraduation,
          conclusion: 'NOT_ELIGIBLE',
          cumulativeGpa: '1.85',
          minGraduationGpa: '2.00',
          shortfalls: [
            {
              code: 'LOW_GPA',
              category: 'GPA',
              actualGpa: '1.85',
              requiredGpa: '2.00',
              message: 'Điểm trung bình tích lũy thấp hơn chuẩn tốt nghiệp.',
            },
            {
              code: 'TRACK_NOT_SELECTED',
              category: 'TRACK',
              message: 'Sinh viên chưa đăng ký chuyên ngành con.',
            },
          ],
        }}
      />,
    );
    expect(screen.getByText('1.85 / 2.00')).toBeInTheDocument();
    expect(
      screen.getByText('GPA tích lũy chưa đạt mức tối thiểu'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /GPA tích lũy đạt 1.85, yêu cầu tối thiểu 2.00\. Điểm trung bình tích lũy thấp hơn chuẩn tốt nghiệp\./,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Chưa chọn định hướng / chuyên ngành con'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Sinh viên chưa đăng ký chuyên ngành con.'),
    ).toBeInTheDocument();
  });
});
