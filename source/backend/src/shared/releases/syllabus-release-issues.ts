import { SyllabusStatus, type Prisma } from '../../generated/prisma/client.js';
import { AppException } from '../exception/app.exception.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import {
  ASSESSMENT_RULES_SELECT,
  assessmentIssues,
  type AssessmentRuleInput,
} from '../syllabi/grade-formula.rules.js';
import { richTextToPlain } from '../rich-text/rich-text-to-plain.js';
import { RELEASE_ERRORS } from './release.errors.js';
import {
  SYLLABUS_ISSUE_CODE,
  type SyllabusReleaseIssueDto,
} from './release-issue.dto.js';

type Db = PrismaService | Prisma.TransactionClient;

export const SYLLABUS_PUBLISH_CONDITION = {
  DESCRIPTION: 'COURSE_DESCRIPTION_EMPTY',
  OBJECTIVES: 'OBJECTIVES_EMPTY',
} as const;

// Everything a revision needs to be published; the assessment data is never optional, so no caller can skip it.
export interface PublishableSyllabusInput extends AssessmentRuleInput {
  courseDescription: string | null;
  objectives: string | null;
}

export const PUBLISHABLE_SYLLABUS_SELECT = {
  id: true,
  courseId: true,
  status: true,
  courseDescription: true,
  objectives: true,
  ...ASSESSMENT_RULES_SELECT,
} as const satisfies Prisma.SyllabusSelect;

export function syllabusPublishIssues(
  syllabus: PublishableSyllabusInput,
): string[] {
  const issues: string[] = [];
  if (richTextToPlain(syllabus.courseDescription) === null) {
    issues.push(SYLLABUS_PUBLISH_CONDITION.DESCRIPTION);
  }
  if (richTextToPlain(syllabus.objectives) === null) {
    issues.push(SYLLABUS_PUBLISH_CONDITION.OBJECTIVES);
  }
  for (const issue of assessmentIssues(syllabus)) {
    if (!issues.includes(issue.code)) issues.push(issue.code);
  }
  return issues;
}

// Each course row of a version needs a complete revision to publish with: its explicit pin, else the course's ordinary
// Published revision, else its ordinary Draft. Pins that predate the grade formula are checked like any other; a legacy
// incomplete revision stays readable but cannot enter a new release. Read-only, so the preview and the release check one rule.
export async function collectSyllabusIssues(
  db: Db,
  versionId: string,
): Promise<SyllabusReleaseIssueDto[]> {
  const items = await db.curriculumItem.findMany({
    where: { versionId },
    select: {
      courseId: true,
      syllabusId: true,
      course: { select: { courseCode: true } },
    },
    orderBy: [{ plannedSemester: 'asc' }, { sortOrder: 'asc' }, { id: 'asc' }],
  });
  if (items.length === 0) return [];
  const pinIds = items.flatMap((item) =>
    item.syllabusId === null ? [] : [item.syllabusId],
  );
  const revisions = await db.syllabus.findMany({
    where: {
      OR: [
        { id: { in: pinIds } },
        {
          courseId: {
            in: items
              .filter((item) => item.syllabusId === null)
              .map((item) => item.courseId),
          },
          status: { in: [SyllabusStatus.PUBLISHED, SyllabusStatus.DRAFT] },
          sourceRequestId: null,
        },
      ],
    },
    select: PUBLISHABLE_SYLLABUS_SELECT,
  });
  const issues: SyllabusReleaseIssueDto[] = [];
  const reported = new Set<string>();
  for (const item of items) {
    if (reported.has(item.courseId)) continue;
    const where = {
      courseId: item.courseId,
      courseCode: item.course.courseCode,
    };
    const own = revisions.filter((row) => row.courseId === item.courseId);
    const candidate =
      item.syllabusId === null
        ? (own.find((row) => row.status === SyllabusStatus.PUBLISHED) ??
          own.find((row) => row.status === SyllabusStatus.DRAFT))
        : own.find((row) => row.id === item.syllabusId);
    if (!candidate) {
      reported.add(item.courseId);
      issues.push({
        ...where,
        code: SYLLABUS_ISSUE_CODE.MISSING_SYLLABUS,
        details: [],
      });
      continue;
    }
    const details = syllabusPublishIssues(candidate);
    if (details.length > 0) {
      reported.add(item.courseId);
      issues.push({
        ...where,
        code: SYLLABUS_ISSUE_CODE.SYLLABUS_INCOMPLETE,
        details,
      });
    }
  }
  return issues;
}

// The same check as the preview, raised: every course that cannot be released is named with what it lacks.
export async function assertNoSyllabusIssues(
  db: Db,
  versionId: string,
): Promise<void> {
  const issues = await collectSyllabusIssues(db, versionId);
  if (issues.length > 0) {
    throw new AppException(
      RELEASE_ERRORS.SYLLABUS_INCOMPLETE,
      issues.map((issue) => ({
        field: issue.courseCode,
        constraints: [issue.code, ...issue.details],
      })),
    );
  }
}
