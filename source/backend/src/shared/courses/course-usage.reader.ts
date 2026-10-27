import { Injectable } from '@nestjs/common';
import {
  CourseRelationType,
  CourseStatus,
  ProgramStatus,
  ProgramVersionStatus,
  type Prisma,
} from '../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

export interface CourseUsage {
  programId: string;
  programCode: string;
  programName: string;
  versionLabel: string | null;
  plannedSemester: number;
}

// Answers questions about a course whose facts live in other features' tables.
// Each method returns "none" until the table it reads exists:
// F-05 filled hasActiveReplacement; F-07 filled programsUsing and inReleasedVersion from the curriculum rows;
// F-17 fills hasStudyResults.
@Injectable()
export class CourseUsageReader {
  constructor(private readonly prisma: PrismaService) {}

  // The course sits in a version that has left Draft (Pending, Active or Historical).
  async inReleasedVersion(courseId: string): Promise<boolean> {
    return (await this.releasedCourseIds([courseId])).has(courseId);
  }

  async releasedCourseIds(
    courseIds: readonly string[],
    client: Pick<Prisma.TransactionClient, 'curriculumItem'> = this.prisma,
  ): Promise<Set<string>> {
    if (courseIds.length === 0) return new Set();
    const rows = await client.curriculumItem.findMany({
      where: {
        courseId: { in: [...courseIds] },
        version: { status: { not: ProgramVersionStatus.DRAFT } },
      },
      select: { courseId: true },
      distinct: ['courseId'],
    });
    return new Set(rows.map((row) => row.courseId));
  }

  async hasStudyResults(_courseId: string): Promise<boolean> {
    return false;
  }

  // Versions still in play (Draft, Pending, Active) of programs in use; one entry per row, so one per program version.
  async programsUsing(courseId: string): Promise<CourseUsage[]> {
    const rows = await this.prisma.curriculumItem.findMany({
      where: {
        courseId,
        version: {
          status: { not: ProgramVersionStatus.HISTORICAL },
          // A request's working copy is not a version in use.
          sourceRequestId: null,
          program: { status: ProgramStatus.ACTIVE },
        },
      },
      select: {
        plannedSemester: true,
        version: {
          select: {
            programName: true,
            versionNumber: true,
            program: { select: { id: true, programCode: true } },
          },
        },
      },
      orderBy: [
        { version: { program: { programCode: 'asc' } } },
        { version: { createdAt: 'asc' } },
      ],
    });
    return rows.map(({ plannedSemester, version }) => ({
      programId: version.program.id,
      programCode: version.program.programCode,
      programName: version.programName,
      versionLabel: version.versionNumber,
      plannedSemester,
    }));
  }

  // A REPLACEMENT relation from this course to an ACTIVE course (HP-02).
  // `client` lets the caller read inside its own transaction and see rows it has just written.
  async hasActiveReplacement(
    courseId: string,
    client: Pick<Prisma.TransactionClient, 'courseRelation'> = this.prisma,
  ): Promise<boolean> {
    const found = await client.courseRelation.findFirst({
      where: {
        sourceCourseId: courseId,
        relationType: CourseRelationType.REPLACEMENT,
        targetCourse: { status: CourseStatus.ACTIVE },
      },
      select: { id: true },
    });
    return found !== null;
  }
}
