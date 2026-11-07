import { Injectable } from '@nestjs/common';
import {
  ChangeRequestStatus,
  ProgramVersionStatus,
} from '../../generated/prisma/client.js';
import type {
  AccessContext,
  ScopeTarget,
} from '../../shared/authz/access-context.js';
import { canEditCopy } from '../../shared/change-requests/request-draft.js';
import { EDIT_PATH, editPathFor } from '../../shared/authz/edit-path.js';
import { PERMISSIONS } from '../../shared/authz/permission-codes.js';
import { toCreditBreakdownDto } from '../../shared/curriculum/credit-breakdown.dto.js';
import {
  curriculumWarnings,
  toWarningItem,
} from '../../shared/curriculum/curriculum-warnings.js';
import { programCredits } from '../../shared/curriculum/program-credits.js';
import { rowCredits } from '../../shared/curriculum/row-course.js';
import { AppException } from '../../shared/exception/app.exception.js';
import { PrismaService } from '../../shared/prisma/prisma.service.js';
import { programContentTarget } from '../../shared/programs/program-content-target.js';
import {
  programEditState,
  programTarget,
} from '../../shared/programs/program-target.js';
import {
  canEditCorrection,
  correctionEditPath,
  isCorrectionDraft,
} from '../../shared/releases/correction-access.js';
import { itemTarget } from '../../shared/curriculum/item-target.js';
import {
  holdsGroupScope,
  VERSION_SELECT,
  type VersionRow,
} from './curriculum-access.js';
import {
  ITEM_INCLUDE,
  ITEM_ORDER,
  toCurriculumItemDto,
  toCurriculumVersionDto,
  toKnowledgeBlockDto,
  type CurriculumDto,
  type CurriculumItemDto,
} from './curriculum.dto.js';
import { blockTotals, semesterTotals } from './curriculum-totals.js';
import { CURRICULUM_ERRORS } from './curriculum.errors.js';
import { GROUP_INCLUDE, toElectiveGroupDto } from './elective-group.dto.js';

// A row with the version and course facts a write needs to decide on scope and edit path.
export interface WritableItem {
  id: string;
  versionId: string;
  courseId: string;
  plannedSemester: number;
  electiveGroupId: string | null;
  version: VersionRow;
  course: { courseCode: string; ownerGroupId: string | null };
}

// The read side of the curriculum screen, and the lookups every write in this feature starts with.
@Injectable()
export class CurriculumReadService {
  constructor(private readonly prisma: PrismaService) {}

  async read(versionId: string, access: AccessContext): Promise<CurriculumDto> {
    const version = await this.findVersion(versionId);
    access.assertCan(PERMISSIONS.PROGRAM_VIEW, programTarget(version.program));
    const [rows, groups, blocks, state] = await Promise.all([
      this.prisma.curriculumItem.findMany({
        where: { versionId },
        include: ITEM_INCLUDE,
        orderBy: ITEM_ORDER,
      }),
      this.prisma.electiveGroup.findMany({
        where: { versionId },
        include: GROUP_INCLUDE,
        orderBy: { groupCode: 'asc' },
      }),
      this.prisma.knowledgeBlock.findMany({ orderBy: { blockCode: 'asc' } }),
      programEditState(this.prisma, version.programId),
    ]);
    const blockNames = new Map(
      blocks.map((block) => [block.blockCode, block.blockName]),
    );
    const semesterOfCourse = new Map(
      rows.map((row) => [row.courseId, row.plannedSemester]),
    );
    const editable = version.status === ProgramVersionStatus.DRAFT;
    const copy = version.sourceRequest;
    const correction = isCorrectionDraft(version);
    const editPath = correction
      ? correctionEditPath(access)
      : copy
        ? EDIT_PATH.DIRECT
        : editPathFor(
            access,
            PERMISSIONS.CURRICULUM_EDIT,
            await programContentTarget(this.prisma, version.program),
            state,
          );
    // A request's working copy is editable by its creator while the request is a Draft; otherwise the old rule.
    const canEditRow = (target: ScopeTarget) =>
      editable &&
      (correction
        ? canEditCorrection(access)
        : copy
          ? canEditCopy(access, PERMISSIONS.CURRICULUM_EDIT, target, copy)
          : editPathFor(access, PERMISSIONS.CURRICULUM_EDIT, target, state) ===
            EDIT_PATH.DIRECT);
    const canEditStructure = canEditRow(programTarget(version.program));
    // In memory over the caller's assignments, so a row each costs nothing.
    const items = rows.map((row, index) =>
      toCurriculumItemDto(row, {
        displayOrder: index + 1,
        semesterOfCourse,
        blockNames,
        canEdit: canEditRow(itemTarget(version, row.course)),
      }),
    );
    const totalsInput = rows.map((row) => ({
      plannedSemester: row.plannedSemester,
      isElective: row.isElective,
      credits: rowCredits(row),
      blockSymbol: row.blockSymbol,
    }));
    const warningItems = rows.map(toWarningItem);
    const warningGroups = groups.map((group) => ({
      id: group.id,
      groupCode: group.groupCode,
      minCredits: group.minCredits,
      minCourses: group.minCourses,
    }));
    const computed = programCredits(warningItems, warningGroups);
    return {
      version: toCurriculumVersionDto(version),
      editPath,
      canEditStructure,
      canAddItems: correction
        ? editable && canEditCorrection(access)
        : copy
          ? editable &&
            copy.createdById === access.userId &&
            copy.status === ChangeRequestStatus.DRAFT &&
            (canEditStructure || holdsGroupScope(access))
          : editable &&
            !state.released &&
            (editPath === EDIT_PATH.DIRECT || holdsGroupScope(access)),
      items,
      semesters: semesterTotals(version.semesterCount, totalsInput),
      blocks: blockTotals(totalsInput, blockNames),
      knowledgeBlocks: blocks.map(toKnowledgeBlockDto),
      electiveGroups: groups.map(toElectiveGroupDto),
      programCredits: {
        computed: toCreditBreakdownDto(computed),
        declared: toCreditBreakdownDto({
          compulsory: version.compulsoryCredits,
          elective: version.electiveCredits,
          total: version.totalCredits,
        }),
        mismatch:
          !computed.compulsory.equals(version.compulsoryCredits) ||
          !computed.elective.equals(version.electiveCredits),
      },
      warnings: curriculumWarnings({
        semesterCount: version.semesterCount,
        items: warningItems,
        groups: warningGroups,
      }),
    };
  }

  // One row as the screen shows it, re-read after a write so totals-dependent fields are current.
  async itemDto(
    itemId: string,
    access: AccessContext,
  ): Promise<CurriculumItemDto> {
    const row = await this.prisma.curriculumItem.findUniqueOrThrow({
      where: { id: itemId },
      include: { ...ITEM_INCLUDE, version: { select: VERSION_SELECT } },
    });
    const [siblings, block, state] = await Promise.all([
      this.prisma.curriculumItem.findMany({
        where: { versionId: row.versionId },
        select: { id: true, courseId: true, plannedSemester: true },
        orderBy: ITEM_ORDER,
      }),
      row.blockSymbol
        ? this.prisma.knowledgeBlock.findUnique({
            where: { blockCode: row.blockSymbol },
          })
        : null,
      programEditState(this.prisma, row.version.programId),
    ]);
    return toCurriculumItemDto(row, {
      displayOrder: siblings.findIndex((sibling) => sibling.id === row.id) + 1,
      semesterOfCourse: new Map(
        siblings.map((sibling) => [sibling.courseId, sibling.plannedSemester]),
      ),
      blockNames: new Map(block ? [[block.blockCode, block.blockName]] : []),
      canEdit:
        row.version.status === ProgramVersionStatus.DRAFT &&
        (isCorrectionDraft(row.version)
          ? canEditCorrection(access)
          : row.version.sourceRequest
            ? canEditCopy(
                access,
                PERMISSIONS.CURRICULUM_EDIT,
                itemTarget(row.version, row.course),
                row.version.sourceRequest,
              )
            : editPathFor(
                access,
                PERMISSIONS.CURRICULUM_EDIT,
                itemTarget(row.version, row.course),
                state,
              ) === EDIT_PATH.DIRECT),
    });
  }

  async findVersion(versionId: string): Promise<VersionRow> {
    const version = await this.prisma.programVersion.findUnique({
      where: { id: versionId },
      select: VERSION_SELECT,
    });
    if (!version) {
      throw new AppException(CURRICULUM_ERRORS.VERSION_NOT_FOUND);
    }
    return version;
  }

  async findItem(itemId: string): Promise<WritableItem> {
    const item = await this.prisma.curriculumItem.findUnique({
      where: { id: itemId },
      select: {
        id: true,
        versionId: true,
        courseId: true,
        plannedSemester: true,
        electiveGroupId: true,
        version: { select: VERSION_SELECT },
        course: { select: { courseCode: true, ownerGroupId: true } },
      },
    });
    if (!item) {
      throw new AppException(CURRICULUM_ERRORS.ITEM_NOT_FOUND);
    }
    return item;
  }
}
