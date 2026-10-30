import { Alert, Flex, Pagination, Select } from 'antd';
import { useState } from 'react';
import { DEFAULT_PAGE_SIZE } from '../../../shared/api/pagination';
import { errorMessage } from '../../../shared/forms/applyFieldErrors';
import { useDebouncedValue } from '../../../shared/hooks/useDebouncedValue';
import {
  ELIGIBILITY_QUERY_OPTIONS,
  useEligibilityStudents,
} from '../hooks/useRegistrationEligibility';

export function EligibilityStudentSelect({
  programId,
  semesterId,
  value,
  onChange,
  id,
}: {
  programId: string;
  semesterId: string;
  value?: string;
  onChange: (studentId: string | undefined) => void;
  id?: string;
}) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<{
    value: string;
    label: string;
  } | null>(null);
  const q = useDebouncedValue(
    search,
    ELIGIBILITY_QUERY_OPTIONS.SEARCH_DEBOUNCE_MS,
  );
  const result = useEligibilityStudents(
    semesterId
      ? { programId, semesterId, q, page, pageSize: DEFAULT_PAGE_SIZE }
      : null,
  );
  const options = result.isError
    ? []
    : (result.data?.items ?? []).map((student) => ({
        value: student.id,
        label: `${student.studentCode} — ${student.fullName}`,
      }));
  if (value && !options.some((option) => option.value === value))
    options.unshift(
      !result.isError && selected?.value === value
        ? selected
        : { value, label: 'Sinh viên đã chọn' },
    );
  return (
    <Flex vertical gap="small">
      <Select
        id={id}
        value={value}
        allowClear
        showSearch
        filterOption={false}
        disabled={!semesterId}
        loading={result.isFetching}
        placeholder="Chọn sinh viên trong chương trình"
        options={options}
        onSearch={(text) => {
          setSearch(text);
          setPage(1);
        }}
        onChange={(next) => {
          setSelected(options.find((option) => option.value === next) ?? null);
          onChange(next);
        }}
        notFoundContent="Không tìm thấy sinh viên trong phạm vi này"
        popupRender={(menu) => (
          <>
            {menu}
            <Pagination
              size="small"
              current={page}
              pageSize={DEFAULT_PAGE_SIZE}
              total={result.isError ? 0 : (result.data?.total ?? 0)}
              showSizeChanger={false}
              onChange={setPage}
            />
          </>
        )}
      />
      {result.isError && (
        <Alert
          type="error"
          showIcon
          title={errorMessage(
            result.error,
            'Không tải được danh sách sinh viên; hãy chọn lại học kỳ.',
          )}
        />
      )}
    </Flex>
  );
}
