import { ApiProperty } from '@nestjs/swagger';
import {
  EnrollmentStatus,
  EnrollmentType,
  StudentDataSource,
  StudentStatus,
} from '../../../generated/prisma/client.js';
import {
  CohortDto,
  SemesterDto,
} from '../../../shared/releases/semester.dto.js';

export const ISSUED_VERSION_STATUSES = [
  'PENDING',
  'ACTIVE',
  'HISTORICAL',
] as const;
export type IssuedVersionStatus = (typeof ISSUED_VERSION_STATUSES)[number];
export const APPLIED_VERSION_SOURCES = ['COHORT', 'EXCEPTION'] as const;

export class StudentProgramOptionDto {
  @ApiProperty() id!: string;
  @ApiProperty() programCode!: string;
  @ApiProperty() programName!: string;
}

export class StudentSummaryDto {
  @ApiProperty() id!: string;
  @ApiProperty() studentCode!: string;
  @ApiProperty() fullName!: string;
  @ApiProperty({ type: CohortDto }) cohort!: CohortDto;
  @ApiProperty() major!: string;
  @ApiProperty({ enum: StudentStatus, enumName: 'StudentStatus' })
  status!: StudentStatus;
  @ApiProperty({ enum: StudentDataSource, enumName: 'StudentDataSource' })
  dataSource!: StudentDataSource;
  @ApiProperty() updatedAt!: string;
}

export class StudentPageDto {
  @ApiProperty({ type: [StudentSummaryDto] }) items!: StudentSummaryDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() pageSize!: number;
}

export class StudentIssuedVersionDto {
  @ApiProperty() id!: string;
  @ApiProperty() versionNumber!: string;
  @ApiProperty({
    enum: ISSUED_VERSION_STATUSES,
    enumName: 'IssuedVersionStatus',
  })
  status!: IssuedVersionStatus;
}

export class StudentEnrollmentDto {
  @ApiProperty() id!: string;
  @ApiProperty() studentId!: string;
  @ApiProperty({ type: StudentProgramOptionDto })
  program!: StudentProgramOptionDto;
  @ApiProperty({ type: CohortDto }) cohort!: CohortDto;
  @ApiProperty({ type: StudentIssuedVersionDto })
  appliedVersion!: StudentIssuedVersionDto;
  @ApiProperty() admissionVersionId!: string;
  @ApiProperty({ type: String, nullable: true }) cohortAssignmentId!:
    string | null;
  @ApiProperty({ type: SemesterDto }) fromSemester!: SemesterDto;
  @ApiProperty({ type: SemesterDto, nullable: true })
  untilSemester!: SemesterDto | null;
  @ApiProperty({ type: String, nullable: true }) previousEnrollmentId!:
    string | null;
  @ApiProperty({ enum: EnrollmentType, enumName: 'EnrollmentType' })
  enrollmentType!: EnrollmentType;
  @ApiProperty() isException!: boolean;
  @ApiProperty({ type: String, nullable: true }) basisDecision!: string | null;
  @ApiProperty({ enum: EnrollmentStatus, enumName: 'EnrollmentStatus' })
  status!: EnrollmentStatus;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
}

export class StudentEnrollmentWarningDto {
  @ApiProperty() code!: string;
  @ApiProperty() message!: string;
  @ApiProperty({ type: String, nullable: true }) enrollmentId!: string | null;
}

export class StudentDetailDto extends StudentSummaryDto {
  @ApiProperty({ type: String, nullable: true }) userId!: string | null;
  @ApiProperty({ type: SemesterDto }) admissionSemester!: SemesterDto;
  @ApiProperty({ type: SemesterDto }) statusSemester!: SemesterDto;
  @ApiProperty({ type: [StudentEnrollmentDto] })
  enrollments!: StudentEnrollmentDto[];
  @ApiProperty() canManageEnrollments!: boolean;
  @ApiProperty({ type: [StudentEnrollmentWarningDto] })
  enrollmentWarnings!: StudentEnrollmentWarningDto[];
}

export class StudentEnrollmentTargetDto {
  @ApiProperty({ type: StudentIssuedVersionDto })
  version!: StudentIssuedVersionDto;
  @ApiProperty({ type: StudentProgramOptionDto })
  program!: StudentProgramOptionDto;
  @ApiProperty({ type: SemesterDto }) effectiveSemester!: SemesterDto;
}

export class StudentAppliedVersionDto {
  @ApiProperty() studentId!: string;
  @ApiProperty() enrollmentId!: string;
  @ApiProperty() programId!: string;
  @ApiProperty() semesterId!: string;
  @ApiProperty() programVersionId!: string;
  @ApiProperty({
    enum: APPLIED_VERSION_SOURCES,
    enumName: 'AppliedVersionSource',
  })
  source!: 'COHORT' | 'EXCEPTION';
  @ApiProperty({ type: String, nullable: true }) cohortAssignmentId!:
    string | null;
}

export class StudentReconciliationDto {
  @ApiProperty() transitioned!: number;
  @ApiProperty() unchanged!: number;
  @ApiProperty() blocked!: number;
}
