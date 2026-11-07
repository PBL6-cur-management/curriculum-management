import { ApiProperty } from '@nestjs/swagger';
import {
  DegreeLevel,
  ProgramStatus,
  ProgramVersionStatus,
  type Prisma,
} from '../../generated/prisma/client.js';
import { EDIT_PATHS, type EditPath } from '../../shared/authz/edit-path.js';
import { toWireDecimal } from '../../shared/decimal/decimal.js';
import {
  ORG_UNIT_REF_SELECT,
  OrgUnitRefDto,
  USER_REF_SELECT,
  UserRefDto,
} from '../../shared/dtos/ref.dto.js';
import { activeDirectorWhere } from '../../shared/programs/active-director.js';
import { isReleased, releaseYearOf } from './program-release-year.js';

export class ProgramVersionRefDto {
  @ApiProperty() id!: string;
  @ApiProperty({ nullable: true, type: String }) versionNumber!: string | null;
  @ApiProperty({ enum: ProgramVersionStatus, enumName: 'ProgramVersionStatus' })
  status!: ProgramVersionStatus;
}

export class ProgramVersionInfoDto extends ProgramVersionRefDto {
  @ApiProperty() programName!: string;
  @ApiProperty() majorCode!: string;
  @ApiProperty() majorName!: string;
  @ApiProperty() semesterCount!: number;
  @ApiProperty({ example: '150' }) totalCredits!: string;
  @ApiProperty({ example: '140' }) compulsoryCredits!: string;
  @ApiProperty({ example: '10' }) electiveCredits!: string;
  @ApiProperty() updatedAt!: string;
}

export class ProgramCohortRefDto {
  @ApiProperty() id!: string;
  @ApiProperty() cohortCode!: string;
  @ApiProperty() intakeYear!: number;
}

export class ProgramReleasedVersionDto extends ProgramVersionRefDto {
  @ApiProperty({ nullable: true, type: Number }) releaseYear!: number | null;
  @ApiProperty({ type: [ProgramCohortRefDto] }) cohorts!: ProgramCohortRefDto[];
}

export class ProgramSummaryDto {
  @ApiProperty() id!: string;
  @ApiProperty() programCode!: string;
  @ApiProperty({ enum: DegreeLevel, enumName: 'DegreeLevel' })
  degreeLevel!: DegreeLevel;
  @ApiProperty({ enum: ProgramStatus, enumName: 'ProgramStatus' })
  status!: ProgramStatus;
  @ApiProperty({ type: OrgUnitRefDto }) faculty!: OrgUnitRefDto;
  @ApiProperty() programName!: string;
  @ApiProperty({ type: ProgramVersionRefDto })
  currentVersion!: ProgramVersionRefDto;
  @ApiProperty() majorCode!: string;
  @ApiProperty() majorName!: string;
  @ApiProperty({ type: [ProgramReleasedVersionDto] })
  releasedVersions!: ProgramReleasedVersionDto[];
  @ApiProperty({ type: [UserRefDto] }) directors!: UserRefDto[];
}

export class ProgramPageDto {
  @ApiProperty({ type: [ProgramSummaryDto] }) items!: ProgramSummaryDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() pageSize!: number;
}

export class ProgramClonedFromDto {
  @ApiProperty() programId!: string;
  @ApiProperty() programCode!: string;
  @ApiProperty({ type: ProgramVersionRefDto }) version!: ProgramVersionRefDto;
}

export class ProgramDetailDto extends ProgramSummaryDto {
  @ApiProperty({ type: ProgramVersionInfoDto })
  currentVersionInfo!: ProgramVersionInfoDto;
  @ApiProperty({ type: ProgramVersionInfoDto, nullable: true })
  draftVersion!: ProgramVersionInfoDto | null;
  @ApiProperty({ type: [ProgramVersionRefDto] })
  versions!: ProgramVersionRefDto[];
  @ApiProperty({ type: ProgramClonedFromDto, nullable: true })
  clonedFrom!: ProgramClonedFromDto | null;
  @ApiProperty({ enum: EDIT_PATHS, enumName: 'EditPath', nullable: true })
  editPath!: EditPath | null;
  @ApiProperty() canManage!: boolean;
  @ApiProperty() canClone!: boolean;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
}

export const VERSION_INFO_SELECT = {
  id: true,
  versionNumber: true,
  status: true,
  programName: true,
  majorCode: true,
  majorName: true,
  semesterCount: true,
  totalCredits: true,
  compulsoryCredits: true,
  electiveCredits: true,
  updatedAt: true,
} as const satisfies Prisma.ProgramVersionSelect;

export const programInclude = (today: Date) =>
  ({
    faculty: { select: ORG_UNIT_REF_SELECT },
    versions: {
      // A request's working copy and an unissued correction Draft (F-15) are not versions of the program.
      where: {
        sourceRequestId: null,
        NOT: {
          status: ProgramVersionStatus.DRAFT,
          correctionOfId: { not: null },
        },
      },
      select: {
        ...VERSION_INFO_SELECT,
        signedDate: true,
        publishedAt: true,
        cohortVersions: {
          select: {
            cohort: {
              select: { id: true, cohortCode: true, intakeYear: true },
            },
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    },
    directors: {
      where: activeDirectorWhere(today),
      select: { director: { select: USER_REF_SELECT } },
      orderBy: { createdAt: 'asc' },
    },
    clonedFrom: {
      select: {
        id: true,
        versionNumber: true,
        status: true,
        program: { select: { id: true, programCode: true } },
      },
    },
  }) satisfies Prisma.ProgramInclude;

export type ProgramRow = Prisma.ProgramGetPayload<{
  include: ReturnType<typeof programInclude>;
}>;
export type VersionInfoRow = ProgramRow['versions'][number];

// Active version, else the newest one; before the first release that is the Draft.
export function currentVersion(row: ProgramRow): VersionInfoRow {
  return (
    row.versions.find(
      (version) => version.status === ProgramVersionStatus.ACTIVE,
    ) ?? row.versions[0]
  );
}

export function draftVersion(row: ProgramRow): VersionInfoRow | undefined {
  return row.versions.find(
    (version) => version.status === ProgramVersionStatus.DRAFT,
  );
}

function toVersionRef(version: VersionInfoRow): ProgramVersionRefDto {
  return {
    id: version.id,
    versionNumber: version.versionNumber,
    status: version.status,
  };
}

export function toVersionInfo(
  version: Prisma.ProgramVersionGetPayload<{
    select: typeof VERSION_INFO_SELECT;
  }>,
): ProgramVersionInfoDto {
  return {
    id: version.id,
    versionNumber: version.versionNumber,
    status: version.status,
    programName: version.programName,
    majorCode: version.majorCode,
    majorName: version.majorName,
    semesterCount: version.semesterCount,
    totalCredits: toWireDecimal(version.totalCredits),
    compulsoryCredits: toWireDecimal(version.compulsoryCredits),
    electiveCredits: toWireDecimal(version.electiveCredits),
    updatedAt: version.updatedAt.toISOString(),
  };
}

function toReleasedVersions(row: ProgramRow): ProgramReleasedVersionDto[] {
  return row.versions
    .filter((version) => isReleased(version.status))
    .map((version) => {
      const cohorts = new Map(
        version.cohortVersions.map(({ cohort }) => [cohort.id, cohort]),
      );
      return {
        id: version.id,
        versionNumber: version.versionNumber,
        status: version.status,
        releaseYear: releaseYearOf(version.signedDate, version.publishedAt),
        cohorts: [...cohorts.values()].sort(
          (a, b) =>
            a.intakeYear - b.intakeYear ||
            a.cohortCode.localeCompare(b.cohortCode),
        ),
      };
    })
    .sort(
      (a, b) =>
        (a.releaseYear ?? Infinity) - (b.releaseYear ?? Infinity) ||
        (a.versionNumber ?? '').localeCompare(b.versionNumber ?? '', 'en', {
          numeric: true,
        }),
    );
}

export function toProgramSummaryDto(row: ProgramRow): ProgramSummaryDto {
  const current = currentVersion(row);
  return {
    id: row.id,
    programCode: row.programCode,
    degreeLevel: row.degreeLevel,
    status: row.status,
    faculty: row.faculty,
    programName: current.programName,
    currentVersion: toVersionRef(current),
    majorCode: current.majorCode,
    majorName: current.majorName,
    releasedVersions: toReleasedVersions(row),
    directors: row.directors.map((assignment) => assignment.director),
  };
}

export interface ProgramDetailExtras {
  editPath: EditPath | null;
  canManage: boolean;
  canClone: boolean;
}

export function toProgramDetailDto(
  row: ProgramRow,
  extras: ProgramDetailExtras,
): ProgramDetailDto {
  const draft = draftVersion(row);
  return Object.assign(toProgramSummaryDto(row), {
    currentVersionInfo: toVersionInfo(currentVersion(row)),
    draftVersion: draft ? toVersionInfo(draft) : null,
    versions: row.versions.map(toVersionRef),
    clonedFrom: row.clonedFrom
      ? {
          programId: row.clonedFrom.program.id,
          programCode: row.clonedFrom.program.programCode,
          version: {
            id: row.clonedFrom.id,
            versionNumber: row.clonedFrom.versionNumber,
            status: row.clonedFrom.status,
          },
        }
      : null,
    ...extras,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
}
