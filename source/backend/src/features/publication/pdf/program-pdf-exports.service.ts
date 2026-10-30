import { randomUUID } from 'node:crypto';
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';
import {
  Prisma,
  ProgramVersionStatus,
} from '../../../generated/prisma/client.js';
import type { AccessContext } from '../../../shared/authz/access-context.js';
import { PERMISSIONS } from '../../../shared/authz/permission-codes.js';
import { toWireDecimal } from '../../../shared/decimal/decimal.js';
import { AppException } from '../../../shared/exception/app.exception.js';
import { FileStorageService } from '../../../shared/files/file-storage.service.js';
import { PrismaService } from '../../../shared/prisma/prisma.service.js';
import { programTarget } from '../../../shared/programs/program-target.js';
import {
  PDF_FILE_DIR,
  PDF_JOB,
  PDF_QUEUE,
  PDF_TTL_MS,
  type PdfExportState,
} from '../publication.constants.js';
import type { ProgramPdfExportDto } from '../publication.dto.js';
import { PUBLICATION_ERRORS } from '../publication.errors.js';
import {
  itemCredits,
  itemName,
  PublicationSourceReader,
  type PublicationVersion,
} from '../publication-source.reader.js';
import type { ProgramPdfSnapshot } from './program-pdf.template.js';

export interface PdfJobData {
  exportId: string;
  ownerId: string;
  programId: string;
  versionId: string;
  fileName: string;
  draft: boolean;
  requestedAt: string;
  snapshot: ProgramPdfSnapshot;
}

const STATUS_LABELS: Record<ProgramVersionStatus, string> = {
  DRAFT: 'Nháp',
  PENDING: 'Chờ hiệu lực',
  ACTIVE: 'Đang hiệu lực',
  HISTORICAL: 'Lịch sử',
};
const DEGREE_LABELS: Record<string, string> = {
  ENGINEER: 'Kỹ sư',
  BACHELOR: 'Cử nhân',
};
const SAFE_NAME = /[^A-Za-z0-9._-]+/g;

export const pdfPath = (exportId: string) => `${PDF_FILE_DIR}/${exportId}.pdf`;

export function snapshotOf(
  version: PublicationVersion,
  degreeLevel: string,
  capturedAt: Date,
): ProgramPdfSnapshot {
  const bySemester = new Map<number, PublicationVersion['curriculumItems']>();
  for (const item of version.curriculumItems)
    bySemester.set(item.plannedSemester, [
      ...(bySemester.get(item.plannedSemester) ?? []),
      item,
    ]);
  return {
    draft: version.status === ProgramVersionStatus.DRAFT,
    programCode: version.program.programCode,
    programName: version.programName,
    majorCode: version.majorCode,
    majorName: version.majorName,
    degreeLevel: DEGREE_LABELS[degreeLevel] ?? degreeLevel,
    versionNumber: version.versionNumber,
    statusLabel: STATUS_LABELS[version.status],
    decisionNumber: version.decisionNumber,
    signedDate: version.signedDate?.toISOString().slice(0, 10) ?? null,
    effectiveSemester: version.effectiveSemester?.semesterCode ?? null,
    semesterCount: version.semesterCount,
    totalCredits: toWireDecimal(version.totalCredits),
    compulsoryCredits: toWireDecimal(version.compulsoryCredits),
    electiveCredits: toWireDecimal(version.electiveCredits),
    semesters: [...bySemester.entries()]
      .sort(([a], [b]) => a - b)
      .map(([semester, items]) => ({
        semester,
        credits: toWireDecimal(
          items.reduce(
            (total, item) => total.plus(itemCredits(item)),
            new Prisma.Decimal(0),
          ),
        ),
        items: items.map((item) => ({
          courseCode: item.course.courseCode,
          courseName: itemName(item),
          credits: toWireDecimal(itemCredits(item)),
          elective: item.isElective,
          groupCode: item.electiveGroup?.groupCode ?? null,
        })),
      })),
    electiveGroups: version.electiveGroups.map((group) => ({
      groupCode: group.groupCode,
      groupName: group.groupName,
      minCredits: group.minCredits ? toWireDecimal(group.minCredits) : null,
      minCourses: group.minCourses,
    })),
    plos: version.plos.map((plo) => ({
      ploCode: plo.ploCode,
      description: plo.description,
    })),
    capturedAt:
      capturedAt.toISOString().replace('T', ' ').slice(0, 16) + ' UTC',
  };
}

// US-111: the snapshot is taken (and the Draft mark decided) when the export is accepted, then rendered by
// the worker. Exports are temporary: the job and its file live PDF_TTL_MS after finishing, owner-only.
@Injectable()
export class ProgramPdfExportsService {
  private readonly logger = new Logger(ProgramPdfExportsService.name);

  constructor(
    @InjectQueue(PDF_QUEUE) private readonly queue: Queue<PdfJobData>,
    private readonly prisma: PrismaService,
    private readonly source: PublicationSourceReader,
    private readonly files: FileStorageService,
  ) {}

  async create(
    access: AccessContext,
    programId: string,
    versionId: string,
  ): Promise<ProgramPdfExportDto> {
    const version = await this.source.read(access, programId, versionId);
    const program = await this.prisma.program.findUniqueOrThrow({
      where: { id: programId },
      select: { degreeLevel: true },
    });
    const now = new Date();
    const exportId = randomUUID();
    const label = version.versionNumber ? `v${version.versionNumber}` : 'nhap';
    const data: PdfJobData = {
      exportId,
      ownerId: access.userId,
      programId,
      versionId,
      fileName: `CTDT-${version.program.programCode}-${label}.pdf`.replace(
        SAFE_NAME,
        '_',
      ),
      draft: version.status === ProgramVersionStatus.DRAFT,
      requestedAt: now.toISOString(),
      snapshot: snapshotOf(version, program.degreeLevel, now),
    };
    await this.sweepExpired().catch((error: unknown) =>
      this.logger.warn(`PDF sweep failed: ${String(error)}`),
    );
    const job = await this.queue
      .add(PDF_JOB, data, {
        jobId: exportId,
        attempts: 2,
        backoff: { type: 'fixed', delay: 2_000 },
        removeOnComplete: { age: (PDF_TTL_MS / 1000) * 2 },
        removeOnFail: { age: (PDF_TTL_MS / 1000) * 2 },
      })
      .catch(() => {
        throw new AppException(PUBLICATION_ERRORS.PDF_QUEUE_UNAVAILABLE);
      });
    return this.describe(job, 'QUEUED');
  }

  async status(
    access: AccessContext,
    exportId: string,
  ): Promise<ProgramPdfExportDto> {
    const job = await this.ownJob(access, exportId);
    return this.describe(job, await this.stateOf(job));
  }

  async file(access: AccessContext, exportId: string) {
    const job = await this.ownJob(access, exportId);
    // Recheck the program scope: a grant removed since the request ends the download too.
    const program = await this.prisma.program.findUnique({
      where: { id: job.data.programId },
      select: { id: true, facultyId: true },
    });
    if (
      !program ||
      access.modeFor(PERMISSIONS.PROGRAM_VIEW, programTarget(program)) === null
    )
      throw new AppException(PUBLICATION_ERRORS.PDF_EXPORT_NOT_FOUND);
    const state = await this.stateOf(job);
    if (state === 'EXPIRED') {
      await this.files.remove(pdfPath(exportId));
      throw new AppException(PUBLICATION_ERRORS.PDF_EXPORT_EXPIRED);
    }
    if (state !== 'READY')
      throw new AppException(PUBLICATION_ERRORS.PDF_NOT_READY);
    const opened = await this.files.open(pdfPath(exportId)).catch(() => {
      throw new AppException(PUBLICATION_ERRORS.PDF_EXPORT_EXPIRED);
    });
    return { ...opened, fileName: job.data.fileName };
  }

  private async ownJob(access: AccessContext, exportId: string) {
    const job = await this.queue.getJob(exportId);
    // Somebody else's export reads the same as an unknown one.
    if (!job || job.data.ownerId !== access.userId)
      throw new AppException(PUBLICATION_ERRORS.PDF_EXPORT_NOT_FOUND);
    return job;
  }

  private async stateOf(job: Job<PdfJobData>): Promise<PdfExportState> {
    const state = await job.getState();
    if (state === 'active') return 'RUNNING';
    if (state === 'failed') return 'FAILED';
    if (state === 'completed')
      return (job.finishedOn ?? 0) + PDF_TTL_MS < Date.now()
        ? 'EXPIRED'
        : 'READY';
    return 'QUEUED';
  }

  private describe(
    job: Job<PdfJobData>,
    state: PdfExportState,
  ): ProgramPdfExportDto {
    return {
      id: job.data.exportId,
      state,
      programId: job.data.programId,
      versionId: job.data.versionId,
      fileName: job.data.fileName,
      draft: job.data.draft,
      requestedAt: job.data.requestedAt,
      expiresAt:
        state === 'READY' || state === 'EXPIRED'
          ? new Date((job.finishedOn ?? 0) + PDF_TTL_MS).toISOString()
          : null,
      // The worker's own error text (and any Chromium detail) never leaves the server.
      failure:
        state === 'FAILED'
          ? 'Không tạo được file PDF, hãy thử xuất lại.'
          : null,
    };
  }

  // Files of finished exports past their TTL. Jobs themselves are dropped by removeOnComplete.
  private async sweepExpired(): Promise<void> {
    const done = await this.queue.getJobs(['completed'], 0, 200);
    for (const job of done)
      if ((job.finishedOn ?? 0) + PDF_TTL_MS < Date.now())
        await this.files.remove(pdfPath(job.id!));
  }
}
