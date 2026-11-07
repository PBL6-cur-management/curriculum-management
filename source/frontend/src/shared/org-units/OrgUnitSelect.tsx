import { Select } from 'antd';
import type { OrgUnit } from './orgUnits';
import { useOrgUnits } from './useOrgUnits';

interface OrgUnitSelectProps {
  value?: string | null;
  onChange?: (value: string | null) => void;
  activeOnly?: boolean;
  allowClear?: boolean;
  types?: readonly OrgUnit['unitType'][];
  placeholder?: string;
}

export function OrgUnitSelect({
  value,
  onChange,
  activeOnly = true,
  allowClear = true,
  types,
  placeholder = 'Chọn đơn vị',
}: OrgUnitSelectProps) {
  const { data = [], isPending } = useOrgUnits();
  const options = data
    .filter(
      (unit) =>
        (!activeOnly || unit.status === 'ACTIVE' || unit.id === value) &&
        (!types || types.includes(unit.unitType)),
    )
    .map((unit) => ({ value: unit.id, label: unit.unitName }));
  return (
    <Select
      value={value ?? undefined}
      onChange={(next) => onChange?.(next ?? null)}
      options={options}
      loading={isPending}
      allowClear={allowClear}
      showSearch
      optionFilterProp="label"
      placeholder={placeholder}
      aria-label={placeholder}
    />
  );
}
