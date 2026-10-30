import { Injectable } from '@nestjs/common';
import {
  CourseRelationType,
  CourseStatus,
} from '../../generated/prisma/client.js';
import type { AccessContext } from '../../shared/authz/access-context.js';
import { ConsistencyChecker } from '../../shared/curriculum/consistency-checker.js';
import {
  CURRICULUM_WARNING,
  type CurriculumWarningCode,
} from '../../shared/curriculum/curriculum-warnings.js';
import { OutcomeGapsReader } from '../../shared/outcomes/outcome-gaps.reader.js';
import { PrismaService } from '../../shared/prisma/prisma.service.js';
import {
  loadAssessmentRules,
  uncoveredClos,
} from '../../shared/syllabi/grade-formula.rules.js';
import { revisionForItems } from '../../shared/syllabi/revision-for-items.js';
import {
  HEALTH_CATEGORIES,
  type HealthCategory,
  type HealthTarget,
} from './publication.constants.js';
import type { HealthIssueDto, ProgramHealthDto } from './publication.dto.js';

// Issues are found without their course; read() fills courseId in one place.
type FoundIssue = Omit<HealthIssueDto, 'courseId'>;
import {
  PublicationSourceReader,
  versionRef,
} from './publication-source.reader.js';

const CHECKER_MAP: Record<
  CurriculumWarningCode,
  { category: HealthCategory; target: HealthTarget }
> = {
  [CURRICULUM_WARNING.CREDIT_MISMATCH]: {
    category: 'CREDIT',
    target: 'VERSION_INFO',
  },
  [CURRICULUM_WARNING.CREDIT_MISMATCH_ACCEPTED]: {
    category: 'CREDIT',
    target: 'VERSION_INFO',
  },
  [CURRICULUM_WARNING.REQUISITE_NOT_EARLIER]: {
    category: 'REQUISITE_ORDER',
    target: 'CURRICULUM',
  },
  [CURRICULUM_WARNING.REQUISITE_CYCLE]: {
    category: 'REQUISITE_ORDER',
    target: 'CURRICULUM',
  },
  [CURRICULUM_WARNING.REQUISITE_OUTSIDE]: {
    category: 'REQUISITE_OUTSIDE',
    target: 'CURRICULUM',
  },
  [CURRICULUM_WARNING.EMPTY_SEMESTER]: {
    category: 'EMPTY_SEMESTER',
    target: 'CURRICULUM',
  },
  [CURRICULUM_WARNING.MISSING_SYLLABUS]: {
    category: 'SYLLABUS',
    target: 'SYLLABUS',
  },
  [CURRICULUM_WARNING.ELECTIVE_WITHOUT_GROUP]: {
    category: 'OTHER',
    target: 'ELECTIVE_GROUPS',
  },
  [CURRICULUM_WARNING.GROUP_MINIMUM_UNREACHABLE]: {
    category: 'OTHER',
    target: 'ELECTIVE_GROUPS',
  },
  [CURRICULUM_WARNING.DUPLICATE_COURSE]: {
    category: 'OTHER',
    target: 'CURRICULUM',
  },
};

const SEVERITY_RANK = { ERROR: 0, HIGH: 1, INFO: 2 } as const;

// MH-28 — US-113: one board over the checks that already exist (consistency checker, outcome gaps) plus
// assessment coverage of CLOs and discontinued courses. Diagnostic only: nothing here blocks a write.
@Injectable()
export class ProgramHealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly source: PublicationSourceReader,
    private readonly checker: ConsistencyChecker,
    private readonly gaps: OutcomeGapsReader,
  ) {}

  async read(
    access: AccessContext,
    programId: string,
    versionId: string,
  ): Promise<ProgramHealthDto> {
    const version = await this.source.read(access, programId, versionId);
    const [consistency, outcome, assessment, replacement] = await Promise.all([
      this.checker.check(versionId),
      this.gaps.forVersion(versionId),
      this.assessmentIssues(version),
      this.replacementIssues(version),
    ]);
    const codeOfItem = new Map(
      version.curriculumItems.map((item) => [item.id, item.course.courseCode]),
    );
    const found: FoundIssue[] = [
      ...consistency.issues.map((issue) => ({
        ...CHECKER_MAP[issue.code],
        code: issue.code,
        severity: issue.severity,
        message: issue.message,
        semester: issue.semester,
        itemId: issue.itemId,
        courseCode: issue.itemId
          ? (codeOfItem.get(issue.itemId) ?? null)
          : null,
      })),
      ...outcome.plosWithoutCourse.map((plo) => ({
        category: 'PLO_COVERAGE' as const,
        code: 'PLO_WITHOUT_COURSE',
        severity: 'HIGH' as const,
        message: `${plo.ploCode} chưa có học phần nào đóng góp.`,
        semester: null,
        itemId: null,
        courseCode: null,
        target: 'COURSE_PLO_MATRIX' as const,
      })),
      ...outcome.coursesWithoutPlo.map((course) => ({
        category: 'PLO_COVERAGE' as const,
        code: 'COURSE_WITHOUT_PLO',
        severity: 'HIGH' as const,
        message: `${course.courseCode} chưa đóng góp PLO nào.`,
        semester: course.plannedSemester,
        itemId: course.itemId,
        courseCode: course.courseCode,
        target: 'COURSE_PLO_MATRIX' as const,
      })),
      ...outcome.closWithoutPlo.map((clo) => ({
        category: 'PLO_COVERAGE' as const,
        code: 'CLO_WITHOUT_PLO',
        severity: 'INFO' as const,
        message: `${clo.courseCode} ${clo.cloCode} chưa liên kết PLO.`,
        semester: clo.plannedSemester,
        itemId: clo.itemId,
        courseCode: clo.courseCode,
        target: 'ITEM_CLO_PLO' as const,
      })),
      ...assessment,
      ...replacement,
    ].sort(
      (a, b) =>
        SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
        HEALTH_CATEGORIES.indexOf(a.category) -
          HEALTH_CATEGORIES.indexOf(b.category) ||
        (a.semester ?? 0) - (b.semester ?? 0) ||
        (a.courseCode ?? '').localeCompare(b.courseCode ?? ''),
    );
    // The course behind an item, so the board can link a syllabus or replacement issue to the course screen.
    const courseOfItem = new Map(
      version.curriculumItems.map((item) => [item.id, item.courseId]),
    );
    const issues: HealthIssueDto[] = found.map((issue) => ({
      ...issue,
      courseId: issue.itemId ? (courseOfItem.get(issue.itemId) ?? null) : null,
    }));
    return {
      version: versionRef(version),
      checkedAt: new Date().toISOString(),
      // Every category has a real check now that assessment rules exist (F-12).
      complete: true,
      categories: HEALTH_CATEGORIES.map((category) => ({
        category,
        count: issues.filter((issue) => issue.category === category).length,
        checked: true,
      })),
      issues,
      errorCount: issues.filter((issue) => issue.severity === 'ERROR').length,
      warningCount: issues.filter((issue) => issue.severity === 'HIGH').length,
    };
  }

  // A CLO no assessment component covers, and a syllabus with no component at all, per curriculum row.
  private async assessmentIssues(
    version: Awaited<ReturnType<PublicationSourceReader['read']>>,
  ): Promise<FoundIssue[]> {
    const revisions = await revisionForItems(
      this.prisma,
      version.curriculumItems.map((item) => ({
        id: item.id,
        courseId: item.courseId,
        syllabusId: item.syllabusId,
      })),
    );
    const rules = new Map<
      string,
      Awaited<ReturnType<typeof loadAssessmentRules>>
    >();
    for (const revision of revisions.values())
      if (revision && !rules.has(revision.id))
        rules.set(
          revision.id,
          await loadAssessmentRules(this.prisma, revision.id),
        );
    return version.curriculumItems.flatMap((item): FoundIssue[] => {
      const revision = revisions.get(item.id);
      const input = revision ? rules.get(revision.id) : undefined;
      if (!input) return [];
      const where = {
        category: 'ASSESSMENT_CLO' as const,
        semester: item.plannedSemester,
        itemId: item.id,
        courseCode: item.course.courseCode,
        target: 'SYLLABUS' as const,
      };
      if (input.assessmentComponents.length === 0)
        return [
          {
            ...where,
            code: 'NO_ASSESSMENT_COMPONENT',
            severity: 'HIGH',
            message: `${item.course.courseCode}: đề cương chưa có thành phần đánh giá.`,
          },
        ];
      return uncoveredClos(input).map((clo) => ({
        ...where,
        code: 'CLO_NOT_ASSESSED',
        severity: 'HIGH' as const,
        message: `${item.course.courseCode} ${clo.cloCode}: chưa có thành phần đánh giá nào đo CLO này.`,
      }));
    });
  }

  // A row whose course is no longer offered, with the replacement the catalog names (if any).
  private async replacementIssues(
    version: Awaited<ReturnType<PublicationSourceReader['read']>>,
  ): Promise<FoundIssue[]> {
    const retired = version.curriculumItems.filter(
      (item) => item.course.status !== CourseStatus.ACTIVE,
    );
    if (!retired.length) return [];
    const relations = await this.prisma.courseRelation.findMany({
      where: {
        relationType: CourseRelationType.REPLACEMENT,
        sourceCourseId: { in: retired.map((item) => item.courseId) },
      },
      select: {
        sourceCourseId: true,
        targetCourse: { select: { courseCode: true } },
      },
    });
    return retired.map((item) => {
      const replacements = relations
        .filter((relation) => relation.sourceCourseId === item.courseId)
        .map((relation) => relation.targetCourse.courseCode)
        .sort();
      return {
        category: 'REPLACEMENT',
        code: replacements.length ? 'COURSE_REPLACED' : 'COURSE_RETIRED',
        severity: 'HIGH',
        message: replacements.length
          ? `${item.course.courseCode} đã ngừng mở; học phần thay thế: ${replacements.join(', ')}.`
          : `${item.course.courseCode} đã ngừng mở và chưa có học phần thay thế.`,
        semester: item.plannedSemester,
        itemId: item.id,
        courseCode: item.course.courseCode,
        target: 'COURSE',
      };
    });
  }
}
