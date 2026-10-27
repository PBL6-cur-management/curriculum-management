import { useState } from 'react';
import { Alert, Button, Skeleton } from 'antd';
import { Link, useSearchParams } from 'react-router';
import {
  IMPORT_TYPE_PARAM,
  IMPORT_VERSION_PARAM,
  ROUTES,
} from '../../../routes';
import { DetailPageLayout, PageHeader } from '../../../shared/design-system';
import { errorMessage } from '../../../shared/forms/applyFieldErrors';
import { CommitImportButton } from '../components/CommitImportButton';
import { ImportReport } from '../components/ImportReport';
import { ImportUploadForm } from '../components/ImportUploadForm';
import {
  useCreateImport,
  useImportBatch,
  useImportTypes,
} from '../hooks/useImports';

export function ImportPage() {
  const [search] = useSearchParams();
  const types = useImportTypes();
  const upload = useCreateImport();
  const [batchId, setBatchId] = useState('');
  const batch = useImportBatch(batchId);
  const initialType = types.data?.find(
    (option) => option.importType === search.get(IMPORT_TYPE_PARAM),
  )?.importType;
  return (
    <DetailPageLayout>
      <PageHeader
        title="Nhập liệu Excel"
        actions={<Link to={ROUTES.importHistory}>Lịch sử nhập liệu</Link>}
      />
      <Alert
        type="info"
        showIcon
        title="Chạy thử chỉ kiểm tra tệp, chưa ghi dữ liệu. Chỉ xác nhận khi báo cáo không còn LỖI."
      />
      {types.isPending && <Skeleton active />}
      {types.error && (
        <Alert
          type="error"
          showIcon
          title={errorMessage(
            types.error,
            'Không tải được các loại dữ liệu được phép nhập.',
          )}
          action={<Button onClick={() => void types.refetch()}>Thử lại</Button>}
        />
      )}
      {types.data && (
        <ImportUploadForm
          types={types.data}
          initialType={initialType}
          initialVersion={search.get(IMPORT_VERSION_PARAM) ?? undefined}
          pending={upload.isPending}
          onUpload={(input) =>
            upload.mutate(input, {
              onSuccess: (result) => setBatchId(result.id),
            })
          }
        />
      )}
      {upload.error && (
        <Alert
          type="error"
          showIcon
          title={errorMessage(
            upload.error,
            'Không tải được tệp lên. Hãy kiểm tra tệp và thử lại.',
          )}
        />
      )}
      {batchId && batch.isPending && <Skeleton active />}
      {batch.error && (
        <Alert
          type="error"
          showIcon
          title={errorMessage(batch.error, 'Không tải được báo cáo nhập liệu.')}
          action={<Button onClick={() => void batch.refetch()}>Thử lại</Button>}
        />
      )}
      {batch.data && (
        <>
          <ImportReport batch={batch.data} />
          <CommitImportButton batch={batch.data} />
        </>
      )}
    </DetailPageLayout>
  );
}
