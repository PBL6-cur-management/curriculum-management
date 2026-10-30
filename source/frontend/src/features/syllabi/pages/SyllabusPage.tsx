import { Alert, Empty, Flex, Result, Segmented, Tabs, Tag } from 'antd';
import { useState } from 'react';
import { generatePath, Link, useParams, useSearchParams } from 'react-router';
import { ROUTES } from '../../../routes';
import { ApiError } from '../../../shared/api/client';
import { PERMISSIONS } from '../../../shared/auth/permissions';
import { useCan } from '../../../shared/auth/useCan';
import { REQUEST_ID_PARAM } from '../../../shared/change-requests/requestParams';
import { RequestDraftBanner } from '../../../shared/change-requests/RequestDraftBanner';
import { VERSION_ID_PARAM } from '../../../shared/releases/versionParams';
import type { Syllabus } from '../api/syllabi';
import { SyllabusActions } from '../components/SyllabusActions';
import { SyllabusSections } from '../components/SyllabusSections';
import {
  REQUEST_COPY_TAB_LABEL,
  BACK_TO_COURSE,
  LANGUAGE_OPTIONS,
  NO_SYLLABUS,
  NOT_TRANSLATED,
  SYLLABUS_STATUS_LABELS,
  type SyllabusLanguage,
} from '../constants/syllabusLabels';
import { useCourseSyllabus } from '../hooks/useSyllabus';
import { translated } from '../utils/syllabusLanguage';
import {
  BackLink,
  formatEmpty,
  PageHeader,
  PageSkeleton,
} from '../../../shared/design-system';

export function SyllabusPage() {
  const { courseId = '' } = useParams();
  const [searchParams] = useSearchParams();
  // A request's working copy is shown as the Draft when the link carries the request id (F-13).
  const requestId = searchParams.get(REQUEST_ID_PARAM) ?? undefined;
  // A link from a released version carries its id: the page then shows the revision that version pins (US-079).
  const versionId = searchParams.get(VERSION_ID_PARAM) ?? undefined;
  const { data, isPending, error } = useCourseSyllabus(
    courseId,
    requestId,
    versionId,
  );
  const canViewCourse = useCan(PERMISSIONS.courseView);
  const [language, setLanguage] = useState<SyllabusLanguage>('vi');
  if (isPending) return <PageSkeleton />;
  if (!data) {
    if (error instanceof ApiError && error.status === 403)
      return (
        <Result status="403" title="Bạn không có quyền xem đề cương này" />
      );
    return <Result status="404" title="Không tìm thấy học phần" />;
  }
  const name = translated(
    language,
    data.course.courseName,
    data.course.englishName,
  );
  const revisions = [data.published, data.draft].filter(
    (revision): revision is Syllabus => revision !== null,
  );
  return (
    <Flex vertical gap="middle">
      {canViewCourse && (
        <BackLink
          to={generatePath(ROUTES.courseDetail, { courseId: data.course.id })}
        >
          {BACK_TO_COURSE}
        </BackLink>
      )}
      <PageHeader
        title={
          <>
            {data.course.courseCode} — {name.text}
            {name.missing && (
              <Tag style={{ marginLeft: 8 }}>{NOT_TRANSLATED}</Tag>
            )}
          </>
        }
        actions={
          <>
            <Segmented
              options={[...LANGUAGE_OPTIONS]}
              value={language}
              onChange={setLanguage}
            />
            <SyllabusActions data={data} />
          </>
        }
      />
      <RequestDraftBanner request={data.draft?.sourceRequest ?? null} />
      {data.version && (
        <Alert
          type="info"
          showIcon
          title={`Đề cương theo phiên bản ${formatEmpty(data.version.versionNumber)} của chương trình ${data.version.programCode}`}
          description={
            <Link
              to={generatePath(ROUTES.versionDetail, {
                programId: data.version.programId,
                versionId: data.version.id,
              })}
            >
              Về phiên bản
            </Link>
          }
        />
      )}
      {revisions.length === 0 ? (
        <Empty description={NO_SYLLABUS} />
      ) : (
        <Tabs
          items={revisions.map((revision) => ({
            key: revision.id,
            label:
              revision.revisionNumber === null
                ? REQUEST_COPY_TAB_LABEL
                : `${SYLLABUS_STATUS_LABELS[revision.status]} — bản ${revision.revisionNumber}`,
            children: (
              <SyllabusSections
                syllabus={revision}
                language={language}
                attachTo={
                  data.canAttachToPublished && revision.status !== 'DRAFT'
                    ? {
                        courseId: data.course.id,
                        attachmentRules: data.attachmentRules,
                      }
                    : undefined
                }
              />
            ),
          }))}
        />
      )}
    </Flex>
  );
}
