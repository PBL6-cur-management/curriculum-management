import {
  Alert,
  App,
  Button,
  Card,
  Flex,
  List,
  Skeleton,
  Table,
  Tag,
  Typography,
} from 'antd';
import { useLocation, useParams } from 'react-router';
import { ROUTES } from '../../../routes';
import { BackLink } from '../../../shared/design-system';
import { errorMessage } from '../../../shared/forms/applyFieldErrors';
import { RichTextView } from '../../../shared/components/rich-text/RichTextView';
import { downloadPortalAttachment, type PortalContext } from '../api/portal';
import { PortalContextGate } from '../components/PortalContextBar';
import { MATERIAL_LABELS } from '../constants/portalLabels';
import { usePortalSyllabus } from '../hooks/usePortal';

const SECTIONS = [
  ['courseDescription', 'Mô tả học phần'],
  ['objectives', 'Mục tiêu'],
  ['teachingMethods', 'Phương pháp giảng dạy'],
  ['assessmentMethods', 'Phương pháp đánh giá'],
  ['references', 'Tài liệu tham khảo'],
] as const;

function Syllabus({
  context,
  itemId,
}: {
  context: PortalContext;
  itemId: string;
}) {
  const { message } = App.useApp();
  const syllabus = usePortalSyllabus(context, itemId);
  if (syllabus.isPending) return <Skeleton active paragraph={{ rows: 8 }} />;
  if (syllabus.isError) {
    return (
      <Alert
        type="warning"
        showIcon
        title={errorMessage(syllabus.error, 'Không tải được đề cương.')}
      />
    );
  }
  const data = syllabus.data;
  return (
    <Flex vertical gap="middle">
      <div>
        <Typography.Title level={4} style={{ margin: 0 }}>
          {data.courseCode} — {data.courseName}
        </Typography.Title>
        <Typography.Text type="secondary">
          {data.credits} tín chỉ · Đề cương lần {data.revisionNumber}, đúng bản
          áp dụng cho chương trình của bạn
        </Typography.Text>
      </div>
      {SECTIONS.map(([key, label]) =>
        data[key] ? (
          <Card key={key} size="small" title={label}>
            <RichTextView html={data[key]} emptyText="" />
          </Card>
        ) : null,
      )}
      {data.clos.length > 0 && (
        <Card size="small" title="Chuẩn đầu ra học phần (CLO)">
          <List
            size="small"
            dataSource={data.clos}
            renderItem={(clo) => (
              <List.Item>
                <Flex gap="small" align="start">
                  <Tag>{clo.cloCode}</Tag>
                  <span>{clo.description}</span>
                </Flex>
              </List.Item>
            )}
          />
        </Card>
      )}
      {data.assessments.length > 0 && (
        <Card size="small" title="Cách tính điểm">
          <Table
            size="small"
            rowKey="componentCode"
            pagination={false}
            dataSource={data.assessments}
            scroll={{ x: 360 }}
            columns={[
              {
                title: 'Thành phần',
                render: (_, row) =>
                  `${row.componentCode} — ${row.componentName}`,
              },
              {
                title: 'Hình thức',
                dataIndex: 'assessmentForm',
                render: (value: string | null) => value ?? '',
              },
              {
                title: 'Trọng số',
                dataIndex: 'weight',
                align: 'right',
                render: (value: string) => `${value}%`,
              },
            ]}
          />
        </Card>
      )}
      {data.weeks.length > 0 && (
        <Card size="small" title="Nội dung theo tuần">
          <List
            size="small"
            dataSource={data.weeks}
            renderItem={(week) => (
              <List.Item>
                <Flex vertical>
                  <Typography.Text strong>{week.weekLabel}</Typography.Text>
                  <Typography.Text style={{ whiteSpace: 'pre-line' }}>
                    {week.content}
                  </Typography.Text>
                </Flex>
              </List.Item>
            )}
          />
        </Card>
      )}
      {data.attachments.length > 0 && (
        <Card size="small" title="Tệp đính kèm">
          <List
            size="small"
            dataSource={data.attachments}
            renderItem={(file) => (
              <List.Item
                actions={[
                  <Button
                    key="download"
                    size="small"
                    onClick={() =>
                      void downloadPortalAttachment(
                        context,
                        itemId,
                        file,
                      ).catch((error: unknown) =>
                        message.error(
                          errorMessage(error, 'Không tải được tệp.'),
                        ),
                      )
                    }
                  >
                    Tải về
                  </Button>,
                ]}
              >
                <Flex vertical style={{ minWidth: 0 }}>
                  <Typography.Text ellipsis>{file.fileName}</Typography.Text>
                  <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                    {MATERIAL_LABELS[file.materialKind]}
                  </Typography.Text>
                </Flex>
              </List.Item>
            )}
          />
        </Card>
      )}
    </Flex>
  );
}

// The syllabus my curriculum row was released with, not the course's newest revision.
export function PortalSyllabusPage() {
  const { itemId = '' } = useParams();
  const { search } = useLocation();
  return (
    <Flex vertical gap="middle">
      <BackLink to={`${ROUTES.studentCurriculum}${search}`}>
        Chương trình
      </BackLink>
      <PortalContextGate>
        {(context) => <Syllabus context={context} itemId={itemId} />}
      </PortalContextGate>
    </Flex>
  );
}
