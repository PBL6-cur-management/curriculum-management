import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  assessmentComponent,
  clo,
  gradeFormula,
  syllabus,
} from '../testFixtures';
import { GradeFormulaView } from './GradeFormulaView';

const UNCOVERED = {
  code: 'ASSESSMENT_CLO_UNCOVERED',
  cloId: 'k2',
  cloCode: 'CLO2',
  message: 'x',
} as const;

describe('GradeFormulaView', () => {
  it('says plainly that a legacy revision has no formula', () => {
    render(<GradeFormulaView syllabus={syllabus({ status: 'PUBLISHED' })} />);
    expect(
      screen.getByText('Chưa khai báo công thức điểm cho bản đề cương này.'),
    ).toBeInTheDocument();
  });

  it('shows the components, the cutoff, the conditional explanation and the mapping', () => {
    render(
      <GradeFormulaView
        syllabus={syllabus({
          clos: [clo('k1', 1), clo('k2', 2)],
          gradingFormula: gradeFormula(
            [
              assessmentComponent('ck', {
                componentName: 'Cuối kỳ',
                isConditional: true,
                conditionThreshold: '4',
                mappings: [{ cloId: 'k1', cloWeight: '60' }],
              }),
            ],
            { failingScore: '3', warnings: [UNCOVERED] },
          ),
        })}
      />,
    );
    expect(screen.getByText('Cuối kỳ')).toBeInTheDocument();
    expect(screen.getByText(/Có — ngưỡng 4/)).toBeInTheDocument();
    expect(screen.getAllByText(/bất kể điểm tổng/).length).toBeGreaterThan(0);
    expect(
      screen.getByText(/Chưa có thành phần đánh giá nào ánh xạ tới: CLO2/),
    ).toBeInTheDocument();
    expect(screen.getByText('CLO1')).toBeInTheDocument();
  });

  it('hides the coverage warning once the revision is not a Draft', () => {
    render(
      <GradeFormulaView
        syllabus={syllabus({
          status: 'PUBLISHED',
          gradingFormula: gradeFormula([assessmentComponent('ck')], {
            warnings: [UNCOVERED],
          }),
        })}
      />,
    );
    expect(screen.queryByText(/ánh xạ tới/)).not.toBeInTheDocument();
  });
});
