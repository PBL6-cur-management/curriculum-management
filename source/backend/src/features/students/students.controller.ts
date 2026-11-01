import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { AccessContext } from '../../shared/authz/access-context.js';
import { CurrentAccess } from '../../shared/authz/current-access.decorator.js';
import { PERMISSIONS } from '../../shared/authz/permission-codes.js';
import { RequirePermission } from '../../shared/authz/require-permission.decorator.js';
import { AcademicResultPageDto } from './dto/academic-result.dto.js';
import {
  ReconcileStudentDto,
  StudentEnrollmentCommandDto,
} from './dto/student-enrollment-command.dto.js';
import {
  StudentContextQueryDto,
  StudentDetailQueryDto,
  StudentListQueryDto,
  StudentResultsQueryDto,
  StudentOptionalSemesterQueryDto,
} from './dto/student-query.dto.js';
import {
  StudentAppliedVersionDto,
  StudentDetailDto,
  StudentEnrollmentDto,
  StudentEnrollmentTargetDto,
  StudentPageDto,
  StudentProgramOptionDto,
  StudentReconciliationDto,
} from './dto/student.dto.js';
import { StudentEnrollmentsService } from './student-enrollments.service.js';
import { StudentsReadService } from './students-read.service.js';

// The permission only opens the door; each service re-checks the caller's role and ownership for the student it is asked about.
@ApiTags('students')
@ApiCookieAuth()
@Controller('students')
export class StudentsController {
  constructor(
    private readonly reads: StudentsReadService,
    private readonly enrollments: StudentEnrollmentsService,
  ) {}

  // Declared before the parameter routes so "program-options" is never read as a student id.
  @Get('program-options')
  @RequirePermission(PERMISSIONS.STUDENT_VIEW_PROGRESS)
  @ApiOkResponse({ type: [StudentProgramOptionDto] })
  programOptions(
    @Query() query: StudentOptionalSemesterQueryDto,
    @CurrentAccess() access: AccessContext,
  ) {
    return this.reads.programOptions(access, query);
  }

  @Get()
  @RequirePermission(PERMISSIONS.STUDENT_VIEW_PROGRESS)
  @ApiOkResponse({ type: StudentPageDto })
  list(
    @Query() query: StudentListQueryDto,
    @CurrentAccess() access: AccessContext,
  ) {
    return this.reads.list(access, query);
  }

  @Get(':studentId')
  @RequirePermission(PERMISSIONS.STUDENT_VIEW_PROGRESS)
  @ApiOkResponse({ type: StudentDetailDto })
  detail(
    @Param('studentId') studentId: string,
    @Query() query: StudentDetailQueryDto,
    @CurrentAccess() access: AccessContext,
  ) {
    return this.reads.detail(access, studentId, query);
  }

  @Get(':studentId/results')
  @RequirePermission(PERMISSIONS.STUDENT_VIEW_PROGRESS)
  @ApiOkResponse({ type: AcademicResultPageDto })
  results(
    @Param('studentId') studentId: string,
    @Query() query: StudentResultsQueryDto,
    @CurrentAccess() access: AccessContext,
  ) {
    return this.reads.listResults(access, studentId, query);
  }

  @Get(':studentId/applied-version')
  @RequirePermission(PERMISSIONS.STUDENT_VIEW_PROGRESS)
  @ApiOkResponse({ type: StudentAppliedVersionDto })
  appliedVersion(
    @Param('studentId') studentId: string,
    @Query() query: StudentContextQueryDto,
    @CurrentAccess() access: AccessContext,
  ) {
    return this.reads.appliedVersion(access, studentId, query);
  }

  @Get(':studentId/enrollment-targets')
  @RequirePermission(PERMISSIONS.VERSION_ASSIGN_COHORT)
  @ApiOkResponse({ type: [StudentEnrollmentTargetDto] })
  enrollmentTargets(
    @Param('studentId') studentId: string,
    @Query() query: StudentContextQueryDto,
    @CurrentAccess() access: AccessContext,
  ) {
    return this.reads.enrollmentTargets(access, studentId, query);
  }

  @Post(':studentId/enrollments')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission(PERMISSIONS.VERSION_ASSIGN_COHORT)
  @ApiCreatedResponse({ type: StudentEnrollmentDto })
  createEnrollment(
    @Param('studentId') studentId: string,
    @Body() dto: StudentEnrollmentCommandDto,
    @CurrentAccess() access: AccessContext,
  ) {
    return this.enrollments.create(access, studentId, dto);
  }

  @Post(':studentId/reconcile-enrollments')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(PERMISSIONS.VERSION_ASSIGN_COHORT)
  @ApiOkResponse({ type: StudentReconciliationDto })
  reconcile(
    @Param('studentId') studentId: string,
    @Body() dto: ReconcileStudentDto,
    @CurrentAccess() access: AccessContext,
  ) {
    return this.enrollments.reconcile(access, studentId, dto);
  }
}
