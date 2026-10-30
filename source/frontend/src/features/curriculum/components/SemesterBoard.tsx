import { Card, Col, List, Row, Space, Tag, Typography } from 'antd';
import type { Curriculum, CurriculumItem } from '../api/curriculum';
import {
  ELECTIVE_KIND_LABELS,
  EMPTY_SEMESTER_LABEL,
} from '../constants/curriculumLabels';
import { CurriculumItemActions } from './CurriculumItemActions';
import { itemElementId } from './CurriculumWarningsPanel';
import { RequisiteTags } from './RequisiteTags';
import { generatePath, Link } from 'react-router';
import { ROUTES } from '../../../routes';
import { VERSION_ID_PARAM } from '../../../shared/releases/versionParams';
import { EligibilityStatus } from '../../../shared/registration-eligibility/EligibilityStatus';
import type { EligibilityByItemId } from '../../../shared/registration-eligibility/eligibilityLabels';

interface SemesterBoardProps {
  studentMode?: boolean;
  eligibilityByItemId?: EligibilityByItemId;
  onShowEligibility?: (itemId: string) => void;
  curriculum: Curriculum;
  items: CurriculumItem[];
  onEdit: (item: CurriculumItem) => void;
  onRequisites: (item: CurriculumItem) => void;
}

// One card per semester of the program, empty ones included (US-024 AC2), with the server's credit totals in the header.
export function SemesterBoard({
  curriculum,
  items,
  onEdit,
  onRequisites,
  studentMode = false,
  eligibilityByItemId,
  onShowEligibility,
}: SemesterBoardProps) {
  return (
    <Row gutter={[16, 16]}>
      {curriculum.semesters.map((semester) => {
        const rows = items.filter(
          (item) => item.plannedSemester === semester.semester,
        );
        return (
          <Col key={semester.semester} xs={24} md={12} xl={8}>
            <Card
              size="small"
              title={`Học kỳ ${semester.semester} — ${semester.totalCredits} TC (BB ${semester.compulsoryCredits} / TC ${semester.electiveCredits})`}
            >
              {rows.length === 0 ? (
                <Typography.Text type="secondary">
                  {EMPTY_SEMESTER_LABEL}
                </Typography.Text>
              ) : (
                <List
                  size="small"
                  dataSource={rows}
                  renderItem={(item) => (
                    <List.Item
                      id={itemElementId(item.id)}
                      actions={
                        studentMode
                          ? []
                          : [
                              <CurriculumItemActions
                                key="actions"
                                versionId={curriculum.version.id}
                                item={item}
                                onEdit={onEdit}
                                onRequisites={onRequisites}
                              />,
                            ]
                      }
                    >
                      <Space direction="vertical" size={2}>
                        <span>
                          {item.course.courseCode} — {item.course.courseName} (
                          {item.course.credits} TC){' '}
                          {item.isElective && (
                            <Tag>{ELECTIVE_KIND_LABELS.elective}</Tag>
                          )}
                          {item.electiveGroup && (
                            <Tag>{item.electiveGroup.groupCode}</Tag>
                          )}
                        </span>
                        <RequisiteTags item={item} />
                        {studentMode && eligibilityByItemId?.get(item.id) && (
                          <EligibilityStatus
                            item={eligibilityByItemId.get(item.id)!}
                            onShowReasons={() => onShowEligibility?.(item.id)}
                          />
                        )}
                        {studentMode && item.hasSyllabus && (
                          <Link
                            to={`${generatePath(ROUTES.syllabus, { courseId: item.course.id })}?${new URLSearchParams({ [VERSION_ID_PARAM]: curriculum.version.id })}`}
                          >
                            Đề cương
                          </Link>
                        )}
                      </Space>
                    </List.Item>
                  )}
                />
              )}
            </Card>
          </Col>
        );
      })}
    </Row>
  );
}
