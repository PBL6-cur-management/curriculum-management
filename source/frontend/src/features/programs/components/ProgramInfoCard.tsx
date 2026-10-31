import { Card, Descriptions, Tag } from 'antd';
import type { ReactNode } from 'react';
import { Link, generatePath } from 'react-router';
import { ROUTES } from '../../../routes';
import type { ProgramDetail } from '../api/programs';
import {
  DEGREE_LEVEL_LABELS,
  VERSION_STATUS_LABELS,
  versionLabel,
} from '../constants/programLabels';

interface ProgramInfoCardProps {
  program: ProgramDetail;
  // Program-level commands (edit, clone, stop) shown in the card header.
  actions?: ReactNode;
}

const EMPTY = '—';

// Shows the working version: the Draft when there is one, else the current version.
export function ProgramInfoCard({ program, actions }: ProgramInfoCardProps) {
  const info = program.draftVersion ?? program.currentVersionInfo;
  const source = program.clonedFrom;
  return (
    <Card title="Thông tin chương trình" extra={actions}>
      <Descriptions column={{ xs: 1, md: 2 }}>
        <Descriptions.Item label="Mã chương trình">
          {program.programCode}
        </Descriptions.Item>
        <Descriptions.Item label="Phiên bản">
          {versionLabel(info)} <Tag>{VERSION_STATUS_LABELS[info.status]}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="Tên chương trình">
          {info.programName}
        </Descriptions.Item>
        <Descriptions.Item label="Trình độ">
          {DEGREE_LEVEL_LABELS[program.degreeLevel]}
        </Descriptions.Item>
        <Descriptions.Item label="Mã ngành">{info.majorCode}</Descriptions.Item>
        <Descriptions.Item label="Tên ngành">
          {info.majorName}
        </Descriptions.Item>
        <Descriptions.Item label="Số học kỳ">
          {info.semesterCount}
        </Descriptions.Item>
        <Descriptions.Item label="Khoa quản lý">
          {program.faculty.unitName}
        </Descriptions.Item>
        <Descriptions.Item label="Tổng tín chỉ">
          {info.totalCredits}
        </Descriptions.Item>
        <Descriptions.Item label="Tín chỉ bắt buộc">
          {info.compulsoryCredits}
        </Descriptions.Item>
        <Descriptions.Item label="Tín chỉ tự chọn">
          {info.electiveCredits}
        </Descriptions.Item>
        <Descriptions.Item label="Nhân bản từ">
          {source ? (
            <>
              <Link
                to={generatePath(ROUTES.programDetail, {
                  programId: source.programId,
                })}
              >
                {source.programCode}
              </Link>{' '}
              — {versionLabel(source.version)}
            </>
          ) : (
            EMPTY
          )}
        </Descriptions.Item>
      </Descriptions>
    </Card>
  );
}
