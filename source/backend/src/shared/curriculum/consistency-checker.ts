import { Injectable } from '@nestjs/common';
import {
  Prisma,
  type CourseRelationType,
} from '../../generated/prisma/client.js';
import {
  CYCLE_CHECKED_TYPES,
  type RequisiteEdge,
} from '../courses/requisite-graph.js';
import { REQUEST_DRAFT_SELECT } from '../change-requests/request-draft.js';
import { toWireDecimal } from '../decimal/decimal.js';
import { revisionForItems } from '../syllabi/revision-for-items.js';
import { AppException } from '../exception/app.exception.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CONSISTENCY_ERRORS } from './consistency-errors.js';
import { curriculumCycleHits } from './curriculum-cycles.js';
import {
  CURRICULUM_WARNING,
  WARNING_SEVERITY,
  curriculumWarnings,
  sortWarnings,
  toWarningItem,
  type CurriculumWarning,
  type WarningItem,
} from './curriculum-warnings.js';
import {
  groupRequiredCredits,
  programCredits,
  type ProgramCredits,
} from './program-credits.js';

type Db = PrismaService | Prisma.TransactionClient;

const CHECK_VERSION_SELECT = {
  id: true,
  programId: true,
  versionNumber: true,
  correctionOfId: true,
  status: true,
  programName: true,
  semesterCount: true,
  totalCredits: true,
  compulsoryCredits: true,
  electiveCredits: true,
  program: { select: { id: true, facultyId: true, programCode: true } },
  creditMismatchReason: true,
  creditMismatchCompulsoryGap: true,
  creditMismatchElectiveGap: true,
  creditMismatchAcceptedAt: true,
  creditMismatchAcceptedBy: { select: { id: true, fullName: true } },
  ...REQUEST_DRAFT_SELECT,
} as const satisfies Prisma.ProgramVersionSelect;
export type CheckedVersion = Prisma.ProgramVersionGetPayload<{
  select: typeof CHECK_VERSION_SELECT;
}>;

const CHECK_ITEM_SELECT = {
  id: true,
  courseId: true,
  trackId: true,
  plannedSemester: true,
  isElective: true,
  electiveGroupId: true,
  syllabusId: true,
  creditsSnapshot: true,
  course: { select: { courseCode: true, credits: true } },
  requisites: {
    select: {
      sourceCourseId: true,
      relationType: true,
      sourceCourse: { select: { courseCode: true } },
    },
  },
} as const satisfies Prisma.CurriculumItemSelect;

export interface CreditAcceptance {
  reason: string;
  compulsoryGap: Prisma.Decimal;
  electiveGap: Prisma.Decimal;
  acceptedBy: { id: string; fullName: string };
  acceptedAt: Date;
}

export interface GroupRequirement {
  id: string;
  groupCode: string;
  groupName: string;
  minCredits: Prisma.Decimal | null;
  minCourses: number | null;
  requiredCredits: Prisma.Decimal;
  listedCredits: Prisma.Decimal;
  itemCount: number;
}

export interface CreditCheck {
  declared: ProgramCredits;
  computed: ProgramCredits;
  gap: ProgramCredits;
  mismatch: boolean;
  acceptance: CreditAcceptance | null;
  acceptanceCurrent: boolean;
}

export interface ConsistencyResult {
  version: CheckedVersion;
  credits: CreditCheck;
  groups: GroupRequirement[];
  issues: CurriculumWarning[];
}

const abs = (value: Prisma.Decimal) => toWireDecimal(value.abs());

function breakdown(credits: ProgramCredits): string {
  return `${toWireDecimal(credits.total)} (bắt buộc ${toWireDecimal(credits.compulsory)}, tự chọn ${toWireDecimal(credits.elective)})`;
}

function creditIssues(credits: CreditCheck): CurriculumWarning[] {
  if (!credits.mismatch) return [];
  const where = { semester: null, itemId: null, groupId: null };
  const { acceptance } = credits;
  if (credits.acceptanceCurrent && acceptance) {
    return [
      {
        ...where,
        code: CURRICULUM_WARNING.CREDIT_MISMATCH_ACCEPTED,
        severity: WARNING_SEVERITY.INFO,
        message: `Đã chấp nhận chênh lệch ${abs(credits.gap.total)} tín chỉ (${acceptance.acceptedBy.fullName}, ${acceptance.acceptedAt.toISOString().slice(0, 10)}): ${acceptance.reason}`,
      },
    ];
  }
  return [
    {
      ...where,
      code: CURRICULUM_WARNING.CREDIT_MISMATCH,
      severity: WARNING_SEVERITY.HIGH,
      message: `Tín chỉ khai báo: ${breakdown(credits.declared)}; tính từ khung: ${breakdown(credits.computed)}; chênh lệch ${abs(credits.gap.total)}.`,
    },
  ];
}

function toGroupRequirement(
  group: {
    id: string;
    groupCode: string;
    groupName: string;
    minCredits: Prisma.Decimal | null;
    minCourses: number | null;
  },
  items: readonly WarningItem[],
): GroupRequirement {
  const members = items.filter((item) => item.electiveGroupId === group.id);
  const credits = members.map((member) => member.credits);
  return {
    ...group,
    requiredCredits: groupRequiredCredits(group, credits),
    listedCredits: credits.reduce(
      (total, value) => total.plus(value),
      new Prisma.Decimal(0),
    ),
    itemCount: members.length,
  };
}

// The consistency check of one curriculum version. F-13 (submit) and F-15 (release) call assertPasses.
@Injectable()
export class ConsistencyChecker {
  constructor(private readonly prisma: PrismaService) {}

  async check(
    versionId: string,
    db: Db = this.prisma,
  ): Promise<ConsistencyResult> {
    const version = await db.programVersion.findUnique({
      where: { id: versionId },
      select: CHECK_VERSION_SELECT,
    });
    if (!version) {
      throw new AppException(CONSISTENCY_ERRORS.VERSION_NOT_FOUND);
    }
    const [rows, groupRows, tracks, catalogRelations] = await Promise.all([
      db.curriculumItem.findMany({
        where: { versionId },
        select: CHECK_ITEM_SELECT,
      }),
      db.electiveGroup.findMany({
        where: { versionId },
        orderBy: { groupCode: 'asc' },
      }),
      db.programTrack
        ? db.programTrack.findMany({
            where: { versionId },
            orderBy: [{ sortOrder: 'asc' }, { trackCode: 'asc' }],
            select: { id: true, trackCode: true, trackName: true },
          })
        : Promise.resolve([]),
      db.courseRelation.findMany({
        where: { relationType: { in: [...CYCLE_CHECKED_TYPES] } },
        select: { sourceCourseId: true, targetCourseId: true },
      }),
    ]);
    const items = rows.map(toWarningItem);
    const groups = groupRows.map((group) => ({
      id: group.id,
      groupCode: group.groupCode,
      minCredits: group.minCredits,
      minCourses: group.minCourses,
    }));
    // Track-aware credit calculation: when tracks exist, evaluate common-core + each track separately
    // rather than summing all tracks together into one inflated credit count.
    const primaryCreditRows =
      tracks.length > 0
        ? rows.filter((r) => r.trackId === null || r.trackId === tracks[0]!.id)
        : rows;
    const primaryCreditGroups =
      tracks.length > 0
        ? groupRows.filter(
            (g) => g.trackId === null || g.trackId === tracks[0]!.id,
          )
        : groupRows;
    const credits = this.creditCheck(
      version,
      programCredits(
        primaryCreditRows.map(toWarningItem),
        primaryCreditGroups.map((g) => ({
          id: g.id,
          groupCode: g.groupCode,
          minCredits: g.minCredits,
          minCourses: g.minCourses,
        })),
      ),
    );
    const extraTrackCreditIssues: CurriculumWarning[] = [];
    for (const track of tracks.slice(1)) {
      const trackItems = rows
        .filter((r) => r.trackId === null || r.trackId === track.id)
        .map(toWarningItem);
      const trackGroups = groupRows
        .filter((g) => g.trackId === null || g.trackId === track.id)
        .map((g) => ({
          id: g.id,
          groupCode: g.groupCode,
          minCredits: g.minCredits,
          minCourses: g.minCourses,
        }));
      const trackCheck = this.creditCheck(
        version,
        programCredits(trackItems, trackGroups),
      );
      if (trackCheck.mismatch && !trackCheck.acceptanceCurrent) {
        extraTrackCreditIssues.push({
          semester: null,
          itemId: null,
          groupId: null,
          code: CURRICULUM_WARNING.CREDIT_MISMATCH,
          severity: WARNING_SEVERITY.HIGH,
          message: `Định hướng ${track.trackCode} (${track.trackName}): tín chỉ khai báo ${breakdown(trackCheck.declared)}; tính từ khung ${breakdown(trackCheck.computed)}; chênh lệch ${abs(trackCheck.gap.total)}.`,
        });
      }
    }
    const cycles = await this.cycleIssues(db, catalogRelations, items);
    const missing = await missingSyllabusIssues(db, rows, items);
    return {
      version,
      credits,
      groups: groupRows.map((group) => toGroupRequirement(group, items)),
      issues: sortWarnings([
        ...curriculumWarnings({
          semesterCount: version.semesterCount,
          items,
          groups,
        }),
        ...cycles,
        ...missing,
        ...creditIssues(credits),
        ...extraTrackCreditIssues,
      ]),
    };
  }

  // Callers inside a submit or release transaction run lockRequisiteGraph(tx) first, so no catalog edge lands between check and write.
  async assertPasses(versionId: string, db: Db = this.prisma): Promise<void> {
    const { issues } = await this.check(versionId, db);
    const errors = issues.filter(
      (issue) => issue.severity === WARNING_SEVERITY.ERROR,
    );
    if (errors.length > 0) {
      throw new AppException(
        CONSISTENCY_ERRORS.CONSISTENCY_FAILED,
        errors.map((issue) => ({
          field: issue.code,
          constraints: [issue.message],
        })),
      );
    }
  }

  private creditCheck(
    version: CheckedVersion,
    computed: ProgramCredits,
  ): CreditCheck {
    const declared = {
      compulsory: version.compulsoryCredits,
      elective: version.electiveCredits,
      total: version.totalCredits,
    };
    const gap = {
      compulsory: computed.compulsory.minus(declared.compulsory),
      elective: computed.elective.minus(declared.elective),
      total: computed.total.minus(declared.total),
    };
    const mismatch = !gap.compulsory.isZero() || !gap.elective.isZero();
    const accepter = version.creditMismatchAcceptedBy;
    const acceptance =
      version.creditMismatchAcceptedAt &&
      accepter &&
      version.creditMismatchReason !== null &&
      version.creditMismatchCompulsoryGap !== null &&
      version.creditMismatchElectiveGap !== null
        ? {
            reason: version.creditMismatchReason,
            compulsoryGap: version.creditMismatchCompulsoryGap,
            electiveGap: version.creditMismatchElectiveGap,
            acceptedBy: accepter,
            acceptedAt: version.creditMismatchAcceptedAt,
          }
        : null;
    return {
      declared,
      computed,
      gap,
      mismatch,
      acceptance,
      acceptanceCurrent:
        mismatch &&
        acceptance !== null &&
        acceptance.compulsoryGap.equals(gap.compulsory) &&
        acceptance.electiveGap.equals(gap.elective),
    };
  }

  private async cycleIssues(
    db: Db,
    catalog: readonly RequisiteEdge[],
    items: readonly WarningItem[],
  ): Promise<CurriculumWarning[]> {
    const edgeItem = new Map<RequisiteEdge, WarningItem>();
    for (const item of items) {
      for (const requisite of item.requisites) {
        if (isCycleChecked(requisite.relationType)) {
          edgeItem.set(
            {
              sourceCourseId: requisite.sourceCourseId,
              targetCourseId: item.courseId,
            },
            item,
          );
        }
      }
    }
    const hits = curriculumCycleHits(catalog, [...edgeItem.keys()]);
    if (hits.length === 0) return [];
    const codes = new Map<string, string>();
    for (const item of items) {
      codes.set(item.courseId, item.courseCode);
      for (const requisite of item.requisites) {
        codes.set(requisite.sourceCourseId, requisite.sourceCourseCode);
      }
    }
    const unknown = [...new Set(hits.flatMap((hit) => hit.path))].filter(
      (id) => !codes.has(id),
    );
    if (unknown.length > 0) {
      const courses = await db.course.findMany({
        where: { id: { in: unknown } },
        select: { id: true, courseCode: true },
      });
      for (const course of courses) codes.set(course.id, course.courseCode);
    }
    return hits.map((hit) => {
      const item = edgeItem.get(hit.edge)!;
      return {
        code: CURRICULUM_WARNING.REQUISITE_CYCLE,
        severity: WARNING_SEVERITY.ERROR,
        message: `Vòng điều kiện: ${hit.path.map((id) => codes.get(id) ?? id).join(' → ')}.`,
        semester: item.plannedSemester,
        itemId: item.id,
        groupId: null,
      };
    });
  }
}

// A row is pinned (released) or reads the course's Published-else-Draft revision; none of either is an Error.
async function missingSyllabusIssues(
  db: Db,
  rows: readonly { id: string; courseId: string; syllabusId: string | null }[],
  items: readonly WarningItem[],
): Promise<CurriculumWarning[]> {
  const revisions = await revisionForItems(db, rows);
  return items
    .filter((item) => !revisions.get(item.id))
    .map((item) => ({
      code: CURRICULUM_WARNING.MISSING_SYLLABUS,
      severity: WARNING_SEVERITY.ERROR,
      message: `Học phần ${item.courseCode} chưa có đề cương.`,
      semester: item.plannedSemester,
      itemId: item.id,
      groupId: null,
    }));
}

function isCycleChecked(type: CourseRelationType): boolean {
  return CYCLE_CHECKED_TYPES.includes(type);
}
