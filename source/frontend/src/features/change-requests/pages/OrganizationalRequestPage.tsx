import { Flex } from 'antd';
import { CreateRequestPanel } from '../components/CreateRequestPanel';
import { ORGANIZATION_TYPES } from '../requestTypes';
import { PageHeader } from '../../../shared/design-system';

const DEFAULTS = {
  requestType: 'ORGANIZATION',
  targetType: 'SUBJECT_GROUP',
} as const;

// MH-40: R2 and R4 change the members of a subject group or the directors of a program; level 3 only (US-060).
export function OrganizationalRequestPage() {
  return (
    <Flex vertical gap="middle">
      <PageHeader title="Đề xuất thay đổi tổ chức" />
      <CreateRequestPanel types={ORGANIZATION_TYPES} defaults={DEFAULTS} />
    </Flex>
  );
}
