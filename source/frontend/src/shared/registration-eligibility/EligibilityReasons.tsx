import { Descriptions, Divider, Drawer, Flex, Typography } from 'antd';
import type { EligibilityItemView } from './eligibilityLabels';

export function EligibilityReasons({
  item,
  onClose,
}: {
  item: EligibilityItemView | null;
  onClose: () => void;
}) {
  return (
    <Drawer
      open={item !== null}
      onClose={onClose}
      title={`Điều kiện đăng ký — ${item?.course.courseCode ?? ''}`}
      size="large"
    >
      {item && (
        <Flex vertical gap="middle">
          <Typography.Text strong>
            {item.course.courseName} — {item.statusText}
          </Typography.Text>
          {item.requiredConcurrentCourses.length > 0 && (
            <section>
              <Typography.Title level={5}>Phải đăng ký cùng</Typography.Title>
              <ul>
                {item.requiredConcurrentCourses.map((course) => (
                  <li key={course.id}>
                    {course.courseCode} — {course.courseName}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {item.reasons.map((reason, index) => (
            <section key={`${reason.code}-${index}`}>
              <Typography.Paragraph>{reason.message}</Typography.Paragraph>
              <Descriptions
                size="small"
                column={1}
                items={[
                  {
                    key: 'required',
                    label: 'Học phần điều kiện',
                    children: reason.requiredCourse
                      ? `${reason.requiredCourse.courseCode} — ${reason.requiredCourse.courseName}`
                      : '—',
                  },
                  {
                    key: 'via',
                    label: 'Đi qua học phần song hành',
                    children: reason.viaCourse?.courseCode ?? '—',
                  },
                  {
                    key: 'threshold',
                    label: 'Ngưỡng thang 4',
                    children: reason.requiredScore4 ?? '—',
                  },
                  {
                    key: 'score',
                    label: 'Điểm được công nhận',
                    children: reason.actualScore4 ?? '—',
                  },
                  {
                    key: 'evidence',
                    label: 'Kết quả dùng để xét',
                    children: reason.evidenceCourse
                      ? `${reason.evidenceCourse.courseCode} · ${reason.actualStatus ?? '—'} · ${reason.evidenceResultId ?? '—'}`
                      : '—',
                  },
                  {
                    key: 'path',
                    label: 'Chuỗi điều kiện',
                    children:
                      reason.path
                        .map((course) => course.courseCode)
                        .join(' → ') || '—',
                  },
                  {
                    key: 'cause',
                    label: 'Nguyên nhân gốc',
                    children: reason.causeCode ?? reason.code,
                  },
                ]}
              />
              <Divider />
            </section>
          ))}
        </Flex>
      )}
    </Drawer>
  );
}
