import { Button, Flex, Result } from 'antd';
import { useState } from 'react';
import { useParams } from 'react-router';
import { ApiError } from '../../../shared/api/client';
import { RequestDraftBanner } from '../../../shared/change-requests/RequestDraftBanner';
import { versionLabel } from '../../../shared/constants/versionLabels';
import type { Plo } from '../api/outcomes';
import { OutcomeEditNotice } from '../components/OutcomeEditNotice';
import { PloFormModal } from '../components/PloFormModal';
import { PloTable } from '../components/PloTable';
import { ADD_PLO } from '../constants/outcomeLabels';
import { usePlos } from '../hooks/useOutcomes';
import { PageHeader, PageSkeleton } from '../../../shared/design-system';

export function PloListPage() {
  const { versionId = '' } = useParams();
  const { data, isPending, error } = usePlos(versionId);
  const [editing, setEditing] = useState<Plo | 'new' | null>(null);
  if (isPending) return <PageSkeleton />;
  if (!data) {
    if (error instanceof ApiError && error.status === 403)
      return <Result status="403" title="Bạn không có quyền xem PLO này" />;
    return (
      <Result status="404" title="Không tìm thấy phiên bản chương trình" />
    );
  }
  const { version } = data;
  return (
    <Flex vertical gap="middle">
      <PageHeader
        title={
          <>
            PLO — {version.programName} ({versionLabel(version)})
          </>
        }
        actions={
          <>
            {data.canEdit && (
              <Button type="primary" onClick={() => setEditing('new')}>
                {ADD_PLO}
              </Button>
            )}
          </>
        }
      />
      <RequestDraftBanner request={version.sourceRequest} />
      <OutcomeEditNotice
        editPath={data.editPath}
        programId={version.programId}
      />
      <PloTable
        versionId={versionId}
        plos={data.plos}
        canEdit={data.canEdit}
        onEdit={setEditing}
      />
      {editing !== null && (
        <PloFormModal
          versionId={versionId}
          plo={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </Flex>
  );
}
