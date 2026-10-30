import { Alert, App, Button, Empty, Flex, Result, Typography } from 'antd';
import { useState } from 'react';
import { generatePath, Link, useParams } from 'react-router';
import { ROUTES } from '../../../routes';
import { ApiError } from '../../../shared/api/client';
import { RequestDraftBanner } from '../../../shared/change-requests/RequestDraftBanner';
import { versionLabel } from '../../../shared/constants/versionLabels';
import { errorMessage } from '../../../shared/forms/applyFieldErrors';
import type { ItemCloPloMatrix } from '../api/outcomes';
import { CloPloGrid } from '../components/CloPloGrid';
import { OutcomeEditNotice } from '../components/OutcomeEditNotice';
import { OutcomeNav } from '../components/OutcomeNav';
import {
  fromLinks,
  isDirty,
  toggle,
  toPairs,
  type CloPloSelection,
} from '../cloPloSelection';
import {
  NO_CLOS_IN_REVISION,
  NO_SYLLABUS_FOR_COURSE,
  NOTHING_CHANGED,
  SAVED,
} from '../constants/outcomeLabels';
import { useItemCloPlo, useReplaceCloPloLinks } from '../hooks/useOutcomes';
import { PageHeader, PageSkeleton } from '../../../shared/design-system';

interface ItemCloPloEditorProps {
  itemId: string;
  matrix: ItemCloPloMatrix;
}

// Local ticks, saved as a whole set. The parent re-keys this when the server's links change, which drops stale ticks.
function ItemCloPloEditor({ itemId, matrix }: ItemCloPloEditorProps) {
  const { message } = App.useApp();
  const [selection, setSelection] = useState<CloPloSelection>(() =>
    fromLinks(matrix.links),
  );
  const save = useReplaceCloPloLinks(itemId);
  const dirty = isDirty(selection, matrix.links);
  const submit = () =>
    save.mutate(toPairs(selection), {
      onSuccess: () => void message.success(SAVED),
      onError: (reason) =>
        void message.error(errorMessage(reason, 'Không lưu được liên kết.')),
    });
  return (
    <Flex vertical gap="small">
      <CloPloGrid
        matrix={matrix}
        selection={selection}
        disabled={!matrix.canEdit || save.isPending}
        onToggle={(cloId, ploId) =>
          setSelection((held) => toggle(held, cloId, ploId))
        }
      />
      {matrix.canEdit && (
        <Flex gap="small" align="center">
          <Button
            type="primary"
            disabled={!dirty}
            loading={save.isPending}
            onClick={submit}
          >
            Lưu
          </Button>
          {!dirty && (
            <Typography.Text type="secondary">
              {NOTHING_CHANGED}
            </Typography.Text>
          )}
        </Flex>
      )}
    </Flex>
  );
}

export function ItemCloPloPage() {
  const { programId = '', versionId = '', itemId = '' } = useParams();
  const { data, isPending, error } = useItemCloPlo(itemId);
  if (isPending) return <PageSkeleton />;
  if (!data) {
    if (error instanceof ApiError && error.status === 403)
      return <Result status="403" title="Bạn không có quyền xem ma trận này" />;
    return <Result status="404" title="Không tìm thấy học phần trong khung" />;
  }
  const { version, item, revision } = data;
  return (
    <Flex vertical gap="middle">
      <OutcomeNav programId={programId} versionId={versionId} />
      <PageHeader
        title={
          <>
            CLO–PLO — {item.course.courseCode} {item.course.courseName}
          </>
        }
        subtitle={
          <>
            {`${version.programName} (${versionLabel(version)}) · học kỳ ${item.plannedSemester}`}
            {revision &&
              ` · Theo đề cương bản ${revision.revisionNumber}${revision.status === 'DRAFT' ? ' (nháp)' : ''}`}
          </>
        }
      />
      <RequestDraftBanner request={version.sourceRequest} />
      <OutcomeEditNotice
        editPath={data.editPath}
        programId={version.programId}
      />
      {revision === null ? (
        <Empty description={NO_SYLLABUS_FOR_COURSE}>
          <Link
            to={generatePath(ROUTES.syllabus, { courseId: item.course.id })}
          >
            Mở đề cương
          </Link>
        </Empty>
      ) : data.clos.length === 0 ? (
        <Alert
          type="info"
          showIcon
          title={NO_CLOS_IN_REVISION}
          description={
            <Link
              to={generatePath(ROUTES.syllabus, { courseId: item.course.id })}
            >
              Mở đề cương
            </Link>
          }
        />
      ) : (
        <ItemCloPloEditor
          key={JSON.stringify(data.links)}
          itemId={itemId}
          matrix={data}
        />
      )}
    </Flex>
  );
}
