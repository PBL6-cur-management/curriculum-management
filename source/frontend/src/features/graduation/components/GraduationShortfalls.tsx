import { Collapse, List, Typography } from 'antd';
import { EmptyState } from '../../../shared/design-system';
import type { GraduationResult } from '../schema/graduation';
import { SHORTFALL_LABELS } from '../constants/graduationLabels';
import { displayCredits } from './graduationPresentation';

interface GraduationShortfallsProps {
  shortfalls: GraduationResult['shortfalls'];
}
const SECTIONS = [
  { category: 'MANDATORY_COURSE', label: 'Học phần bắt buộc' },
  { category: 'ELECTIVE_GROUP', label: 'Nhóm tự chọn' },
  { category: 'TOTAL_CREDITS', label: 'Tổng tín chỉ' },
  { category: 'CONDITIONAL_COURSE', label: 'Học phần điều kiện' },
] as const;
function shortfallDetail(item: GraduationResult['shortfalls'][number]): string {
  switch (item.code) {
    case 'MANDATORY_COURSE_MISSING':
    case 'CONDITIONAL_COURSE_MISSING':
      return `${item.course.courseCode} — ${item.course.courseName}. ${item.message}`;
    case 'ELECTIVE_CREDITS_MISSING':
      return `${item.groupCode} — ${item.groupName}: yêu cầu ${displayCredits(item.requiredCredits)}, đã đạt ${displayCredits(item.earnedCredits)}, còn thiếu ${displayCredits(item.missingCredits)} tín chỉ. ${item.message}`;
    case 'ELECTIVE_COURSES_MISSING':
      return `${item.groupCode} — ${item.groupName}: yêu cầu ${item.requiredCourses}, đã đạt ${item.earnedCourses}, còn thiếu ${item.missingCourses} học phần. ${item.message}`;
    case 'TOTAL_CREDITS_MISSING':
      return `Yêu cầu ${displayCredits(item.requiredCredits)}, đã đạt ${displayCredits(item.earnedCredits)}, còn thiếu ${displayCredits(item.missingCredits)} tín chỉ. ${item.message}`;
  }
}
export function GraduationShortfalls({
  shortfalls,
}: GraduationShortfallsProps) {
  return (
    <>
      {!shortfalls.length && (
        <EmptyState description="Không còn thiếu hạng mục nào" />
      )}
      <Collapse
        defaultActiveKey={SECTIONS.map((section) => section.category)}
        items={SECTIONS.map((section) => ({
          key: section.category,
          label: (
            <Typography.Title level={4} style={{ margin: 0 }}>
              {section.label}
            </Typography.Title>
          ),
          children: (
            <List
              dataSource={shortfalls.filter(
                (item) => item.category === section.category,
              )}
              locale={{ emptyText: 'Không thiếu hạng mục trong nhóm này' }}
              renderItem={(item) => (
                <List.Item>
                  <List.Item.Meta
                    title={SHORTFALL_LABELS[item.code]}
                    description={shortfallDetail(item)}
                  />
                </List.Item>
              )}
            />
          ),
        }))}
      />
    </>
  );
}
