import { Alert, Collapse, Flex, List, Skeleton, Tag, Typography } from 'antd';
import { generatePath, Link, useLocation } from 'react-router';
import { ROUTES } from '../../../routes';
import { StatusTag } from '../../../shared/design-system';
import { errorMessage } from '../../../shared/forms/applyFieldErrors';
import type { PortalContext, PortalCourse } from '../api/portal';
import { PortalContextGate } from '../components/PortalContextBar';
import {
  COURSE_STATE_COLORS,
  COURSE_STATE_LABELS,
} from '../constants/portalLabels';
import { usePortalCurriculum, usePortalPlos } from '../hooks/usePortal';

function CourseRow({
  course,
  search,
}: {
  course: PortalCourse;
  search: string;
}) {
  const mark = [
    course.score10,
    course.score4 && `${course.score4}/4`,
    course.letterGrade,
  ]
    .filter(Boolean)
    .join(' · ');
  const title = `${course.courseCode} — ${course.courseName}`;
  return (
    <List.Item>
      <Flex vertical gap={4} style={{ width: '100%', minWidth: 0 }}>
        <Flex justify="space-between" gap="small" align="start">
          {course.hasSyllabus ? (
            <Link
              to={{
                pathname: generatePath(ROUTES.studentSyllabus, {
                  itemId: course.itemId,
                }),
                search,
              }}
            >
              {title}
            </Link>
          ) : (
            <Typography.Text>{title}</Typography.Text>
          )}
          <StatusTag
            status={course.state}
            labelMap={COURSE_STATE_LABELS}
            colorMap={COURSE_STATE_COLORS}
          />
        </Flex>
        <Typography.Text type="secondary" style={{ fontSize: 13 }}>
          {course.credits} TC
          {course.isElective &&
            ` · Tự chọn${course.groupName ? ` (${course.groupName})` : ''}`}
          {mark && ` · Điểm ${mark}`}
          {course.attemptCount > 1 && ` · ${course.attemptCount} lần học`}
        </Typography.Text>
      </Flex>
    </List.Item>
  );
}

function Curriculum({
  context,
  search,
}: {
  context: PortalContext;
  search: string;
}) {
  const curriculum = usePortalCurriculum(context);
  const plos = usePortalPlos(context);
  if (curriculum.isPending) return <Skeleton active paragraph={{ rows: 8 }} />;
  if (curriculum.isError) {
    return (
      <Alert
        type="error"
        showIcon
        title={errorMessage(curriculum.error, 'Không tải được chương trình.')}
      />
    );
  }
  const data = curriculum.data;
  const hasResults = data.terms.some((term) =>
    term.courses.some((c) => c.attemptCount > 0),
  );
  return (
    <Flex vertical gap="middle">
      <div>
        <Typography.Title level={4} style={{ margin: 0 }}>
          {data.programName}
        </Typography.Title>
        <Typography.Text type="secondary">
          Phiên bản {data.versionNumber ?? '—'}
          {data.decisionNumber && ` · QĐ ${data.decisionNumber}`} ·{' '}
          {data.totalCredits} tín chỉ
        </Typography.Text>
      </div>
      {!hasResults && (
        <Alert type="info" showIcon title="Chưa có dữ liệu kết quả học tập." />
      )}
      <Collapse
        defaultActiveKey={data.terms.map((term) =>
          String(term.plannedSemester),
        )}
        items={data.terms.map((term) => ({
          key: String(term.plannedSemester),
          label: (
            <Flex justify="space-between" gap="small">
              <span>Học kỳ {term.plannedSemester}</span>
              <Typography.Text type="secondary">
                {term.credits} TC bắt buộc
              </Typography.Text>
            </Flex>
          ),
          children: (
            <List
              size="small"
              dataSource={term.courses}
              renderItem={(course) => (
                <CourseRow course={course} search={search} />
              )}
            />
          ),
        }))}
      />
      <div>
        <Typography.Title level={5}>
          Chuẩn đầu ra chương trình (PLO)
        </Typography.Title>
        {plos.isPending ? (
          <Skeleton active />
        ) : (
          <List
            size="small"
            bordered
            locale={{ emptyText: 'Chương trình chưa khai báo chuẩn đầu ra.' }}
            dataSource={plos.data ?? []}
            renderItem={(plo) => (
              <List.Item>
                <Flex gap="small" align="start">
                  <Tag>{plo.ploCode}</Tag>
                  <span>{plo.description}</span>
                </Flex>
              </List.Item>
            )}
          />
        )}
      </div>
    </Flex>
  );
}

// MH-56: the frozen curriculum of my applied version, never the newest one.
export function PortalCurriculumPage() {
  const { search } = useLocation();
  return (
    <PortalContextGate>
      {(context) => <Curriculum context={context} search={search} />}
    </PortalContextGate>
  );
}
