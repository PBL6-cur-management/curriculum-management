import { Injectable } from '@nestjs/common';
import {
  CourseRelationType,
  ProgramVersionStatus,
  type Prisma,
} from '../../generated/prisma/client.js';
import type { AccessContext } from '../../shared/authz/access-context.js';
import { PERMISSIONS } from '../../shared/authz/permission-codes.js';
import { toWireDecimal } from '../../shared/decimal/decimal.js';
import { AppException } from '../../shared/exception/app.exception.js';
import { PrismaService } from '../../shared/prisma/prisma.service.js';
import { programTarget } from '../../shared/programs/program-target.js';
import { PUBLICATION_RELATIONS } from './publication.constants.js';
import type {
  CourseGraphDto,
  GraphNodeDto,
  PublicationVersionDto,
} from './publication.dto.js';
import { PUBLICATION_ERRORS } from './publication.errors.js';

type Db = PrismaService | Prisma.TransactionClient;

const VERSION_INCLUDE = {
  program: { select: { id: true, programCode: true, facultyId: true } },
  effectiveSemester: { select: { semesterCode: true } },
  electiveGroups: { orderBy: { groupCode: 'asc' } },
  plos: { orderBy: [{ sortOrder: 'asc' }, { ploCode: 'asc' }] },
  curriculumItems: {
    orderBy: [{ plannedSemester: 'asc' }, { sortOrder: 'asc' }],
    include: {
      course: {
        select: {
          id: true,
          courseCode: true,
          courseName: true,
          credits: true,
          status: true,
        },
      },
      electiveGroup: { select: { groupCode: true } },
      requisites: {
        include: {
          sourceCourse: {
            select: {
              id: true,
              courseCode: true,
              courseName: true,
              credits: true,
            },
          },
        },
      },
    },
  },
} as const satisfies Prisma.ProgramVersionInclude;

export type PublicationVersion = Prisma.ProgramVersionGetPayload<{
  include: typeof VERSION_INCLUDE;
}>;

const GRAPH_RELATIONS = new Set<CourseRelationType>(PUBLICATION_RELATIONS);

// A row's frozen name/credits once released, the live course while Draft.
export const itemName = (item: PublicationVersion['curriculumItems'][number]) =>
  item.courseNameSnapshot ?? item.course.courseName;
export const itemCredits = (
  item: PublicationVersion['curriculumItems'][number],
) => item.creditsSnapshot ?? item.course.credits;

// Reads a version addressed by its program. Wrong program, request working copies and unissued
// correction Drafts read as absent, and so does a program outside the caller's program.view scope
// (an R6 own-enrollment grant names no program, so it never reaches a staff-addressed version).
@Injectable()
export class PublicationSourceReader {
  constructor(private readonly prisma: PrismaService) {}

  async read(
    access: AccessContext,
    programId: string,
    versionId: string,
    db: Db = this.prisma,
  ): Promise<PublicationVersion> {
    const row = await db.programVersion.findFirst({
      where: {
        id: versionId,
        programId,
        sourceRequestId: null,
        NOT: {
          correctionOfId: { not: null },
          status: ProgramVersionStatus.DRAFT,
        },
      },
      include: VERSION_INCLUDE,
    });
    if (
      !row ||
      access.modeFor(PERMISSIONS.PROGRAM_VIEW, programTarget(row.program)) ===
        null
    )
      throw new AppException(PUBLICATION_ERRORS.VERSION_NOT_FOUND);
    return row;
  }

  async graph(
    access: AccessContext,
    programId: string,
    versionId: string,
  ): Promise<CourseGraphDto> {
    return toCourseGraph(await this.read(access, programId, versionId));
  }
}

export function versionRef(row: PublicationVersion): PublicationVersionDto {
  return {
    id: row.id,
    programId: row.program.id,
    programCode: row.program.programCode,
    programName: row.programName,
    versionNumber: row.versionNumber,
    status: row.status,
    semesterCount: row.semesterCount,
  };
}

// Version-owned requisite rows, not today's catalog edges. A requisite course outside the frame becomes
// an external node so the dependency stays visible (EC-13). Node order is stable: semester, then sortOrder.
export function toCourseGraph(row: PublicationVersion): CourseGraphDto {
  const nodeIdOfCourse = new Map<string, string>();
  const nodes: GraphNodeDto[] = [];
  for (const item of row.curriculumItems) {
    const id = `item:${item.id}`;
    if (!nodeIdOfCourse.has(item.courseId))
      nodeIdOfCourse.set(item.courseId, id);
    nodes.push({
      id,
      itemId: item.id,
      courseId: item.courseId,
      courseCode: item.course.courseCode,
      courseName: itemName(item),
      credits: toWireDecimal(itemCredits(item)),
      semester: item.plannedSemester,
      sortOrder: item.sortOrder,
      external: false,
    });
  }
  const externals: GraphNodeDto[] = [];
  const edges: CourseGraphDto['edges'] = [];
  for (const item of row.curriculumItems) {
    for (const requisite of item.requisites) {
      if (!GRAPH_RELATIONS.has(requisite.relationType)) continue;
      let source = nodeIdOfCourse.get(requisite.sourceCourseId);
      if (!source) {
        source = `course:${requisite.sourceCourseId}`;
        nodeIdOfCourse.set(requisite.sourceCourseId, source);
        externals.push({
          id: source,
          itemId: null,
          courseId: requisite.sourceCourse.id,
          courseCode: requisite.sourceCourse.courseCode,
          courseName: requisite.sourceCourse.courseName,
          credits: toWireDecimal(requisite.sourceCourse.credits),
          semester: null,
          sortOrder: null,
          external: true,
        });
      }
      edges.push({
        id: requisite.id,
        source,
        target: `item:${item.id}`,
        relationType:
          requisite.relationType as (typeof PUBLICATION_RELATIONS)[number],
        minScore: requisite.minScore ? toWireDecimal(requisite.minScore) : null,
      });
    }
  }
  externals.sort((a, b) => a.courseCode.localeCompare(b.courseCode));
  edges.sort((a, b) => a.id.localeCompare(b.id));
  return { version: versionRef(row), nodes: [...nodes, ...externals], edges };
}
