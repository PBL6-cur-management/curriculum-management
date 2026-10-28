import type { Prisma } from '../../generated/prisma/client.js';
import {
  WORKSPACE_KIND,
  workspaceKindFor,
} from '../../shared/change-requests/request-kinds.js';
import { collectSyllabusIssues } from '../../shared/releases/syllabus-release-issues.js';
import {
  assessmentIssues,
  loadAssessmentRules,
} from '../../shared/syllabi/grade-formula.rules.js';
import { lockSyllabusAssessment } from '../../shared/syllabi/syllabus-assessment-lock.js';
import type { PrismaService } from '../../shared/prisma/prisma.service.js';
import type { RequestCore } from './request-visibility.js';
import type { BlockingIssueDto } from './submit-preview.dto.js';

type Db = PrismaService | Prisma.TransactionClient;

const ASSESSMENT_CODE_PREFIX = 'ASSESSMENT_';

// Submitting must not be a way around the grade formula: a syllabus workspace is judged on its own copy, a program
// workspace on the revisions its unpinned and legacy rows would publish with. Other request types are not asked.
// `lock` is for the submit transaction, where the copy must stay still between this check and the stored items.
export async function assessmentBlockers(
  db: Db,
  request: RequestCore,
  lock: boolean,
): Promise<BlockingIssueDto[]> {
  const kind = workspaceKindFor(request.requestType, request.targetType);
  if (kind === WORKSPACE_KIND.SYLLABUS) {
    const copy = await db.syllabus.findUnique({
      where: { sourceRequestId: request.id },
      select: { id: true },
    });
    if (!copy) return [];
    if (lock)
      await lockSyllabusAssessment(db as Prisma.TransactionClient, copy.id);
    return assessmentIssues(await loadAssessmentRules(db, copy.id)).map(
      (found) => ({ code: found.code, message: found.message }),
    );
  }
  if (kind === WORKSPACE_KIND.PROGRAM_VERSION) {
    const copy = await db.programVersion.findUnique({
      where: { sourceRequestId: request.id },
      select: { id: true },
    });
    if (!copy) return [];
    const courses = await collectSyllabusIssues(db, copy.id);
    return courses.flatMap((course) =>
      course.details
        .filter((code) => code.startsWith(ASSESSMENT_CODE_PREFIX))
        .map((code) => ({
          code,
          message: `Học phần ${course.courseCode} chưa đạt điều kiện công thức điểm (${code}).`,
        })),
    );
  }
  return [];
}
