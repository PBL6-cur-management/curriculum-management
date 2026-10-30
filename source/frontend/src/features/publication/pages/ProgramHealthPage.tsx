import {
  Alert,
  Card,
  Flex,
  Segmented,
  Table,
  Tag,
  Typography,
  type TableColumnsType,
} from 'antd';
import { useState } from 'react';
import { generatePath, Link, useParams } from 'react-router';
import { ROUTES } from '../../../routes';
import { versionLabel } from '../../../shared/constants/versionLabels';
import {
  BackLink,
  PageHeader,
  PageSkeleton,
  SummaryStrip,
} from '../../../shared/design-system';
import { errorMessage } from '../../../shared/forms/applyFieldErrors';
import type {
  HealthCategory,
  HealthIssue,
  HealthTarget,
} from '../api/publication';
import { PdfExportButton } from '../components/PdfExportButton';
import { useProgramHealth } from '../hooks/usePublication';

export const HEALTH_CATEGORY_LABELS: Record<HealthCategory, string> = {
  CREDIT: 'Tín chỉ',
  REQUISITE_ORDER: 'Thứ tự điều kiện',
  REQUISITE_OUTSIDE: 'Điều kiện ngoài khung',
  EMPTY_SEMESTER: 'Học kỳ trống',
  PLO_COVERAGE: 'Phủ chuẩn đầu ra',
  ASSESSMENT_CLO: 'Đánh giá CLO',
  SYLLABUS: 'Đề cương',
  REPLACEMENT: 'Học phần ngừng mở',
  OTHER: 'Khác',
};
const SEVERITY = {
  ERROR: { color: 'red', label: 'Lỗi' },
  HIGH: { color: 'orange', label: 'Cảnh báo' },
  INFO: { color: 'blue', label: 'Thông tin' },
} as const;

// Where each kind of issue is fixed: the version's own screens, or the course for its syllabus and replacement.
function repairLink(
  target: HealthTarget,
  issue: HealthIssue,
  programId: string,
  versionId: string,
): { to: string; label: string } | null {
  const params = { programId, versionId };
  switch (target) {
    case 'CURRICULUM':
      return {
        to: generatePath(ROUTES.curriculum, params),
        label: 'Khung chương trình',
      };
    case 'ELECTIVE_GROUPS':
      return {
        to: generatePath(ROUTES.electiveGroups, params),
        label: 'Nhóm tự chọn',
      };
    case 'VERSION_INFO':
      return {
        to: generatePath(ROUTES.consistency, params),
        label: 'Kiểm tra nhất quán',
      };
    case 'COURSE_PLO_MATRIX':
      return {
        to: generatePath(ROUTES.coursePloMatrix, params),
        label: 'Ma trận học phần–PLO',
      };
    case 'ITEM_CLO_PLO':
      return issue.itemId
        ? {
            to: generatePath(ROUTES.itemCloPlo, {
              ...params,
              itemId: issue.itemId,
            }),
            label: 'CLO–PLO của học phần',
          }
        : null;
    case 'SYLLABUS':
      return issue.courseId
        ? {
            to: generatePath(ROUTES.syllabus, { courseId: issue.courseId }),
            label: 'Đề cương học phần',
          }
        : null;
    case 'COURSE':
      return issue.courseId
        ? {
            to: generatePath(ROUTES.courseDetail, { courseId: issue.courseId }),
            label: 'Học phần',
          }
        : null;
    default:
      return null;
  }
}

// MH-28 — US-113: one list of everything worth fixing in a version, grouped by category, worst first.
export default function ProgramHealthPage() {
  const { programId = '', versionId = '' } = useParams();
  const health = useProgramHealth(programId, versionId);
  const [category, setCategory] = useState<HealthCategory | 'ALL'>('ALL');

  if (health.isPending) return <PageSkeleton />;
  if (!health.data)
    return (
      <Alert
        type="error"
        showIcon
        title={errorMessage(health.error, 'Không đọc được báo cáo sức khỏe.')}
      />
    );
  const data = health.data;
  const shown =
    category === 'ALL'
      ? data.issues
      : data.issues.filter((issue) => issue.category === category);
  const columns: TableColumnsType<HealthIssue> = [
    {
      title: 'Mức',
      key: 'severity',
      width: 110,
      render: (_, issue) => (
        <Tag color={SEVERITY[issue.severity].color}>
          {SEVERITY[issue.severity].label}
        </Tag>
      ),
    },
    {
      title: 'Nhóm',
      key: 'category',
      width: 170,
      render: (_, issue) => HEALTH_CATEGORY_LABELS[issue.category],
    },
    { title: 'Nội dung', dataIndex: 'message', key: 'message' },
    {
      title: 'HK',
      key: 'semester',
      width: 60,
      align: 'right',
      render: (_, issue) => issue.semester ?? '',
    },
    {
      title: 'Sửa ở',
      key: 'repair',
      width: 190,
      render: (_, issue) => {
        const link = repairLink(issue.target, issue, programId, versionId);
        return link ? <Link to={link.to}>{link.label}</Link> : null;
      },
    },
  ];

  return (
    <Flex vertical gap="middle">
      <BackLink
        to={generatePath(ROUTES.versionDetail, { programId, versionId })}
      >
        Phiên bản {versionLabel(data.version)}
      </BackLink>
      <PageHeader
        title="Sức khỏe chương trình"
        subtitle={`${data.version.programCode} — ${data.version.programName} · phiên bản ${versionLabel(data.version)}`}
        actions={
          <PdfExportButton programId={programId} versionId={versionId} />
        }
      />
      {!data.complete ? (
        <Alert
          type="warning"
          showIcon
          title="Báo cáo chưa đầy đủ"
          description="Một số nhóm kiểm tra chưa chạy được, nên không thể kết luận là không có cảnh báo."
        />
      ) : data.issues.length === 0 ? (
        <Alert type="success" showIcon title="Không có cảnh báo" />
      ) : null}
      <SummaryStrip
        items={[
          {
            label: 'Lỗi',
            value: data.errorCount,
            tone: data.errorCount ? 'danger' : 'default',
          },
          {
            label: 'Cảnh báo',
            value: data.warningCount,
            tone: data.warningCount ? 'warning' : 'default',
          },
          {
            label: 'Thông tin',
            value: data.issues.length - data.errorCount - data.warningCount,
          },
        ]}
      />
      <Card size="small">
        <Flex vertical gap="middle">
          <div style={{ overflowX: 'auto' }}>
            <Segmented
              value={category}
              onChange={(value) => setCategory(value as HealthCategory | 'ALL')}
              options={[
                { value: 'ALL', label: `Tất cả (${data.issues.length})` },
                ...data.categories
                  .filter((row) => row.count > 0)
                  .map((row) => ({
                    value: row.category,
                    label: `${HEALTH_CATEGORY_LABELS[row.category]} (${row.count})`,
                  })),
              ]}
            />
          </div>
          <Table
            rowKey={(issue) =>
              `${issue.code}:${issue.itemId ?? ''}:${issue.message}`
            }
            size="small"
            columns={columns}
            dataSource={shown}
            pagination={shown.length > 50 ? { pageSize: 50 } : false}
            scroll={{ x: 'max-content' }}
            locale={{ emptyText: 'Không có cảnh báo trong nhóm này' }}
          />
          <Typography.Text type="secondary">
            Kiểm tra lúc {new Date(data.checkedAt).toLocaleString('vi-VN')}. Báo
            cáo chỉ để chẩn đoán, không chặn thao tác nào.
          </Typography.Text>
        </Flex>
      </Card>
    </Flex>
  );
}
