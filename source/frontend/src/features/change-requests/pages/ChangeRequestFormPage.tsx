import { Flex } from 'antd';
import { useSearchParams } from 'react-router';
import { CreateRequestPanel } from '../components/CreateRequestPanel';
import { DATA_TYPES } from '../requestTypes';
import { readPrefill } from '../utils/prefill';
import { PageHeader } from '../../../shared/design-system';

// MH-39: a data request; the target arrives chosen when the user came from "Tạo đề xuất" on another screen.
export function ChangeRequestFormPage() {
  const [params] = useSearchParams();
  return (
    <Flex vertical gap="middle">
      <PageHeader title="Tạo đề xuất thay đổi" />
      <CreateRequestPanel types={DATA_TYPES} defaults={readPrefill(params)} />
    </Flex>
  );
}
