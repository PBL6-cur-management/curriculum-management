import { Flex, Select } from 'antd';
import { useState } from 'react';
import { useDebouncedValue } from '../../../shared/hooks/useDebouncedValue';
import {
  VERSION_STATUS_LABELS,
  versionLabel,
} from '../../../shared/constants/versionLabels';
import { useProgram, useProgramList } from '../../programs/hooks/usePrograms';

interface VersionPickerProps {
  label: string;
  programId: string;
  versionId: string;
  onChange: (value: { programId: string; versionId: string }) => void;
  /** Only Pending/Active/Historical — the accreditation dossier never covers a Draft. */
  issuedOnly?: boolean;
}

// Program first, then one of its versions; the program's current version is picked by default.
export function VersionPicker({
  label,
  programId,
  versionId,
  onChange,
  issuedOnly = false,
}: VersionPickerProps) {
  const [term, setTerm] = useState('');
  const search = useDebouncedValue(term.trim(), 300);
  const programs = useProgramList({
    page: 1,
    pageSize: 100,
    q: search || undefined,
  });
  const program = useProgram(programId);
  const versions = (program.data?.versions ?? []).filter(
    (version) => !issuedOnly || version.status !== 'DRAFT',
  );
  return (
    <Flex gap="small" wrap>
      <Select
        aria-label={`${label}: chương trình`}
        showSearch
        onSearch={setTerm}
        filterOption={false}
        placeholder={`${label}: chọn chương trình`}
        style={{ minWidth: 280 }}
        loading={programs.isFetching}
        value={programId || undefined}
        onChange={(next: string) => {
          const summary = programs.data?.items.find((item) => item.id === next);
          const current = summary?.currentVersion;
          onChange({
            programId: next,
            versionId:
              current && (!issuedOnly || current.status !== 'DRAFT')
                ? current.id
                : '',
          });
        }}
        options={(programs.data?.items ?? []).map((item) => ({
          value: item.id,
          label: `${item.programCode} — ${item.programName}`,
        }))}
      />
      <Select
        aria-label={`${label}: phiên bản`}
        placeholder="Phiên bản"
        style={{ minWidth: 200 }}
        disabled={!programId}
        loading={program.isFetching}
        value={versionId || undefined}
        onChange={(next: string) => onChange({ programId, versionId: next })}
        options={versions.map((version) => ({
          value: version.id,
          label: `${versionLabel(version)} · ${VERSION_STATUS_LABELS[version.status]}`,
        }))}
      />
    </Flex>
  );
}
