import { Injectable } from '@nestjs/common';
import {
  EnrollmentType,
  Prisma,
  ProgramVersionStatus,
} from '../../generated/prisma/client.js';
import type { AccessContext } from '../../shared/authz/access-context.js';
import { toWireDecimal } from '../../shared/decimal/decimal.js';
import { AppException } from '../../shared/exception/app.exception.js';
import { integrationAccess } from '../../shared/integration-access/integration-access.js';
import { INTEGRATION_ERRORS } from '../../shared/integration-access/integration.errors.js';
import { PrismaService } from '../../shared/prisma/prisma.service.js';
import { RegistrationEligibilityReader } from '../../shared/registration-eligibility/registration-eligibility.reader.js';
import { AcademicResultsReader } from '../../shared/students/academic-results.reader.js';
import { enrollmentCoversWhere } from '../../shared/students/enrollment-period.js';
import { StudentAppliedVersionReader } from '../../shared/students/student-applied-version.reader.js';
import { GraduationService } from '../graduation/graduation.service.js';
import { toRegistrationEligibilityDto } from '../registration-eligibility/registration-eligibility.mapper.js';
import {
  defaultSemester,
  issuedPin,
  StudentPortalService,
} from '../student-portal/student-portal.service.js';
import type {
  DdutApplicableProgramDto,
  DdutEligibilityDto,
  DdutGraduationDto,
  DdutMetaDto,
  DdutProgramVersionDto,
  DdutProgressDto,
  DdutStudentContextDto,
  DdutSyllabusDto,
  DdutSyllabusQueryDto,
} from './dto/ddut-api.dto.js';

const ISSUED: ProgramVersionStatus[] = [
  ProgramVersionStatus.PENDING,
  ProgramVersionStatus.ACTIVE,
  ProgramVersionStatus.HISTORICAL,
];

const REQUISITE_TYPES = ['PRIOR', 'PREREQUISITE', 'COREQUISITE'] as const;
type RequisiteType = (typeof REQUISITE_TYPES)[number];

interface StudentCall {
  access: AccessContext;
  lookup: { studentId: string; programId: string; semesterId: string };
  context: DdutStudentContextDto;
}

const meta = (): DdutMetaDto => ({
  apiVersion: 'v1',
  evaluatedAt: new Date().toISOString(),
});

// Transport only: who the student is, which semester and which PRIMARY program are read here;
// every academic answer comes from the same shared readers the web uses. Nothing here writes academic state.
@Injectable()
export class DdutApiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly versions: StudentAppliedVersionReader,
    private readonly results: AcademicResultsReader,
    private readonly eligibility: RegistrationEligibilityReader,
    private readonly graduation: GraduationService,
    private readonly portal: StudentPortalService,
  ) {}

  private async studentCall(
    clientId: string,
    studentCode: string,
    semesterCode: string | undefined,
  ): Promise<StudentCall> {
    const student = await this.prisma.student.findUnique({
      where: { studentCode: studentCode.trim().toUpperCase() },
      select: { id: true, studentCode: true },
    });
    if (!student) throw new AppException(INTEGRATION_ERRORS.STUDENT_NOT_FOUND);
    const semester = semesterCode
      ? await this.prisma.semester.findUnique({
          where: { semesterCode: semesterCode.trim() },
        })
      : await this.prisma.$transaction((tx) => defaultSemester(tx));
    if (!semester)
      throw new AppException(INTEGRATION_ERRORS.SEMESTER_NOT_FOUND);
    if (!semester.startDate)
      throw new AppException(INTEGRATION_ERRORS.NO_CONTEXT);
    // v1 answers for the PRIMARY program only (F21-04 A); a second major is not guessed.
    const enrollment = await this.prisma.programEnrollment.findFirst({
      where: {
        studentId: student.id,
        enrollmentType: EnrollmentType.PRIMARY,
        ...enrollmentCoversWhere({
          ...semester,
          startDate: semester.startDate,
        }),
      },
      select: { programId: true },
    });
    if (!enrollment) throw new AppException(INTEGRATION_ERRORS.NO_CONTEXT);
    const access = integrationAccess(clientId, student.id);
    const lookup = {
      studentId: student.id,
      programId: enrollment.programId,
      semesterId: semester.id,
    };
    const applied = await this.versions
      .forAccess(access, 'PROGRESS')
      .resolveForStudent(lookup);
    const version = await this.prisma.programVersion.findUniqueOrThrow({
      where: { id: applied.programVersionId },
      select: {
        programName: true,
        versionNumber: true,
        decisionNumber: true,
        program: { select: { programCode: true } },
      },
    });
    return {
      access,
      lookup,
      context: {
        studentCode: student.studentCode,
        enrollmentId: applied.enrollmentId,
        programCode: version.program.programCode,
        programName: version.programName,
        programVersionId: applied.programVersionId,
        versionNumber: version.versionNumber,
        decisionNumber: version.decisionNumber,
        semesterCode: semester.semesterCode,
        semesterStartDate: semester.startDate.toISOString().slice(0, 10),
        versionSource: applied.source,
      },
    };
  }

  async applicableProgram(
    clientId: string,
    studentCode: string,
    semester?: string,
  ): Promise<DdutApplicableProgramDto> {
    const call = await this.studentCall(clientId, studentCode, semester);
    return { meta: meta(), context: call.context };
  }

  async programVersion(
    programCode: string,
    versionNumber: string,
  ): Promise<DdutProgramVersionDto> {
    const version = await this.prisma.programVersion.findFirst({
      where: {
        program: { programCode: programCode.trim() },
        versionNumber,
        status: { in: ISSUED },
        publishedAt: { not: null },
      },
      select: {
        programName: true,
        majorCode: true,
        majorName: true,
        versionNumber: true,
        status: true,
        decisionNumber: true,
        semesterCount: true,
        totalCredits: true,
        compulsoryCredits: true,
        electiveCredits: true,
        publishedAt: true,
        program: { select: { programCode: true } },
        effectiveSemester: { select: { semesterCode: true } },
        electiveGroups: {
          orderBy: { groupCode: 'asc' },
          select: {
            groupCode: true,
            groupName: true,
            minCredits: true,
            minCourses: true,
          },
        },
        plos: {
          orderBy: [{ sortOrder: 'asc' }, { ploCode: 'asc' }],
          select: {
            ploCode: true,
            description: true,
            competencyGroup: true,
            sortOrder: true,
          },
        },
        curriculumItems: {
          orderBy: [{ plannedSemester: 'asc' }, { sortOrder: 'asc' }],
          select: {
            plannedSemester: true,
            sortOrder: true,
            blockSymbol: true,
            isElective: true,
            htDa: true,
            tqDa: true,
            minStudiedScore: true,
            minTransferScore: true,
            note: true,
            courseNameSnapshot: true,
            creditsSnapshot: true,
            syllabus: {
              select: { id: true, status: true, revisionNumber: true },
            },
            electiveGroup: { select: { groupCode: true } },
            course: {
              select: { courseCode: true, courseName: true, credits: true },
            },
            requisites: {
              where: { relationType: { in: [...REQUISITE_TYPES] } },
              orderBy: [{ relationType: 'asc' }],
              select: {
                relationType: true,
                minScore: true,
                sourceCourse: {
                  select: { courseCode: true, courseName: true },
                },
              },
            },
          },
        },
      },
    });
    if (!version) throw new AppException(INTEGRATION_ERRORS.PROGRAM_NOT_FOUND);
    const semesters = new Map<number, DdutProgramVersionDto['semesters'][0]>();
    for (const item of version.curriculumItems) {
      const term = semesters.get(item.plannedSemester) ?? {
        plannedSemester: item.plannedSemester,
        items: [],
      };
      term.items.push({
        course: {
          courseCode: item.course.courseCode,
          courseName: item.courseNameSnapshot ?? item.course.courseName,
        },
        credits: toWireDecimal(item.creditsSnapshot ?? item.course.credits),
        sortOrder: item.sortOrder,
        blockSymbol: item.blockSymbol,
        isElective: item.isElective,
        electiveGroupCode: item.electiveGroup?.groupCode ?? null,
        htDa: item.htDa,
        tqDa: item.tqDa,
        minStudiedScore: decimalOrNull(item.minStudiedScore),
        minTransferScore: decimalOrNull(item.minTransferScore),
        note: item.note,
        hasSyllabus: issuedPin(item.syllabus) !== null,
        requisites: item.requisites.map((requisite) => ({
          sourceCourse: requisite.sourceCourse,
          relationType: requisite.relationType as RequisiteType,
          minScore: decimalOrNull(requisite.minScore),
        })),
      });
      semesters.set(item.plannedSemester, term);
    }
    return {
      meta: meta(),
      programCode: version.program.programCode,
      programName: version.programName,
      majorCode: version.majorCode,
      majorName: version.majorName,
      versionNumber,
      status: version.status as DdutProgramVersionDto['status'],
      decisionNumber: version.decisionNumber,
      semesterCount: version.semesterCount,
      totalCredits: toWireDecimal(version.totalCredits),
      compulsoryCredits: toWireDecimal(version.compulsoryCredits),
      electiveCredits: toWireDecimal(version.electiveCredits),
      publishedAt: version.publishedAt!.toISOString(),
      effectiveSemesterCode: version.effectiveSemester?.semesterCode ?? null,
      semesters: [...semesters.values()],
      electiveGroups: version.electiveGroups.map((group) => ({
        ...group,
        minCredits: decimalOrNull(group.minCredits),
      })),
      plos: version.plos,
    };
  }

  // Exactly one selector: the student's applied version, or an explicit issued program version. Never "the newest".
  async syllabus(
    clientId: string,
    courseCode: string,
    query: DdutSyllabusQueryDto,
  ): Promise<DdutSyllabusDto> {
    const byStudent = query.mssv !== undefined;
    const byVersion =
      query.program !== undefined || query.programVersion !== undefined;
    if (
      byStudent === byVersion ||
      (byVersion && (!query.program || !query.programVersion)) ||
      (!byStudent && query.semester !== undefined)
    )
      throw new AppException(INTEGRATION_ERRORS.SELECTOR_REQUIRED);
    let versionId: string;
    let context: DdutSyllabusDto['context'];
    if (byStudent) {
      const call = await this.studentCall(
        clientId,
        query.mssv!,
        query.semester,
      );
      versionId = call.context.programVersionId;
      context = {
        programCode: call.context.programCode,
        versionNumber: call.context.versionNumber,
        studentCode: call.context.studentCode,
      };
    } else {
      const version = await this.prisma.programVersion.findFirst({
        where: {
          program: { programCode: query.program!.trim() },
          versionNumber: query.programVersion!,
          status: { in: ISSUED },
          publishedAt: { not: null },
        },
        select: { id: true, versionNumber: true },
      });
      if (!version)
        throw new AppException(INTEGRATION_ERRORS.PROGRAM_NOT_FOUND);
      versionId = version.id;
      context = {
        programCode: query.program!.trim(),
        versionNumber: query.programVersion!,
        studentCode: null,
      };
    }
    const item = await this.prisma.curriculumItem.findFirst({
      where: { versionId, course: { courseCode: courseCode.trim() } },
      select: {
        syllabus: { select: { id: true, status: true, revisionNumber: true } },
      },
    });
    if (!item) throw new AppException(INTEGRATION_ERRORS.COURSE_NOT_IN_PROGRAM);
    const pin = issuedPin(item.syllabus);
    if (!pin) throw new AppException(INTEGRATION_ERRORS.SYLLABUS_NOT_ISSUED);
    return {
      meta: meta(),
      context,
      syllabus: await this.portal.syllabusProjection(pin),
    };
  }

  async progress(
    clientId: string,
    studentCode: string,
    semester?: string,
  ): Promise<DdutProgressDto> {
    const call = await this.studentCall(clientId, studentCode, semester);
    const attempts = await this.prisma.$transaction(
      (tx) =>
        this.results
          .forAccess(call.access, 'PROGRESS')
          .forStudent(call.lookup, tx),
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    const curriculum = await this.portal.curriculumFor(
      call.access,
      call.lookup,
    );
    const outcome = await this.graduation.live(call.access, call.lookup);
    return {
      meta: meta(),
      context: call.context,
      academicStatus: attempts.length ? 'HAS_RESULTS' : 'NO_ACADEMIC_RESULTS',
      credits: outcome.status === 'REVIEWED' ? outcome.result.credits : null,
      creditsUnavailable:
        outcome.status === 'CANNOT_AUDIT'
          ? { code: outcome.error.code, message: outcome.error.message }
          : null,
      terms: curriculum.terms,
    };
  }

  async eligibilityFor(
    clientId: string,
    studentCode: string,
    semester?: string,
  ): Promise<DdutEligibilityDto> {
    const call = await this.studentCall(clientId, studentCode, semester);
    return {
      meta: meta(),
      context: call.context,
      eligibility: toRegistrationEligibilityDto(
        await this.eligibility.forAccess(call.access).evaluate(call.lookup),
      ),
    };
  }

  async graduationFor(
    clientId: string,
    studentCode: string,
    semester?: string,
  ): Promise<DdutGraduationDto> {
    const call = await this.studentCall(clientId, studentCode, semester);
    return {
      meta: meta(),
      context: call.context,
      graduation: await this.graduation.live(call.access, call.lookup),
    };
  }
}

function decimalOrNull(value: Prisma.Decimal | null): string | null {
  return value === null ? null : toWireDecimal(value);
}
