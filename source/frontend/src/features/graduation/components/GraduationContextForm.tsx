import { useState } from 'react';
import { Alert, Button, Form, Pagination, Select } from 'antd';
import { SemesterSelect } from '../../../shared/releases/SemesterSelect';
import type { GraduationLookup } from '../schema/graduation';
import { GRADUATION_UI } from '../constants/graduationUi';
import {
  useDebouncedGraduationSearch,
  useGraduationPrograms,
  useGraduationSemesters,
  useGraduationStudents,
} from '../hooks/useGraduation';
import { GraduationError } from './GraduationError';

interface GraduationContextFormProps {
  value: GraduationLookup | null;
  onChange: (lookup: GraduationLookup | null) => void;
  onSubmit: (lookup: GraduationLookup) => void;
}
export function GraduationContextForm({
  value,
  onChange,
  onSubmit,
}: GraduationContextFormProps) {
  const [form] = Form.useForm<GraduationLookup>();
  const [draft, setDraft] = useState<Partial<GraduationLookup>>(value ?? {});
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const query = useDebouncedGraduationSearch(search);
  const semesters = useGraduationSemesters();
  const programs = useGraduationPrograms(draft.semesterId ?? '');
  const students = useGraduationStudents(
    draft.programId && draft.semesterId
      ? {
          programId: draft.programId,
          semesterId: draft.semesterId,
          q: query,
          page,
          pageSize: GRADUATION_UI.OPTION_PAGE_SIZE,
        }
      : null,
  );
  function change(
    changed: Partial<GraduationLookup>,
    values: GraduationLookup,
  ) {
    const next = { ...values };
    if ('semesterId' in changed) {
      next.programId = '';
      next.studentId = '';
    }
    if ('programId' in changed) next.studentId = '';
    form.setFieldsValue(next);
    setDraft(next);
    setPage(1);
    setSearch('');
    onChange(null);
  }
  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={value ?? {}}
      onValuesChange={change}
      onFinish={onSubmit}
    >
      <Form.Item
        name="semesterId"
        label="Học kỳ xét"
        rules={[{ required: true, message: 'Chọn học kỳ cần xét tốt nghiệp.' }]}
      >
        <SemesterSelect />
      </Form.Item>
      <Form.Item
        name="programId"
        label="Chương trình"
        rules={[
          { required: true, message: 'Chọn chương trình cho học kỳ đã chọn.' },
        ]}
      >
        <Select
          allowClear
          aria-label="Chương trình"
          placeholder="Chọn chương trình"
          disabled={!draft.semesterId}
          loading={programs.isFetching}
          options={programs.data?.map((program) => ({
            value: program.id,
            label: `${program.programCode} — ${program.programName}`,
          }))}
        />
      </Form.Item>
      <Form.Item
        name="studentId"
        label="Sinh viên"
        rules={[
          {
            required: true,
            message: 'Chọn sinh viên cần xét trong chương trình và học kỳ này.',
          },
        ]}
      >
        <Select
          allowClear
          aria-label="Sinh viên"
          placeholder="Tìm mã hoặc tên sinh viên"
          showSearch={{
            filterOption: false,
            onSearch: (value) => {
              setSearch(value);
              setPage(1);
            },
          }}
          disabled={!draft.programId || !draft.semesterId}
          loading={students.isFetching}
          options={students.data?.items.map((student) => ({
            value: student.id,
            label: `${student.studentCode} — ${student.fullName}`,
          }))}
          labelRender={({ value: selectedId }) => {
            const student = students.data?.items.find(
              (item) => item.id === selectedId,
            );
            return student
              ? `${student.studentCode} — ${student.fullName}`
              : 'Sinh viên từ hồ sơ đã chọn';
          }}
          notFoundContent="Chưa có sinh viên phù hợp trong chương trình và học kỳ này"
        />
      </Form.Item>
      {students.data &&
        students.data.total > GRADUATION_UI.OPTION_PAGE_SIZE && (
          <Pagination
            aria-label="Trang chọn sinh viên"
            current={page}
            pageSize={GRADUATION_UI.OPTION_PAGE_SIZE}
            total={students.data.total}
            showSizeChanger={false}
            onChange={setPage}
          />
        )}
      {[semesters, programs, students].map(
        (response, index) =>
          response.isError && (
            <GraduationError
              key={index}
              error={response.error}
              onRetry={() => void response.refetch()}
            />
          ),
      )}
      {!draft.semesterId && (
        <Alert
          type="info"
          title="Chọn học kỳ, chương trình và sinh viên; không tự chọn phiên bản mới nhất."
          style={{ marginBottom: 16 }}
        />
      )}
      <Button type="primary" htmlType="submit">
        Xem kết quả
      </Button>
    </Form>
  );
}
