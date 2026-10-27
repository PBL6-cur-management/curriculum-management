import {
  Alert,
  Button,
  Flex,
  Form,
  Select,
  Upload,
  type UploadFile,
} from 'antd';
import { useState } from 'react';
import { errorMessage } from '../../../shared/forms/applyFieldErrors';
import { EmptyState } from '../../../shared/design-system';
import type {
  ImportType,
  ImportTypeOption,
  UploadImportInput,
} from '../api/imports';
import {
  IMPORT_ACCEPT,
  IMPORT_FILE_MAX_BYTES,
  IMPORT_TYPE_LABELS,
} from '../constants/importLabels';
import { useDownloadTemplate, useImportTargets } from '../hooks/useImports';

interface UploadValues {
  importType: ImportType;
  versionId?: string;
  files: UploadFile[];
}
interface ImportUploadFormProps {
  types: ImportTypeOption[];
  initialType?: ImportType;
  initialVersion?: string;
  pending: boolean;
  onUpload: (input: UploadImportInput) => void;
}
export function ImportUploadForm({
  types,
  initialType,
  initialVersion,
  pending,
  onUpload,
}: ImportUploadFormProps) {
  const [form] = Form.useForm<UploadValues>();
  const importType = Form.useWatch('importType', form);
  const needsVersion =
    types.find((option) => option.importType === importType)?.needsVersion ??
    false;
  const targets = useImportTargets(needsVersion);
  const template = useDownloadTemplate();
  const [fileError, setFileError] = useState<string | null>(null);
  if (!types.length)
    return (
      <EmptyState description="Bạn chưa có loại dữ liệu nào được phép nhập." />
    );
  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={{
        importType: initialType ?? types[0].importType,
        versionId: initialVersion,
      }}
      onFinish={(values) => {
        const file = values.files[0]?.originFileObj;
        if (file)
          onUpload({
            importType: values.importType,
            versionId: needsVersion ? values.versionId : undefined,
            file,
          });
      }}
    >
      <Form.Item
        name="importType"
        label="Loại dữ liệu"
        rules={[{ required: true, message: 'Chọn loại dữ liệu cần nhập.' }]}
      >
        <Select
          options={types.map((option) => ({
            value: option.importType,
            label: IMPORT_TYPE_LABELS[option.importType],
          }))}
          onChange={() =>
            form.setFieldsValue({ versionId: undefined, files: [] })
          }
        />
      </Form.Item>
      {needsVersion && (
        <>
          {targets.error && (
            <Alert
              type="error"
              showIcon
              title={errorMessage(
                targets.error,
                'Không tải được danh sách bản nháp.',
              )}
              action={
                <Button onClick={() => void targets.refetch()}>Thử lại</Button>
              }
            />
          )}
          <Form.Item
            name="versionId"
            label="Bản nháp chương trình"
            rules={[
              { required: true, message: 'Chọn bản nháp cần nhập.' },
              {
                validator: async (_, value) => {
                  if (
                    value &&
                    !targets.data?.some((target) => target.versionId === value)
                  )
                    throw new Error(
                      'Bản nháp không nằm trong phạm vi được nhập hoặc chương trình đã ban hành.',
                    );
                },
              },
            ]}
          >
            <Select
              loading={targets.isFetching}
              showSearch
              optionFilterProp="label"
              options={targets.data?.map((target) => ({
                value: target.versionId,
                label: `${target.programCode} — ${target.programName}`,
              }))}
              notFoundContent="Không có bản nháp được phép nhập trong phạm vi của bạn."
            />
          </Form.Item>
          {targets.data?.length === 0 && (
            <Alert
              type="info"
              showIcon
              title="Không có bản nháp được phép nhập. Chương trình đã từng ban hành phải thay đổi qua đề xuất."
            />
          )}
        </>
      )}
      <Form.Item
        name="files"
        label="Tệp Excel"
        valuePropName="fileList"
        getValueFromEvent={(event: { fileList: UploadFile[] }) =>
          event.fileList
        }
        rules={[{ required: true, message: 'Chọn một tệp Excel (.xlsx).' }]}
      >
        <Upload
          accept={IMPORT_ACCEPT}
          maxCount={1}
          beforeUpload={(file) => {
            const issue = !file.name.toLowerCase().endsWith(IMPORT_ACCEPT)
              ? 'Chỉ nhận tệp Excel (.xlsx).'
              : file.size > IMPORT_FILE_MAX_BYTES
                ? 'Tệp Excel không được lớn hơn 5 MB.'
                : null;
            setFileError(issue);
            return issue ? Upload.LIST_IGNORE : false;
          }}
        >
          <Button>Chọn tệp Excel</Button>
        </Upload>
      </Form.Item>
      {fileError && <Alert type="error" showIcon title={fileError} />}
      {template.error && (
        <Alert
          type="error"
          showIcon
          title={errorMessage(
            template.error,
            'Không tải được tệp mẫu. Hãy thử lại.',
          )}
        />
      )}
      <Flex gap="small" wrap>
        <Button
          disabled={!importType}
          loading={template.isPending}
          onClick={() => template.mutate(importType)}
        >
          Tải tệp mẫu
        </Button>
        <Button
          type="primary"
          htmlType="submit"
          loading={pending}
          disabled={
            needsVersion && (!targets.data?.length || targets.isFetching)
          }
        >
          Chạy thử
        </Button>
      </Flex>
    </Form>
  );
}
