import { Select, Spin } from 'antd';
import { useState } from 'react';
import { useDebouncedValue } from '../../../shared/hooks/useDebouncedValue';
import type { DelegationUserOption } from '../api/delegations';

const SEARCH_DEBOUNCE_MS = 300;

interface UserOptionSelectProps {
  id?: string;
  value?: string;
  onChange?: (userId: string | undefined) => void;
  placeholder: string;
  useOptions: (
    q: string,
    enabled: boolean,
  ) => { data?: DelegationUserOption[]; isFetching: boolean };
}

// A searched account picker; the server limits who may appear (active accounts, never the caller).
export function UserOptionSelect({
  id,
  value,
  onChange,
  placeholder,
  useOptions,
}: UserOptionSelectProps) {
  const [term, setTerm] = useState('');
  const debounced = useDebouncedValue(term.trim(), SEARCH_DEBOUNCE_MS);
  const { data = [], isFetching } = useOptions(debounced, true);
  return (
    <Select
      id={id}
      showSearch
      allowClear
      value={value}
      onChange={(next: string | undefined) => onChange?.(next)}
      onSearch={setTerm}
      filterOption={false}
      loading={isFetching}
      options={data.map((user) => ({
        value: user.id,
        label: `${user.fullName} (${user.userCode})`,
      }))}
      placeholder={placeholder}
      notFoundContent={isFetching ? <Spin size="small" /> : 'Không tìm thấy'}
    />
  );
}
