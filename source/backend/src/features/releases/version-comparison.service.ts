import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import type { AccessContext } from '../../shared/authz/access-context.js';
import { PERMISSIONS } from '../../shared/authz/permission-codes.js';
import { DIFF_SECTION_TITLES } from '../../shared/change-requests/diff/diff-labels.js';
import { toDiffSections } from '../../shared/change-requests/diff/diff-presenter.js';
import { diffSnapshots } from '../../shared/change-requests/diff/snapshot-differ.js';
import { readSyllabusSnapshot } from '../../shared/change-requests/diff/syllabus-snapshot.reader.js';
import { courseTarget } from '../../shared/courses/course-target.js';
import { AppException } from '../../shared/exception/app.exception.js';
import { PrismaService } from '../../shared/prisma/prisma.service.js';
import { programTarget } from '../../shared/programs/program-target.js';
import { APPLIED_VERSION_ERRORS } from '../../shared/releases/applied-version.errors.js';
import { RELEASE_ERRORS } from '../../shared/releases/release.errors.js';
import type {
  PinnedSyllabusComparisonDto,
  VersionComparisonDto,
  VersionComparisonQueryDto,
} from './dto/version-comparison.dto.js';
import { readReleasedVersionSnapshot } from './released-version-snapshot.reader.js';
import { presentVersionComparison } from './version-comparison.presenter.js';

export interface VersionComparisonOperations {
  compare(
    programId: string,
    query: VersionComparisonQueryDto,
    access: AccessContext,
  ): Promise<VersionComparisonDto>;
  syllabi(
    programId: string,
    courseId: string,
    query: VersionComparisonQueryDto,
    access: AccessContext,
  ): Promise<PinnedSyllabusComparisonDto>;
}

@Injectable()
export class VersionComparisonService implements VersionComparisonOperations {
  constructor(private readonly prisma: PrismaService) {}

  compare(
    programId: string,
    query: VersionComparisonQueryDto,
    access: AccessContext,
  ): Promise<VersionComparisonDto> {
    return this.prisma.$transaction(
      async (tx) => {
        await this.scopedProgram(tx, programId, access);
        const before = await readReleasedVersionSnapshot(
          tx,
          programId,
          query.beforeVersionId,
        );
        const after = await readReleasedVersionSnapshot(
          tx,
          programId,
          query.afterVersionId,
        );
        return presentVersionComparison(programId, before, after);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  syllabi(
    programId: string,
    courseId: string,
    query: VersionComparisonQueryDto,
    access: AccessContext,
  ): Promise<PinnedSyllabusComparisonDto> {
    return this.prisma.$transaction(
      async (tx) => {
        await this.scopedProgram(tx, programId, access);
        const before = await readReleasedVersionSnapshot(
          tx,
          programId,
          query.beforeVersionId,
        );
        const after = await readReleasedVersionSnapshot(
          tx,
          programId,
          query.afterVersionId,
        );
        const oldPin = [...before.pinsByCourseCode.entries()].find(
          ([, pin]) => pin.courseId === courseId,
        );
        const newPin = [...after.pinsByCourseCode.entries()].find(
          ([, pin]) => pin.courseId === courseId,
        );
        if (!oldPin || !newPin)
          throw new AppException(
            APPLIED_VERSION_ERRORS.PINNED_SYLLABUS_NOT_FOUND,
          );
        const course = await tx.course.findUnique({
          where: { id: courseId },
          select: { ownerFacultyId: true, ownerGroupId: true },
        });
        if (!course)
          throw new AppException(
            APPLIED_VERSION_ERRORS.PINNED_SYLLABUS_NOT_FOUND,
          );
        access.assertCan(PERMISSIONS.SYLLABUS_VIEW, courseTarget(course));
        const beforeSyllabus = await tx.syllabus.findUniqueOrThrow({
          where: { id: oldPin[1].syllabusId },
          select: { id: true, status: true },
        });
        const afterSyllabus = await tx.syllabus.findUniqueOrThrow({
          where: { id: newPin[1].syllabusId },
          select: { id: true, status: true },
        });
        const oldEntries = await readSyllabusSnapshot(tx, beforeSyllabus.id);
        const newEntries = await readSyllabusSnapshot(tx, afterSyllabus.id);
        const changes = toDiffSections(
          diffSnapshots(oldEntries, newEntries, before.version.id),
        );
        return {
          programId,
          courseId,
          courseCode: oldPin[0],
          beforeVersionId: before.version.id,
          afterVersionId: after.version.id,
          before: {
            id: beforeSyllabus.id,
            revisionNumber: oldPin[1].revisionNumber,
            status: beforeSyllabus.status,
          },
          after: {
            id: afterSyllabus.id,
            revisionNumber: newPin[1].revisionNumber,
            status: afterSyllabus.status,
          },
          sections: ['SYLLABUS_FIELD', 'WEEKLY_CONTENTS', 'CLO'].map(
            (entityType) =>
              changes.find((section) => section.entityType === entityType) ?? {
                entityType,
                title: DIFF_SECTION_TITLES[entityType],
                rows: [],
              },
          ),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  private async scopedProgram(
    tx: Prisma.TransactionClient,
    programId: string,
    access: AccessContext,
  ): Promise<void> {
    const program = await tx.program.findUnique({
      where: { id: programId },
      select: { id: true, facultyId: true },
    });
    if (!program) throw new AppException(RELEASE_ERRORS.PROGRAM_NOT_FOUND);
    access.assertCan(PERMISSIONS.PROGRAM_VIEW, programTarget(program));
    access.assertCan(PERMISSIONS.VERSION_COMPARE, programTarget(program));
  }
}
