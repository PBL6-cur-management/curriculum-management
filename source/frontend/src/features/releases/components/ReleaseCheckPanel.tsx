import { Alert, Button, Flex, List, Skeleton, Typography } from 'antd';
import { generatePath, Link } from 'react-router';
import { ROUTES } from '../../../routes';
import type { ReleaseCheck } from '../api/releases';
import {
  CHECK_BLOCKED_NOTE,
  CHECK_CLEAN_NOTE,
  CHECK_RERUN_LABEL,
  ISSUE_SEVERITY_LABELS,
  SYLLABUS_CONDITION_LABELS,
  SYLLABUS_ISSUE_LABELS,
} from '../constants/releaseLabels';

interface ReleaseCheckPanelProps {
  check: ReleaseCheck | undefined;
  loading: boolean;
  refreshing: boolean;
  onRerun: () => void;
  programId: string;
  versionId: string;
}

// MH-45 preflight. Advisory: the release repeats every check, and a Warning never blocks.
// A missing syllabus is listed once, under the syllabi, even though the consistency check raises it too.
export function ReleaseCheckPanel({
  check,
  loading,
  refreshing,
  onRerun,
  programId,
  versionId,
}: ReleaseCheckPanelProps) {
  if (loading || !check) return <Skeleton active />;
  const consistency = check.consistencyIssues.filter(
    (issue) => issue.code !== 'MISSING_SYLLABUS',
  );
  const errors = consistency.filter((issue) => issue.severity === 'ERROR');
  const notes = consistency.filter((issue) => issue.severity !== 'ERROR');
  return (
    <Flex vertical gap="middle">
      <Flex justify="space-between" align="center" wrap gap="small">
        <Alert
          type={check.canRelease ? 'success' : 'error'}
          showIcon
          title={check.canRelease ? CHECK_CLEAN_NOTE : CHECK_BLOCKED_NOTE}
        />
        <Button loading={refreshing} onClick={onRerun}>
          {CHECK_RERUN_LABEL}
        </Button>
      </Flex>
      {errors.length > 0 && (
        <List
          size="small"
          bordered
          header={
            <Typography.Text strong>Lỗi khung chương trình</Typography.Text>
          }
          dataSource={errors}
          renderItem={(issue) => (
            <List.Item
              actions={[
                <Link
                  key="fix"
                  to={generatePath(ROUTES.consistency, {
                    programId,
                    versionId,
                  })}
                >
                  Kiểm tra nhất quán
                </Link>,
              ]}
            >
              {issue.message}
            </List.Item>
          )}
        />
      )}
      {check.syllabusIssues.length > 0 && (
        <List
          size="small"
          bordered
          header={<Typography.Text strong>Đề cương</Typography.Text>}
          dataSource={check.syllabusIssues}
          renderItem={(issue) => (
            <List.Item
              actions={[
                <Link
                  key="fix"
                  to={generatePath(
                    issue.code === 'MISSING_SYLLABUS'
                      ? ROUTES.syllabus
                      : ROUTES.syllabusEdit,
                    { courseId: issue.courseId },
                  )}
                >
                  Tới đề cương
                </Link>,
              ]}
            >
              <span>
                <strong>{issue.courseCode}</strong>:{' '}
                {SYLLABUS_ISSUE_LABELS[issue.code]}
                {issue.details.length > 0 &&
                  ` — ${issue.details
                    .map((code) => SYLLABUS_CONDITION_LABELS[code] ?? code)
                    .join('; ')}`}
              </span>
            </List.Item>
          )}
        />
      )}
      {notes.length > 0 && (
        <List
          size="small"
          bordered
          header={
            <Typography.Text strong>
              {ISSUE_SEVERITY_LABELS.HIGH} và lưu ý (không chặn ban hành)
            </Typography.Text>
          }
          dataSource={notes}
          renderItem={(issue) => <List.Item>{issue.message}</List.Item>}
        />
      )}
    </Flex>
  );
}
