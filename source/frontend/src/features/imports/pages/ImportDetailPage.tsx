import { Alert, Button, Descriptions, Skeleton, Tooltip } from 'antd';
import dayjs from 'dayjs';
import { useParams } from 'react-router';
import { ROUTES } from '../../../routes';
import {
  BackLink,
  DetailPageLayout,
  PageHeader,
} from '../../../shared/design-system';
import { errorMessage } from '../../../shared/forms/applyFieldErrors';
import { CommitImportButton } from '../components/CommitImportButton';
import { ImportReport } from '../components/ImportReport';
import { StudentCredentialDownload } from '../components/StudentCredentialDownload';
import { IMPORT_TYPE_LABELS } from '../constants/importLabels';
import { useDownloadImportFile, useImportBatch } from '../hooks/useImports';

export function ImportDetailPage() {
  const { batchId = '' } = useParams();
  const batch = useImportBatch(batchId);
  const file = useDownloadImportFile();
  return (
    <DetailPageLayout>
      <BackLink to={ROUTES.importHistory}>Lịch sử nhập liệu</BackLink>
      <PageHeader title="Chi tiết lần nhập" />
      {batch.isPending && <Skeleton active />}
      {batch.error && (
        <Alert
          type="error"
          showIcon
          title={errorMessage(
            batch.error,
            'Không tìm thấy lần nhập hoặc bạn không có quyền xem.',
          )}
          action={<Button onClick={() => void batch.refetch()}>Thử lại</Button>}
        />
      )}
      {batch.data && !batch.isError && (
        <>
          <Descriptions
            column={1}
            items={[
              {
                key: 'type',
                label: 'Loại dữ liệu',
                children: IMPORT_TYPE_LABELS[batch.data.importType],
              },
              {
                key: 'program',
                label: 'Chương trình',
                children: batch.data.program
                  ? `${batch.data.program.programCode} — ${batch.data.program.programName}`
                  : 'Không gắn chương trình',
              },
              {
                key: 'user',
                label: 'Người nhập',
                children: batch.data.performedBy.fullName,
              },
              {
                key: 'time',
                label: 'Thời gian',
                children: dayjs(batch.data.recordedAt).format(
                  'DD/MM/YYYY HH:mm',
                ),
              },
            ]}
          />
          <Tooltip
            title={
              batch.data.fileAvailable
                ? undefined
                : 'Tệp gốc đã hết hạn lưu 30 ngày; lịch sử và báo cáo vẫn được giữ.'
            }
          >
            <span>
              <Button
                disabled={!batch.data.fileAvailable}
                loading={file.isPending}
                onClick={() => file.mutate(batchId)}
              >
                Tải tệp gốc
              </Button>
            </span>
          </Tooltip>
          {file.error && (
            <Alert
              type="error"
              showIcon
              title={errorMessage(
                file.error,
                'Không tải được tệp gốc. Hãy thử lại.',
              )}
            />
          )}
          <ImportReport batch={batch.data} />
          <CommitImportButton batch={batch.data} />
          {batch.data.importType === 'STUDENT_LIST' && (
            <StudentCredentialDownload
              batchId={batchId}
              committed={batch.data.status === 'COMMITTED'}
            />
          )}
        </>
      )}
    </DetailPageLayout>
  );
}
