import { AppException } from '../../shared/exception/app.exception.js';
import { ELIGIBILITY_ERRORS } from '../../shared/registration-eligibility/eligibility.errors.js';
import { eligibilityStatusText } from '../../shared/registration-eligibility/eligibility-reasons.js';
import type {
  EligibilityCourseRef,
  RegistrationEligibilityAnswer,
} from '../../shared/registration-eligibility/eligibility.types.js';
import type { RegistrationEligibilityDto } from './dto/registration-eligibility.dto.js';

const courseRef = (course: EligibilityCourseRef): EligibilityCourseRef => ({
  id: course.id,
  courseCode: course.courseCode,
  courseName: course.courseName,
  nameSource: course.nameSource,
});
const nullableRef = (course: EligibilityCourseRef | null) =>
  course === null ? null : courseRef(course);
export function toRegistrationEligibilityDto(
  answer: RegistrationEligibilityAnswer,
): RegistrationEligibilityDto {
  const context = answer.context;
  return {
    contractVersion: 1,
    context: {
      studentId: context.studentId,
      enrollmentId: context.enrollmentId,
      programId: context.programId,
      semesterId: context.semesterId,
      programVersionId: context.programVersionId,
      source: context.source,
      cohortAssignmentId: context.cohortAssignmentId,
    },
    evaluatedAt: answer.evaluatedAt,
    items: answer.items.map((item) => {
      const invalid = item.completed
        ? item.eligibility !== null ||
          item.reasons.length !== 1 ||
          !['COURSE_COMPLETED', 'EQUIVALENT_COMPLETED'].includes(
            item.reasons[0].code,
          ) ||
          item.requiredConcurrentCourses.length !== 0
        : item.eligibility === null ||
          (item.eligibility === 'ELIGIBLE'
            ? item.reasons.length !== 0 ||
              item.requiredConcurrentCourses.length !== 0
            : item.eligibility === 'CONDITIONAL'
              ? !item.requiredConcurrentCourses.length ||
                item.reasons.length !== item.requiredConcurrentCourses.length ||
                item.reasons.some(
                  (reason) => reason.code !== 'COREQUISITE_REQUIRED',
                )
              : !item.reasons.length ||
                item.requiredConcurrentCourses.length !== 0);
      if (
        invalid ||
        item.statusText !==
          eligibilityStatusText(item.completed, item.eligibility)
      )
        throw new AppException(ELIGIBILITY_ERRORS.DATA_INVALID);
      if (item.eligibility === 'CONDITIONAL') {
        const required = new Set(
          item.requiredConcurrentCourses.map((course) => course.id),
        );
        if (
          required.size !== item.requiredConcurrentCourses.length ||
          required.has(item.course.id) ||
          item.reasons.some(
            (reason) =>
              !reason.requiredCourse ||
              !required.delete(reason.requiredCourse.id),
          ) ||
          required.size
        )
          throw new AppException(ELIGIBILITY_ERRORS.DATA_INVALID);
      }
      return {
        itemId: item.itemId,
        course: courseRef(item.course),
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
          requiredCourse: nullableRef(reason.requiredCourse),
          viaCourse: nullableRef(reason.viaCourse),
          evidenceCourse: nullableRef(reason.evidenceCourse),
          evidenceResultId: reason.evidenceResultId,
          requiredScore4: reason.requiredScore4,
          actualScore4: reason.actualScore4,
          actualStatus: reason.actualStatus,
          path: reason.path.map(courseRef),
        })),
        requiredConcurrentCourses:
          item.requiredConcurrentCourses.map(courseRef),
      };
    }),
    warnings: answer.warnings.map((warning) => ({
      code: warning.code,
      message: warning.message,
      course: courseRef(warning.course),
    })),
  };
}
