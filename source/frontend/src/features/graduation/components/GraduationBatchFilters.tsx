import { Form, Select } from 'antd';
import { SemesterSelect } from '../../../shared/releases/SemesterSelect';
import type { GraduationBatchFilter } from '../schema/graduation';
import {
  useGraduationCohorts,
  useGraduationPrograms,
  useGraduationSemesters,
} from '../hooks/useGraduation';
import { GraduationError } from './GraduationError';

interface GraduationBatchFiltersProps {
  onChange: (filters: GraduationBatchFilter) => void;
  requireProgram: boolean;
}
export function GraduationBatchFilters({
  onChange,
  requireProgram,
}: GraduationBatchFiltersProps) {
  const [form] = Form.useForm<GraduationBatchFilter>();
  const semesterId = Form.useWatch('semesterId', form) ?? '';
  const semesters = useGraduationSemesters();
  const programs = useGraduationPrograms(semesterId);
  const cohorts = useGraduationCohorts();
  return (
    <Form
      form={form}
      layout="vertical"
      onValuesChange={(
        changed: Partial<GraduationBatchFilter>,
        values: GraduationBatchFilter,
      ) => {
        const next = { ...values };
        if ('semesterId' in changed) {
          next.programId = undefined;
          form.setFieldValue('programId', undefined);
        }
        onChange({
          semesterId: next.semesterId ?? '',
          ...(next.programId ? { programId: next.programId } : {}),
          ...(next.cohortId ? { cohortId: next.cohortId } : {}),
        });
      }}
    >
      <Form.Item
        name="semesterId"
        label="Học kỳ xét"
        rules={[
          { required: true, message: 'Chọn học kỳ để lập danh sách xét.' },
        ]}
      >
        <SemesterSelect />
      </Form.Item>
      <Form.Item
        name="programId"
        label="Chương trình"
        dependencies={['cohortId']}
        rules={[
          {
            validator: (_, value) =>
              value || (!requireProgram && form.getFieldValue('cohortId'))
                ? Promise.resolve()
                : Promise.reject(
                    new Error(
                      requireProgram
                        ? 'Chọn chương trình phụ trách để xét hàng loạt.'
                        : 'Chọn ít nhất một chương trình hoặc khóa tuyển sinh.',
                    ),
                  ),
          },
        ]}
      >
        <Select
          allowClear
          aria-label="Chương trình"
          placeholder={
            requireProgram
              ? 'Chọn chương trình phụ trách'
              : 'Tất cả chương trình trong phạm vi'
          }
          disabled={!semesterId}
          loading={programs.isFetching}
          options={programs.data?.map((program) => ({
            value: program.id,
            label: `${program.programCode} — ${program.programName}`,
          }))}
        />
      </Form.Item>
      <Form.Item name="cohortId" label="Khóa">
        <Select
          allowClear
          aria-label="Khóa"
          placeholder="Tất cả khóa"
          loading={cohorts.isPending}
          options={cohorts.data?.map((cohort) => ({
            value: cohort.id,
            label: cohort.cohortCode,
          }))}
        />
      </Form.Item>
      {[semesters, programs, cohorts].map(
        (query, index) =>
          query.isError && (
            <GraduationError
              key={index}
              error={query.error}
              onRetry={() => void query.refetch()}
            />
          ),
      )}
    </Form>
  );
}
