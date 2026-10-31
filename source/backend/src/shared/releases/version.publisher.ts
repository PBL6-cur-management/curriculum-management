import { Injectable } from '@nestjs/common';
import {
  ProgramVersionStatus,
  type Prisma,
  type ProgramVersion,
} from '../../generated/prisma/client.js';
import { AppException } from '../exception/app.exception.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { mapUniqueViolation } from '../prisma/unique-violation.js';
import { toIsoDay } from '../time/today.js';
import { lockCourses } from './release-locks.js';
import { RELEASE_ERRORS } from './release.errors.js';
import { SyllabusPublisher } from './syllabus.publisher.js';

export type ReleasedStatus = 'ACTIVE' | 'PENDING';

export interface PromoteVersionInput {
  versionId: string;
  programId: string;
  versionNumber: string;
  // Null only when a correction copies a seeded legacy version, which never had a decision.
  decisionNumber: string | null;
  signedDate: Date | null;
  effectiveSemesterId: string;
  effectiveStart: Date;
  publisherId: string;
  now: Date;
  today: Date;
  previousVersionId?: string;
  originRequestId?: string;
  correctionOfId?: string;
  correctionReason?: string;
  cohortIds: readonly string[];
  // A correction keeps the status of the version it corrects; every other release is Active once its semester has begun.
  statusOverride?: ReleasedStatus;
}

// The only writer of Draft -> Pending / Active for a program version (PB-03, PB-05). Inside the caller's transaction:
// freeze each row (name, credits, syllabus revision), retire the Active version, number and stamp the release, assign cohorts.
@Injectable()
export class VersionPublisher {
  constructor(private readonly syllabi: SyllabusPublisher) {}

  async promote(
    tx: Prisma.TransactionClient,
    input: PromoteVersionInput,
  ): Promise<ProgramVersion> {
    const source = await tx.programVersion.findUniqueOrThrow({
      where: { id: input.versionId },
    });
    if (
      source.status !== ProgramVersionStatus.DRAFT ||
      source.programId !== input.programId
    ) {
      throw new AppException(RELEASE_ERRORS.ALREADY_RELEASED);
    }
    await this.freezeRows(tx, source.id, input.now);
    const status: ReleasedStatus =
      input.statusOverride ??
      (toIsoDay(input.effectiveStart) <= toIsoDay(input.today)
        ? 'ACTIVE'
        : 'PENDING');
    if (status === 'ACTIVE') {
      await tx.programVersion.updateMany({
        where: {
          programId: source.programId,
          status: ProgramVersionStatus.ACTIVE,
          id: { not: source.id },
        },
        data: { status: ProgramVersionStatus.HISTORICAL },
      });
    }
    try {
      const released = await tx.programVersion.update({
        where: { id: source.id },
        data: {
          sourceRequestId: null,
          baseVersionId: null,
          originRequestId: input.originRequestId ?? null,
          previousVersionId: input.previousVersionId ?? null,
          correctionOfId: input.correctionOfId,
          correctionReason: input.correctionReason,
          versionNumber: input.versionNumber,
          decisionNumber: input.decisionNumber,
          signedDate: input.signedDate,
          effectiveSemesterId: input.effectiveSemesterId,
          publishedById: input.publisherId,
          publishedAt: input.now,
          status,
        },
      });
      if (input.cohortIds.length > 0) {
        await tx.cohortVersion.createMany({
          data: input.cohortIds.map((cohortId) => ({
            cohortId,
            programVersionId: released.id,
            fromSemesterId: input.effectiveSemesterId,
          })),
        });
      }
      return released;
    } catch (error) {
      throw mapUniqueViolation(
        error,
        RELEASE_ERRORS.VERSION_NUMBER_TAKEN,
        'versionNumber',
      );
    }
  }

  // A row keeps what it already froze (a copy of a released version carries it); a new row freezes the live course now
  // and pins the course's Published revision, publishing its Draft when it has never been published (DC-03).
  private async freezeRows(
    tx: Prisma.TransactionClient,
    versionId: string,
    now: Date,
  ): Promise<void> {
    const items = await tx.curriculumItem.findMany({
      where: { versionId },
      select: {
        id: true,
        courseId: true,
        syllabusId: true,
        courseNameSnapshot: true,
        creditsSnapshot: true,
        course: { select: { courseName: true, credits: true } },
      },
      orderBy: { id: 'asc' },
    });
    await lockCourses(
      tx,
      items.map((item) => item.courseId),
    );
    const pinned = new Map<string, string>();
    for (const item of items) {
      let syllabusId = item.syllabusId ?? pinned.get(item.courseId);
      if (!syllabusId) {
        syllabusId = await this.syllabi.publishDraftForFirstPin(
          tx,
          item.courseId,
          now,
        );
        pinned.set(item.courseId, syllabusId);
      }
      await tx.curriculumItem.update({
        where: { id: item.id },
        data: {
          syllabusId,
          courseNameSnapshot: item.courseNameSnapshot ?? item.course.courseName,
          creditsSnapshot: item.creditsSnapshot ?? item.course.credits,
        },
      });
    }
  }
}

// After a fan-out copy, the row of the changed course reads the new revision: its CLO links follow by cloCode.
// A code the new revision no longer has drops its link; the count is what the final-approval preview warned about.
export async function repointCourseLinks(
  tx: Prisma.TransactionClient,
  versionId: string,
  courseId: string,
  newRevisionId: string,
): Promise<number> {
  const items = await tx.curriculumItem.findMany({
    where: { versionId, courseId },
    select: { id: true },
  });
  const links = await tx.cLOPLOMapping.findMany({
    where: { curriculumItemId: { in: items.map((item) => item.id) } },
    include: { clo: { select: { cloCode: true } } },
  });
  const clos = await tx.cLO.findMany({
    where: { syllabusId: newRevisionId },
    select: { id: true, cloCode: true },
  });
  const idByCode = new Map(clos.map((clo) => [clo.cloCode, clo.id]));
  let dropped = 0;
  for (const link of links) {
    const next = idByCode.get(link.clo.cloCode);
    if (!next) {
      await tx.cLOPLOMapping.delete({ where: { id: link.id } });
      dropped += 1;
    } else if (next !== link.cloId) {
      await tx.cLOPLOMapping.update({
        where: { id: link.id },
        data: { cloId: next },
      });
    }
  }
  return dropped;
}

// What repointCourseLinks would drop, without writing: the links of this course's rows in the newest versions
// whose cloCode the new revision lacks.
export async function countDroppedLinks(
  db: Prisma.TransactionClient | PrismaService,
  versionId: string,
  courseId: string,
  newRevisionId: string,
): Promise<number> {
  const links = await db.cLOPLOMapping.findMany({
    where: { coursePlo: { curriculumItem: { versionId, courseId } } },
    select: { clo: { select: { cloCode: true } } },
  });
  if (links.length === 0) return 0;
  const clos = await db.cLO.findMany({
    where: { syllabusId: newRevisionId },
    select: { cloCode: true },
  });
  const codes = new Set(clos.map((clo) => clo.cloCode));
  return links.filter((link) => !codes.has(link.clo.cloCode)).length;
}
