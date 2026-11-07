import { Flex, Typography } from 'antd';
import { Link, generatePath } from 'react-router';
import { ROUTES } from '../../../routes';
import type { ProgramReleasedVersion } from '../api/programs';
import {
  IN_USE_VERSION_LABEL,
  NO_RELEASED_VERSION_LABEL,
  versionLabel,
} from '../constants/programLabels';

interface ReleasedVersionLinksProps {
  programId: string;
  versions: ProgramReleasedVersion[];
}

export function ReleasedVersionLinks({
  programId,
  versions,
}: ReleasedVersionLinksProps) {
  if (!versions.length) {
    return (
      <Typography.Text type="secondary">
        {NO_RELEASED_VERSION_LABEL}
      </Typography.Text>
    );
  }
  return (
    <Flex vertical>
      {versions.map((version) => (
        <span key={version.id}>
          <Link
            to={generatePath(ROUTES.curriculum, {
              programId,
              versionId: version.id,
            })}
          >
            {version.releaseYear === null
              ? versionLabel(version)
              : `${versionLabel(version)} · ${version.releaseYear}`}
          </Link>
          {version.status === 'ACTIVE' && (
            <Typography.Text type="secondary">
              {' '}
              {IN_USE_VERSION_LABEL}
            </Typography.Text>
          )}
        </span>
      ))}
    </Flex>
  );
}
