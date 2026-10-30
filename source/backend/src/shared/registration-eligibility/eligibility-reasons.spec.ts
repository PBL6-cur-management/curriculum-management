import { ELIGIBILITY_REASON_CODES } from './eligibility.constants.js';
import {
  eligibilityReason,
  eligibilityStatusText,
} from './eligibility-reasons.js';
import { eligibilityFixture } from './eligibility.test-fixtures.js';

describe('eligibility vocabulary', () => {
  it.each(ELIGIBILITY_REASON_CODES)(
    'renders structured %s without undefined fields',
    (code) => {
      const course = eligibilityFixture().rows[0].course;
      const reason = eligibilityReason(
        code,
        {
          requiredCourse: course,
          evidenceCourse: course,
          viaCourse: course,
          requiredScore4: '2.5',
          actualScore4: '2.49',
          causeCode:
            code === 'COREQUISITE_INELIGIBLE'
              ? 'PREREQUISITE_SCORE_TOO_LOW'
              : null,
        },
        { maxDepth: 20 },
      );
      expect(reason.message.length).toBeGreaterThan(0);
      expect(reason.message).not.toContain('undefined');
    },
  );
  it('has four distinct server-owned status texts', () => {
    expect([
      eligibilityStatusText(true, null),
      eligibilityStatusText(false, 'ELIGIBLE'),
      eligibilityStatusText(false, 'CONDITIONAL'),
      eligibilityStatusText(false, 'INELIGIBLE'),
    ]).toEqual(['Đã hoàn thành', 'Được', 'Được có điều kiện', 'Không được']);
  });
});
