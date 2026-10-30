import { Alert, Card, Descriptions, Flex, Table, Typography } from 'antd';
import { StatusTag } from '../../../shared/design-system';
import type { GraduationResult } from '../schema/graduation';
import {
  CONCLUSION_COLORS,
  CONCLUSION_LABELS,
  CREDIT_BASIS_LABELS,
  FREE_CREDIT_LABELS,
  WARNING_LABELS,
} from '../constants/graduationLabels';
import { displayCredits, displayTime } from './graduationPresentation';
import { GraduationShortfalls } from './GraduationShortfalls';

interface GraduationResultViewProps {
  result: GraduationResult;
}
export function GraduationResultView({ result }: GraduationResultViewProps) {
  if (result.schemaVersion !== 1 || result.ruleVersion !== 'graduation-v1')
    return (
      <Alert
        type="warning"
        showIcon
        title="Chưa hỗ trợ phiên bản kết quả này"
        description="Liên hệ Phòng Đào tạo để kiểm tra phiên bản dữ liệu; không thể hiển thị kết luận an toàn."
      />
    );
  const context = result.context;
  return (
    <Flex vertical gap="middle">
      <Card
        title={`${context.studentCode} — ${context.fullName}`}
        extra={
          <StatusTag
            status={result.conclusion}
            labelMap={CONCLUSION_LABELS}
            colorMap={CONCLUSION_COLORS}
          />
        }
      >
        <Descriptions
          column={{ xs: 1, md: 2 }}
          items={[
            {
              key: 'program',
              label: 'Chương trình',
              children: `${context.programCode} — ${context.programName}`,
            },
            { key: 'cohort', label: 'Khóa', children: context.cohortCode },
            {
              key: 'semester',
              label: 'Học kỳ xét',
              children: context.semesterCode,
            },
            {
              key: 'version',
              label: 'Phiên bản áp dụng',
              children: `${context.versionNumber} · ${context.versionSource === 'COHORT' ? 'Theo khóa' : 'Ngoại lệ'}`,
            },
            {
              key: 'time',
              label: 'Thời điểm đánh giá',
              children: displayTime(result.evaluatedAt),
            },
            {
              key: 'credits',
              label: 'Tổng tín chỉ yêu cầu / công nhận / còn thiếu',
              children: `${displayCredits(result.credits.requiredTotal)} / ${displayCredits(result.credits.recognizedTotal)} / ${displayCredits(result.credits.missingTotal)}`,
            },
            {
              key: 'allocation',
              label: 'Bắt buộc / tự chọn / tự do',
              children: `${displayCredits(result.credits.compulsory)} / ${displayCredits(result.credits.elective)} / ${displayCredits(result.credits.free)}`,
            },
          ]}
        />
      </Card>
      {result.warnings.map((warning, index) => (
        <Alert
          key={`${warning.code}-${index}`}
          type="warning"
          showIcon
          title={WARNING_LABELS[warning.code]}
          description={warning.message}
        />
      ))}
      <GraduationShortfalls shortfalls={result.shortfalls} />
      <Typography.Title level={4}>Tiến độ nhóm tự chọn</Typography.Title>
      <Table
        rowKey="groupId"
        dataSource={result.electiveGroups}
        pagination={false}
        scroll={{ x: 'max-content' }}
        locale={{ emptyText: 'Phiên bản này không có nhóm tự chọn' }}
        columns={[
          {
            title: 'Nhóm',
            render: (_, group) => `${group.groupCode} — ${group.groupName}`,
          },
          {
            title: 'Tín chỉ yêu cầu / đạt / thiếu',
            render: (_, group) =>
              `${displayCredits(group.requiredCredits)} / ${displayCredits(group.earnedCredits)} / ${displayCredits(group.missingCredits)}`,
          },
          {
            title: 'Số học phần yêu cầu / đạt / thiếu',
            render: (_, group) =>
              `${group.requiredCourses ?? 'Không quy định'} / ${group.earnedCourses} / ${group.missingCourses ?? 'Không quy định'}`,
          },
        ]}
      />
      <Typography.Title level={4}>Phân bổ khối kiến thức</Typography.Title>
      <Alert
        type="info"
        showIcon
        title="Tham khảo, không phải điều kiện xét riêng"
        description="Mức tối thiểu theo danh mục hiện tại không tạo thêm điều kiện tốt nghiệp ngoài các kiểm tra đã công bố."
      />
      <Table
        rowKey={(block) => block.blockSymbol ?? 'unassigned'}
        dataSource={result.knowledgeBlocks}
        pagination={false}
        scroll={{ x: 'max-content' }}
        locale={{ emptyText: 'Chưa có phân bổ khối kiến thức' }}
        columns={[
          {
            title: 'Khối',
            render: (_, block) =>
              `${block.blockSymbol ?? 'Chưa phân khối'} — ${block.blockName ?? 'Chưa có tên'}`,
          },
          {
            title: 'Đã đạt',
            render: (_, block) => displayCredits(block.earnedCredits),
          },
          {
            title: 'Bắt buộc / tự chọn',
            render: (_, block) =>
              `${displayCredits(block.compulsoryCredits)} / ${displayCredits(block.electiveCredits)}`,
          },
          {
            title: 'Mức tham khảo / chênh lệch',
            render: (_, block) =>
              `${displayCredits(block.catalogRequiredCredits)} / ${displayCredits(block.advisoryGap)}`,
          },
        ]}
      />
      <Typography.Title level={4}>Học phần được công nhận</Typography.Title>
      <Table
        rowKey="curriculumItemId"
        dataSource={result.recognitions}
        pagination={false}
        scroll={{ x: 'max-content' }}
        locale={{ emptyText: 'Chưa có học phần được công nhận' }}
        columns={[
          {
            title: 'Học phần yêu cầu',
            render: (_, item) =>
              `${item.requiredCourse.courseCode} — ${item.requiredCourse.courseName}`,
          },
          {
            title: 'Học phần đã học',
            render: (_, item) =>
              `${item.studiedCourse.courseCode} — ${item.studiedCourse.courseName}`,
          },
          {
            title: 'Công nhận',
            render: (_, item) =>
              `${item.viaEquivalence ? 'Tương đương' : 'Đúng học phần'} · ${item.completionStatus === 'EXEMPT' ? 'Miễn học' : 'Đã đạt'}`,
          },
          {
            title: 'Tín chỉ yêu cầu / công nhận',
            render: (_, item) =>
              `${displayCredits(item.requiredCredits)} / ${displayCredits(item.recognizedCredits)}`,
          },
          {
            title: 'Cơ sở tín chỉ',
            render: (_, item) => CREDIT_BASIS_LABELS[item.creditBasis],
          },
        ]}
      />
      <Typography.Title level={4}>Tín chỉ tự do</Typography.Title>
      <Table
        rowKey="attemptId"
        dataSource={result.freeCredits}
        pagination={false}
        scroll={{ x: 'max-content' }}
        locale={{ emptyText: 'Không có tín chỉ tự do' }}
        columns={[
          {
            title: 'Học phần',
            render: (_, item) =>
              `${item.course.courseCode} — ${item.course.courseName}`,
          },
          {
            title: 'Tín chỉ',
            render: (_, item) => displayCredits(item.credits),
          },
          {
            title: 'Nguồn',
            render: (_, item) => FREE_CREDIT_LABELS[item.reason],
          },
          {
            title: 'Cơ sở tín chỉ',
            render: (_, item) => CREDIT_BASIS_LABELS[item.creditBasis],
          },
        ]}
      />
    </Flex>
  );
}
