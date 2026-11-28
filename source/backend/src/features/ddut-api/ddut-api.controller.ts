import { Controller, Get, Param, Query, UseInterceptors } from '@nestjs/common';
import {
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../../shared/auth/public.decorator.js';
import { AppException } from '../../shared/exception/app.exception.js';
import { INTEGRATION_ERRORS } from '../../shared/integration-access/integration.errors.js';
import {
  IntegrationClientId,
  IntegrationInterceptor,
  IntegrationResourceOf,
} from '../../shared/integration-access/integration.interceptor.js';
import { VERSION_NUMBER_PATTERN } from '../../shared/releases/version-number.js';
import { DdutApiService } from './ddut-api.service.js';
import {
  DDUT_SHORTFALL_MODELS,
  DdutApplicableProgramDto,
  DdutCourseCatalogPageDto,
  DdutCourseCatalogQueryDto,
  DdutCourseDetailDto,
  DdutEligibilityDto,
  DdutGraduationCannotAuditOutcomeDto,
  DdutGraduationDto,
  DdutGraduationOutcomeDto,
  DdutGraduationReviewedOutcomeDto,
  DdutProgramVersionDto,
  DdutProgressDto,
  DdutSemesterQueryDto,
  DdutSyllabusDto,
  DdutSyllabusQueryDto,
} from './dto/ddut-api.dto.js';

export const DDUT_API_KEY_SCHEME = 'api-key';

// Read-only for dDUT & partner systems. Keyed strictly by natural codes (no internal CUIDs/UUIDs).
@ApiTags('dDUT v1')
@ApiSecurity(DDUT_API_KEY_SCHEME)
@ApiExtraModels(
  DdutGraduationOutcomeDto,
  DdutGraduationReviewedOutcomeDto,
  DdutGraduationCannotAuditOutcomeDto,
  ...DDUT_SHORTFALL_MODELS,
)
@Public()
@UseInterceptors(IntegrationInterceptor)
@Controller('v1')
export class DdutApiController {
  constructor(private readonly api: DdutApiService) {}

  @Get('hoc-phan')
  @IntegrationResourceOf('COURSE_CATALOG')
  @ApiOperation({
    operationId: 'ddutV1ListCourses',
    summary: 'Danh mục học phần phân trang và lọc theo mã tự nhiên',
  })
  @ApiOkResponse({ type: DdutCourseCatalogPageDto })
  courseCatalog(@Query() query: DdutCourseCatalogQueryDto) {
    return this.api.courseCatalog(query);
  }

  @Get('hoc-phan/:maHP')
  @IntegrationResourceOf('COURSE_DETAIL')
  @ApiOperation({
    operationId: 'ddutV1GetCourseDetail',
    summary:
      'Chi tiết học phần, đề cương đã công bố mới nhất, công thức điểm và quan hệ học phần theo mã học phần',
  })
  @ApiOkResponse({ type: DdutCourseDetailDto })
  courseDetail(@Param('maHP') maHP: string) {
    return this.api.courseDetail(maHP);
  }

  @Get('sinh-vien/:mssv/chuong-trinh')
  @IntegrationResourceOf('STUDENT_PROGRAM')
  @ApiOperation({
    operationId: 'ddutV1GetApplicableProgram',
    summary: 'Chương trình đào tạo áp dụng cho sinh viên',
  })
  @ApiOkResponse({ type: DdutApplicableProgramDto })
  applicableProgram(
    @IntegrationClientId() clientId: string,
    @Param('mssv') mssv: string,
    @Query() query: DdutSemesterQueryDto,
  ) {
    return this.api.applicableProgram(clientId, mssv, query.semester);
  }

  @Get('chuong-trinh/:maCT/phien-ban/:soPB')
  @IntegrationResourceOf('PROGRAM_VERSION')
  @ApiOperation({
    operationId: 'ddutV1GetProgramVersion',
    summary: 'Nội dung một phiên bản chương trình đã ban hành',
  })
  @ApiOkResponse({ type: DdutProgramVersionDto })
  programVersion(@Param('maCT') maCT: string, @Param('soPB') soPB: string) {
    if (!VERSION_NUMBER_PATTERN.test(soPB))
      throw new AppException(INTEGRATION_ERRORS.PROGRAM_NOT_FOUND);
    return this.api.programVersion(maCT, soPB);
  }

  @Get('hoc-phan/:maHP/de-cuong')
  @IntegrationResourceOf('SYLLABUS')
  @ApiOperation({
    operationId: 'ddutV1GetSyllabus',
    summary:
      'Đề cương học phần đã ghim trong phiên bản của sinh viên hoặc phiên bản được chỉ rõ',
  })
  @ApiOkResponse({ type: DdutSyllabusDto })
  syllabus(
    @IntegrationClientId() clientId: string,
    @Param('maHP') maHP: string,
    @Query() query: DdutSyllabusQueryDto,
  ) {
    return this.api.syllabus(clientId, maHP, query);
  }

  @Get('sinh-vien/:mssv/tien-do')
  @IntegrationResourceOf('PROGRESS')
  @ApiOperation({
    operationId: 'ddutV1GetProgress',
    summary: 'Tiến độ học tập theo chương trình áp dụng',
  })
  @ApiOkResponse({ type: DdutProgressDto })
  progress(
    @IntegrationClientId() clientId: string,
    @Param('mssv') mssv: string,
    @Query() query: DdutSemesterQueryDto,
  ) {
    return this.api.progress(clientId, mssv, query.semester);
  }

  @Get('sinh-vien/:mssv/hoc-phan-du-dieu-kien')
  @IntegrationResourceOf('ELIGIBILITY')
  @ApiOperation({
    operationId: 'ddutV1GetEligibility',
    summary: 'Tư vấn học phần đủ điều kiện đăng ký',
  })
  @ApiOkResponse({ type: DdutEligibilityDto })
  eligibility(
    @IntegrationClientId() clientId: string,
    @Param('mssv') mssv: string,
    @Query() query: DdutSemesterQueryDto,
  ) {
    return this.api.eligibilityFor(clientId, mssv, query.semester);
  }

  @Get('sinh-vien/:mssv/xet-tot-nghiep')
  @IntegrationResourceOf('GRADUATION')
  @ApiOperation({
    operationId: 'ddutV1GetGraduation',
    summary: 'Tự xét điều kiện tốt nghiệp (không lưu kết quả)',
  })
  @ApiOkResponse({ type: DdutGraduationDto })
  graduation(
    @IntegrationClientId() clientId: string,
    @Param('mssv') mssv: string,
    @Query() query: DdutSemesterQueryDto,
  ) {
    return this.api.graduationFor(clientId, mssv, query.semester);
  }
}
