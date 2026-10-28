import { Injectable } from '@nestjs/common';
import {
  SyllabusStatus,
  type Prisma,
  type Syllabus,
} from '../../generated/prisma/client.js';
import { AppException } from '../exception/app.exception.js';
import { RELEASE_ERRORS } from './release.errors.js';
import { lockSyllabusAssessment } from '../syllabi/syllabus-assessment-lock.js';
import {
  PUBLISHABLE_SYLLABUS_SELECT,
  syllabusPublishIssues,
} from './syllabus-release-issues.js';

export interface PublishedRevision {
  revision: Syllabus;
  previous: Syllabus;
}

// The only writer of Draft -> Published for a syllabus (DC-03). A published revision moves to Historical first:
// the partial unique index allows one Published revision per course.
@Injectable()
export class SyllabusPublisher {
  // A program's first release pins each row. The course's Published revision is reused; else its Draft is published now.
  async publishDraftForFirstPin(
    tx: Prisma.TransactionClient,
    courseId: string,
    now: Date,
  ): Promise<string> {
    const published = await tx.syllabus.findFirst({
      where: { courseId, status: SyllabusStatus.PUBLISHED },
      select: { id: true },
    });
    if (published) {
      await this.assertPublishable(tx, published.id);
      return published.id;
    }
    const draft = await tx.syllabus.findFirst({
      where: { courseId, status: SyllabusStatus.DRAFT, sourceRequestId: null },
    });
    if (!draft) {
      throw new AppException(RELEASE_ERRORS.MISSING_SYLLABUS, [
        {
          field: courseId,
          constraints: [RELEASE_ERRORS.MISSING_SYLLABUS.code],
        },
      ]);
    }
    await this.assertPublishable(tx, draft.id);
    await tx.syllabus.update({
      where: { id: draft.id },
      data: { status: SyllabusStatus.PUBLISHED, publishedAt: now },
    });
    return draft.id;
  }

  // A request's working copy becomes the next numbered revision; the revision it was written against goes Historical.
  async publishFromRequest(
    tx: Prisma.TransactionClient,
    copyId: string,
    requestId: string,
    now: Date,
  ): Promise<PublishedRevision> {
    const copy = await tx.syllabus.findUniqueOrThrow({ where: { id: copyId } });
    if (copy.sourceRequestId !== requestId || !copy.baseRevisionId) {
      throw new AppException(RELEASE_ERRORS.ITEM_APPLY_FAILED);
    }
    const previous = await tx.syllabus.findUniqueOrThrow({
      where: { id: copy.baseRevisionId },
    });
    if (previous.status !== SyllabusStatus.PUBLISHED) {
      throw new AppException(RELEASE_ERRORS.ITEM_APPLY_FAILED);
    }
    await this.assertPublishable(tx, copy.id);
    const highest = await tx.syllabus.aggregate({
      where: { courseId: copy.courseId },
      _max: { revisionNumber: true },
    });
    await tx.syllabus.update({
      where: { id: previous.id },
      data: { status: SyllabusStatus.HISTORICAL },
    });
    const revision = await tx.syllabus.update({
      where: { id: copy.id },
      data: {
        sourceRequestId: null,
        originRequestId: requestId,
        baseRevisionId: null,
        revisionNumber: (highest._max.revisionNumber ?? 0) + 1,
        previousVersionId: previous.id,
        status: SyllabusStatus.PUBLISHED,
        publishedAt: now,
      },
    });
    return { revision, previous };
  }

  // Locks the revision, then judges the text and the grade formula as they are now, not as an earlier read saw them.
  private async assertPublishable(
    tx: Prisma.TransactionClient,
    syllabusId: string,
  ): Promise<void> {
    await lockSyllabusAssessment(tx, syllabusId);
    const syllabus = await tx.syllabus.findUniqueOrThrow({
      where: { id: syllabusId },
      select: PUBLISHABLE_SYLLABUS_SELECT,
    });
    const issues = syllabusPublishIssues(syllabus);
    if (issues.length > 0) {
      throw new AppException(
        RELEASE_ERRORS.SYLLABUS_INCOMPLETE,
        issues.map((issue) => ({
          field: syllabus.courseId,
          constraints: [issue],
        })),
      );
    }
  }
}
