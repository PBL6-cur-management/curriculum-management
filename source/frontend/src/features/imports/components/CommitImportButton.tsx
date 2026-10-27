import { useState } from 'react';
import { Alert, Button, Flex, Modal, Tooltip, Typography } from 'antd';
import { generatePath, Link } from 'react-router';
import { ROUTES } from '../../../routes';
import { errorMessage } from '../../../shared/forms/applyFieldErrors';
import type { ImportBatch } from '../api/imports';
import { useCommitImport } from '../hooks/useImports';

interface CommitImportButtonProps {
  batch: ImportBatch;
}
export function CommitImportButton({ batch }: CommitImportButtonProps) {
  const [open, setOpen] = useState(false);
  const commit = useCommitImport();
  const disabled =
    !batch.canCommit ||
    !batch.fileAvailable ||
    batch.status !== 'DRY_RUN' ||
    batch.errorRows > 0 ||
    !batch.report ||
    batch.report.formatErrors.length > 0 ||
    batch.report.issues.some((issue) => issue.severity === 'ERROR');
  const reason = !batch.fileAvailable
    ? 'Tệp gốc đã hết hạn lưu.'
    : batch.status !== 'DRY_RUN'
      ? 'Chỉ xác nhận khi chạy thử đã hoàn tất, chưa ghi.'
      : batch.errorRows > 0 ||
          batch.report?.formatErrors.length ||
          batch.report?.issues.some((issue) => issue.severity === 'ERROR')
        ? 'Báo cáo còn LỖI.'
        : 'Bạn không thể xác nhận lần nhập này. Chỉ người tải tệp được ghi.';
  const resultPath =
    batch.program && batch.versionId
      ? generatePath(ROUTES.curriculum, {
          programId: batch.program.id,
          versionId: batch.versionId,
        })
      : ROUTES.courses;
  return (
    <Flex vertical gap="small">
      {commit.error && (
        <Alert
          type="error"
          showIcon
          title={errorMessage(
            commit.error,
            'Không ghi được dữ liệu. Hãy tải lại báo cáo và thử lại.',
          )}
        />
      )}
      {batch.status === 'COMMITTED' && (
        <Alert
          type="success"
          showIcon
          title={`Đã ghi ${batch.successRows} dòng.`}
          description={<Link to={resultPath}>Xem dữ liệu đã nhập</Link>}
        />
      )}
      <Tooltip title={disabled ? reason : undefined}>
        <span>
          <Button
            type="primary"
            disabled={disabled}
            loading={commit.isPending}
            onClick={() => setOpen(true)}
          >
            Xác nhận nhập
          </Button>
        </span>
      </Tooltip>
      <Modal
        title="Xác nhận ghi dữ liệu"
        open={open}
        okText="Ghi dữ liệu"
        cancelText="Hủy"
        confirmLoading={commit.isPending}
        okButtonProps={{ disabled }}
        onCancel={() => {
          if (!commit.isPending) setOpen(false);
        }}
        onOk={() =>
          commit.mutate(batch.id, { onSuccess: () => setOpen(false) })
        }
      >
        <Typography.Paragraph>
          Ghi {batch.totalRows} dòng vào{' '}
          {batch.program
            ? `${batch.program.programCode} — ${batch.program.programName}`
            : 'danh mục học phần'}
          ?
        </Typography.Paragraph>
        <Alert
          type="warning"
          showIcon
          title="Ghi toàn bộ hoặc không ghi dòng nào. Với khung chương trình, các học phần không có trong tệp sẽ bị xóa khỏi bản nháp."
        />
      </Modal>
    </Flex>
  );
}
