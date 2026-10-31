import { Button, Flex, Form, Select } from 'antd';
import { useEffect } from 'react';
import type { VersionRef } from '../api/releases';
import { isIssuedVersion } from '../utils/versionComparison';
import { formatDecisionNumber } from '../../../shared/releases/decisionNumber';

interface VersionComparisonSelectorsProps {
  versions: VersionRef[];
  beforeVersionId: string;
  afterVersionId: string;
  onCompare: (before: string, after: string) => void;
}
export function VersionComparisonSelectors({
  versions,
  beforeVersionId,
  afterVersionId,
  onCompare,
}: VersionComparisonSelectorsProps) {
  const [form] = Form.useForm<{ before: string; after: string }>();
  useEffect(() => {
    form.setFieldsValue({
      before: beforeVersionId || undefined,
      after: afterVersionId || undefined,
    });
  }, [form, beforeVersionId, afterVersionId]);
  const options = versions.filter(isIssuedVersion).map((version) => ({
    value: version.id,
    label: `${version.versionNumber} · ${formatDecisionNumber(version.decisionNumber)} · ${version.effectiveSemester?.semesterCode}`,
  }));
  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={({ before, after }) => onCompare(before, after)}
    >
      <Flex gap="middle" wrap>
        <Form.Item
          name="before"
          label="Phiên bản trước"
          rules={[{ required: true, message: 'Chọn phiên bản trước.' }]}
          style={{ flex: '1 1 260px' }}
        >
          <Select showSearch optionFilterProp="label" options={options} />
        </Form.Item>
        <Form.Item
          name="after"
          label="Phiên bản sau"
          rules={[{ required: true, message: 'Chọn phiên bản sau.' }]}
          style={{ flex: '1 1 260px' }}
        >
          <Select showSearch optionFilterProp="label" options={options} />
        </Form.Item>
      </Flex>
      <Flex gap="small" wrap>
        <Button type="primary" htmlType="submit">
          So sánh
        </Button>
        <Button
          onClick={() => {
            const values = form.getFieldsValue();
            if (values.before && values.after)
              onCompare(values.after, values.before);
          }}
        >
          Đổi chiều so sánh
        </Button>
      </Flex>
    </Form>
  );
}
