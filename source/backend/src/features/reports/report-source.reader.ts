import { Injectable } from '@nestjs/common';
import {
  Prisma,
  ProgramVersionStatus,
  type CourseType,
} from '../../generated/prisma/client.js';
import type { AccessContext } from '../../shared/authz/access-context.js';
import type { PermissionCode } from '../../shared/authz/permission-codes.js';
import { AppException } from '../../shared/exception/app.exception.js';
import { PrismaService } from '../../shared/prisma/prisma.service.js';
import { programTarget } from '../../shared/programs/program-target.js';
import { revisionForItems } from '../../shared/syllabi/revision-for-items.js';
import { REPORT_ERRORS } from './reports.errors.js';

export const ISSUED_STATUSES: ProgramVersionStatus[] = [
  ProgramVersionStatus.PENDING,
  ProgramVersionStatus.ACTIVE,
  ProgramVersionStatus.HISTORICAL,
];

export interface ReportItem {
  id: string;
  courseId: string;
  courseCode: string;
  courseName: string;
  courseType: CourseType;
  equivalenceGroupId: string | null;
  credits: Prisma.Decimal;
  plannedSemester: number;
  sortOrder: number;
  isElective: boolean;
  blockSymbol: string | null;
  electiveGroupCode: string | null;
  syllabusId: string | null;
  // The revision whose CLOs this row uses: its pin, or for a Draft row the course's Published-else-Draft.
  revision: { id: string; revisionNumber: number; status: string } | null;
}

export interface ReportVersion {
  id: string;
  programId: string;
  programCode: string;
  programName: string;
  versionNumber: string | null;
  status: ProgramVersionStatus;
  decisionNumber: string | null;
  publishedAt: Date | null;
  majorCode: string;
  majorName: string;
  semesterCount: number;
  totalCredits: Prisma.Decimal;
  compulsoryCredits: Prisma.Decimal;
  electiveCredits: Prisma.Decimal;
  items: ReportItem[];
  electiveGroups: {
    groupCode: string;
    groupName: string;
    minCredits: Prisma.Decimal | null;
    minCourses: number | null;
  }[];
  plos: {
    id: string;
    ploCode: string;
    description: string;
    competencyGroup: string | null;
  }[];
  cells: { curriculumItemId: string; ploId: string; weight: Prisma.Decimal }[];
  cloLinks: { curriculumItemId: string; cloId: string; ploId: string }[];
}

// Reads one version as the reports see it: frozen names/credits when released, the live course for a Draft.
// Request working copies and unissued corrections are never report candidates.
@Injectable()
export class ReportSourceReader {
  constructor(private readonly prisma: PrismaService) {}

  async read(
    access: AccessContext,
    versionId: string,
    permission: PermissionCode,
    options: { issuedOnly?: boolean } = {},
  ): Promise<ReportVersion> {
    const row = await this.prisma.programVersion.findFirst({
      where: {
        id: versionId,
        sourceRequestId: null,
        NOT: {
          correctionOfId: { not: null },
          status: ProgramVersionStatus.DRAFT,
        },
      },
      include: {
        program: { select: { id: true, programCode: true, facultyId: true } },
        electiveGroups: { orderBy: { groupCode: 'asc' } },
        plos: { orderBy: [{ sortOrder: 'asc' }, { ploCode: 'asc' }] },
        curriculumItems: {
          orderBy: [{ plannedSemester: 'asc' }, { sortOrder: 'asc' }],
          include: {
            course: {
              select: {
                courseCode: true,
                courseName: true,
                credits: true,
                courseType: true,
                equivalenceGroupId: true,
              },
            },
            electiveGroup: { select: { groupCode: true } },
            ploMappings: {
              select: {
                ploId: true,
                weight: true,
                cloLinks: { select: { cloId: true } },
              },
            },
          },
        },
      },
    });
    if (!row) throw new AppException(REPORT_ERRORS.VERSION_NOT_FOUND);
    // Outside the caller's scope reads the same as absent.
    if (access.modeFor(permission, programTarget(row.program)) === null)
      throw new AppException(REPORT_ERRORS.VERSION_NOT_FOUND);
    if (options.issuedOnly && !ISSUED_STATUSES.includes(row.status))
      throw new AppException(REPORT_ERRORS.NOT_ISSUED);
    const revisions = await revisionForItems(
      this.prisma,
      row.curriculumItems.map((item) => ({
        id: item.id,
        courseId: item.courseId,
        syllabusId: item.syllabusId,
      })),
    );
    return {
      id: row.id,
      programId: row.program.id,
      programCode: row.program.programCode,
      programName: row.programName,
      versionNumber: row.versionNumber,
      status: row.status,
      decisionNumber: row.decisionNumber,
      publishedAt: row.publishedAt,
      majorCode: row.majorCode,
      majorName: row.majorName,
      semesterCount: row.semesterCount,
      totalCredits: row.totalCredits,
      compulsoryCredits: row.compulsoryCredits,
      electiveCredits: row.electiveCredits,
      items: row.curriculumItems.map((item) => ({
        id: item.id,
        courseId: item.courseId,
        courseCode: item.course.courseCode,
        courseName: item.courseNameSnapshot ?? item.course.courseName,
        courseType: item.course.courseType,
        equivalenceGroupId: item.course.equivalenceGroupId,
        credits: item.creditsSnapshot ?? item.course.credits,
        plannedSemester: item.plannedSemester,
        sortOrder: item.sortOrder,
        isElective: item.isElective,
        blockSymbol: item.blockSymbol,
        electiveGroupCode: item.electiveGroup?.groupCode ?? null,
        syllabusId: item.syllabusId,
        revision: revisions.get(item.id) ?? null,
      })),
      electiveGroups: row.electiveGroups.map((group) => ({
        groupCode: group.groupCode,
        groupName: group.groupName,
        minCredits: group.minCredits,
        minCourses: group.minCourses,
      })),
      plos: row.plos.map((plo) => ({
        id: plo.id,
        ploCode: plo.ploCode,
        description: plo.description,
        competencyGroup: plo.competencyGroup,
      })),
      cells: row.curriculumItems.flatMap((item) =>
        item.ploMappings.map((cell) => ({
          curriculumItemId: item.id,
          ploId: cell.ploId,
          weight: cell.weight,
        })),
      ),
      cloLinks: row.curriculumItems.flatMap((item) =>
        item.ploMappings.flatMap((cell) =>
          cell.cloLinks.map((link) => ({
            curriculumItemId: item.id,
            cloId: link.cloId,
            ploId: cell.ploId,
          })),
        ),
      ),
    };
  }
}
