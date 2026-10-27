import { Table, Typography } from 'antd';
import type { VersionComparison } from '../api/releases';
import { EMPTY_COMPARISON_VALUE } from '../utils/versionComparison';

type Fields = VersionComparison['sections'][number]['rows'][number]['fields'];
export function ComparisonFieldsTable({ fields }: { fields: Fields }) {
  return (
    <Table
      rowKey="name"
      size="small"
      pagination={false}
      dataSource={fields}
      scroll={{ x: 560 }}
      columns={[
        { title: 'Trường', dataIndex: 'label' },
        ...(['before', 'after'] as const).map((side) => ({
          title: side === 'before' ? 'Trước' : 'Sau',
          dataIndex: side,
          render: (value: string | null) => (
            <Typography.Paragraph
              style={{
                whiteSpace: 'pre-wrap',
                overflowWrap: 'anywhere',
                margin: 0,
              }}
            >
              {value ?? EMPTY_COMPARISON_VALUE}
            </Typography.Paragraph>
          ),
        })),
      ]}
    />
  );
}
