import { DeleteOutlined, DownloadOutlined } from '@ant-design/icons';
import { App, Button, List, Popconfirm, Space, Tag, Typography } from 'antd';
import { errorMessage } from '../../../shared/forms/applyFieldErrors';
import type { SyllabusAttachment } from '../api/syllabi';
import {
  ATTACHMENT_TYPE_LABELS,
  NO_ATTACHMENTS,
  MATERIAL_KIND_LABELS,
  MATERIAL_KIND_ORDER,
} from '../constants/syllabusLabels';
import { useDownloadAttachment } from '../hooks/useSyllabus';
import { formatDateTime } from '../utils/formatDateTime';
import { formatSize } from '../utils/formatSize';

interface AttachmentListProps {
  attachments: SyllabusAttachment[];
  // Given by the editor only; the delete button also needs the row's own canDelete.
  onDelete?: (attachment: SyllabusAttachment) => void;
}

export function AttachmentList({ attachments, onDelete }: AttachmentListProps) {
  const { message } = App.useApp();
  const download = useDownloadAttachment();
  if (attachments.length === 0)
    return <Typography.Text type="secondary">{NO_ATTACHMENTS}</Typography.Text>;
  return (
    <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
      {MATERIAL_KIND_ORDER.map((materialKind) => {
        const group = attachments.filter(
          (attachment) => attachment.materialKind === materialKind,
        );
        if (group.length === 0) return null;
        return (
          <section
            key={materialKind}
            aria-label={MATERIAL_KIND_LABELS[materialKind]}
          >
            <Typography.Title level={5}>
              {MATERIAL_KIND_LABELS[materialKind]} ({group.length})
            </Typography.Title>
            <List
              size="small"
              dataSource={group}
              renderItem={(attachment) => (
                <List.Item
                  actions={
                    onDelete && attachment.canDelete
                      ? [
                          <Popconfirm
                            key="delete"
                            title={`Gỡ tệp "${attachment.fileName}"?`}
                            okText="Gỡ"
                            cancelText="Hủy"
                            okButtonProps={{ danger: true }}
                            onConfirm={() => onDelete(attachment)}
                          >
                            <Button
                              type="text"
                              danger
                              icon={<DeleteOutlined />}
                              aria-label={`Gỡ tệp ${attachment.fileName}`}
                            />
                          </Popconfirm>,
                        ]
                      : undefined
                  }
                >
                  <Space wrap>
                    <Button
                      type="link"
                      icon={<DownloadOutlined />}
                      onClick={() =>
                        download.mutate(attachment, {
                          onError: (reason) =>
                            void message.error(
                              errorMessage(reason, 'Không tải được tệp.'),
                            ),
                        })
                      }
                    >
                      {attachment.fileName}
                    </Button>
                    <Tag>{ATTACHMENT_TYPE_LABELS[attachment.fileType]}</Tag>
                    <Typography.Text type="secondary">
                      {formatSize(attachment.sizeBytes)} ·{' '}
                      {attachment.uploadedBy.fullName} ·{' '}
                      {formatDateTime(attachment.recordedAt)}
                    </Typography.Text>
                  </Space>
                </List.Item>
              )}
            />
          </section>
        );
      })}
    </Space>
  );
}
