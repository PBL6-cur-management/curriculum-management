import type { GraduationOutcome, GraduationShortfall } from '../../shared/graduation/graduation.types.js';
import type { RegistrationEligibilityDto, EligibilityCourseRefDto } from '../registration-eligibility/dto/registration-eligibility.dto.js';
import type { PortalSyllabusDto, PortalTermDto } from '../student-portal/dto/student-portal.dto.js';
import type {
  DdutCourseRefDto,
  DdutEligibilityCourseRefDto,
  DdutGraduationOutcome,
  DdutGraduationShortfallDto,
  DdutProgressTermDto,
  DdutRegistrationEligibilityDto,
  DdutStudentContextDto,
  DdutSyllabusContentDto,
} from './dto/ddut-api.dto.js';

export function toDdutSyllabusContent(
  syllabus: PortalSyllabusDto,
): DdutSyllabusContentDto {
  return {
    courseCode: syllabus.courseCode,
    courseName: syllabus.courseName,
    credits: syllabus.credits,
    revisionNumber: syllabus.revisionNumber,
    publishedAt: syllabus.publishedAt,
    courseDescription: syllabus.courseDescription,
    objectives: syllabus.objectives,
    teachingMethods: syllabus.teachingMethods,
    assessmentMethods: syllabus.assessmentMethods,
    references: syllabus.references,
    clos: syllabus.clos,
    weeks: syllabus.weeks,
    assessments: syllabus.assessments,
    attachments: syllabus.attachments.map((attachment) => ({
      fileName: attachment.fileName,
      materialKind: attachment.materialKind,
      sizeBytes: attachment.sizeBytes,
    })),
  };
}

export function toDdutProgressTerms(
  terms: PortalTermDto[],
): DdutProgressTermDto[] {
  return terms.map((term) => ({
    plannedSemester: term.plannedSemester,
    credits: term.credits,
    courses: term.courses.map((course) => ({
      courseCode: course.courseCode,
      courseName: course.courseName,
      credits: course.credits,
      isElective: course.isElective,
      groupName: course.groupName,
      blockSymbol: course.blockSymbol,
      state: course.state,
      attemptCount: course.attemptCount,
      score10: course.score10,
      score4: course.score4,
      letterGrade: course.letterGrade,
      hasSyllabus: course.hasSyllabus,
    })),
  }));
}

function toEligibilityCourseRef(
  ref: EligibilityCourseRefDto,
): DdutEligibilityCourseRefDto {
  return {
    courseCode: ref.courseCode,
    courseName: ref.courseName,
    nameSource: ref.nameSource,
  };
}

export function toDdutEligibility(
  raw: RegistrationEligibilityDto,
  context: DdutStudentContextDto,
): DdutRegistrationEligibilityDto {
  return {
    contractVersion: raw.contractVersion,
    context: {
      studentCode: context.studentCode,
      programCode: context.programCode,
      versionNumber: context.versionNumber,
      semesterCode: context.semesterCode,
      source: raw.context.source,
    },
    evaluatedAt: raw.evaluatedAt,
    items: raw.items.map((item) => ({
      course: toEligibilityCourseRef(item.course),
      credits: item.credits,
      catalogStatus: item.catalogStatus,
      plannedSemester: item.plannedSemester,
      completed: item.completed,
      eligibility: item.eligibility,
      statusText: item.statusText,
      reasons: item.reasons.map((reason) => ({
        code: reason.code,
        causeCode: reason.causeCode,
        message: reason.message,
        relationType: reason.relationType,
        requiredCourse: reason.requiredCourse
          ? toEligibilityCourseRef(reason.requiredCourse)
          : null,
        viaCourse: reason.viaCourse
          ? toEligibilityCourseRef(reason.viaCourse)
          : null,
        evidenceCourse: reason.evidenceCourse
          ? toEligibilityCourseRef(reason.evidenceCourse)
          : null,
        requiredScore4: reason.requiredScore4,
        actualScore4: reason.actualScore4,
        actualStatus: reason.actualStatus,
        path: reason.path.map(toEligibilityCourseRef),
      })),
      requiredConcurrentCourses: item.requiredConcurrentCourses.map(
        toEligibilityCourseRef,
      ),
    })),
    warnings: raw.warnings.map((warning) => ({
      code: warning.code,
      message: warning.message,
      course: toEligibilityCourseRef(warning.course),
    })),
  };
}

function toCourseRef(ref: {
  courseCode: string;
  courseName: string;
}): DdutCourseRefDto {
  return { courseCode: ref.courseCode, courseName: ref.courseName };
}

function toShortfall(
  shortfall: GraduationShortfall,
): DdutGraduationShortfallDto {
  switch (shortfall.code) {
    case 'MANDATORY_COURSE_MISSING':
      return {
        code: 'MANDATORY_COURSE_MISSING',
        category: 'MANDATORY_COURSE',
        course: toCourseRef(shortfall.course),
        blockSymbol: shortfall.blockSymbol,
        reason: shortfall.reason,
        message: shortfall.message,
      };
    case 'CONDITIONAL_COURSE_MISSING':
      return {
        code: 'CONDITIONAL_COURSE_MISSING',
        category: 'CONDITIONAL_COURSE',
        course: toCourseRef(shortfall.course),
        blockSymbol: shortfall.blockSymbol,
        reason: shortfall.reason,
        message: shortfall.message,
      };
    case 'ELECTIVE_CREDITS_MISSING':
      return {
        code: 'ELECTIVE_CREDITS_MISSING',
        category: 'ELECTIVE_GROUP',
        groupCode: shortfall.groupCode,
        groupName: shortfall.groupName,
        requiredCredits: shortfall.requiredCredits,
        earnedCredits: shortfall.earnedCredits,
        missingCredits: shortfall.missingCredits,
        message: shortfall.message,
      };
    case 'ELECTIVE_COURSES_MISSING':
      return {
        code: 'ELECTIVE_COURSES_MISSING',
        category: 'ELECTIVE_GROUP',
        groupCode: shortfall.groupCode,
        groupName: shortfall.groupName,
        requiredCourses: shortfall.requiredCourses,
        earnedCourses: shortfall.earnedCourses,
        missingCourses: shortfall.missingCourses,
        message: shortfall.message,
      };
    case 'LOW_GPA':
      return {
        code: 'LOW_GPA',
        category: 'GPA',
        requiredGpa: shortfall.requiredGpa,
        actualGpa: shortfall.actualGpa,
        message: shortfall.message,
      };
    case 'TRACK_NOT_SELECTED':
      return {
        code: 'TRACK_NOT_SELECTED',
        category: 'TRACK',
        message: shortfall.message,
      };
    case 'TOTAL_CREDITS_MISSING':
      return {
        code: 'TOTAL_CREDITS_MISSING',
        category: 'TOTAL_CREDITS',
        requiredCredits: shortfall.requiredCredits,
        earnedCredits: shortfall.earnedCredits,
        missingCredits: shortfall.missingCredits,
        message: shortfall.message,
      };
  }
}

export function toDdutGraduation(
  outcome: GraduationOutcome,
  lookups: {
    courseCodesById: ReadonlyMap<string, string>;
    equivalenceGroupCodesById: ReadonlyMap<string, string>;
  },
): DdutGraduationOutcome {
  if (outcome.status === 'CANNOT_AUDIT') {
    return {
      status: 'CANNOT_AUDIT',
      result: null,
      error: {
        code: outcome.error.code,
        message: outcome.error.message,
      },
    };
  }
  const { result } = outcome;
  const electiveGroupCodesById = new Map(
    result.electiveGroups.map((group) => [group.groupId, group.groupCode]),
  );
  return {
    status: 'REVIEWED',
    error: null,
    result: {
      schemaVersion: result.schemaVersion,
      ruleVersion: result.ruleVersion,
      evaluatedAt: result.evaluatedAt,
      context: {
        studentCode: result.context.studentCode,
        fullName: result.context.fullName,
        programCode: result.context.programCode,
        programName: result.context.programName,
        cohortCode: result.context.cohortCode,
        versionNumber: result.context.versionNumber,
        semesterCode: result.context.semesterCode,
        semesterStartDate: result.context.semesterStartDate,
        versionSource: result.context.versionSource,
      },
      conclusion: result.conclusion,
      ...(result.cumulativeGpa !== undefined && {
        cumulativeGpa: result.cumulativeGpa,
      }),
      ...(result.minGraduationGpa !== undefined && {
        minGraduationGpa: result.minGraduationGpa,
      }),
      shortfalls: result.shortfalls.map(toShortfall),
      warnings: result.warnings.map((warning) => ({
        code: warning.code,
        courseCode: warning.courseId
          ? (lookups.courseCodesById.get(warning.courseId) ?? null)
          : null,
        creditGap: warning.creditGap,
        message: warning.message,
      })),
      credits: result.credits,
      electiveGroups: result.electiveGroups.map((group) => ({
        groupCode: group.groupCode,
        groupName: group.groupName,
        requiredCredits: group.requiredCredits,
        earnedCredits: group.earnedCredits,
        missingCredits: group.missingCredits,
        requiredCourses: group.requiredCourses,
        earnedCourses: group.earnedCourses,
        missingCourses: group.missingCourses,
      })),
      knowledgeBlocks: result.knowledgeBlocks,
      recognitions: result.recognitions.map((rec) => ({
        requiredCourse: toCourseRef(rec.requiredCourse),
        studiedCourse: toCourseRef(rec.studiedCourse),
        attemptRevision: rec.attemptRevision,
        completionStatus: rec.completionStatus,
        viaEquivalence: rec.viaEquivalence,
        equivalenceGroupCode: rec.equivalenceGroupId
          ? (lookups.equivalenceGroupCodesById.get(rec.equivalenceGroupId) ??
            null)
          : null,
        requiredCredits: rec.requiredCredits,
        recognizedCredits: rec.recognizedCredits,
        creditBasis: rec.creditBasis,
        category: rec.category,
        electiveGroupCode: rec.electiveGroupId
          ? (electiveGroupCodesById.get(rec.electiveGroupId) ?? null)
          : null,
        blockSymbol: rec.blockSymbol,
      })),
      freeCredits: result.freeCredits.map((free) => ({
        course: toCourseRef(free.course),
        credits: free.credits,
        creditBasis: free.creditBasis,
        reason: free.reason,
      })),
    },
  };
}
