import type { Queue } from 'bullmq';
import { describe, expect, it, vi } from 'vitest';
import {
  DegreeLevel,
  Prisma,
  ProgramVersionStatus,
} from '../../../generated/prisma/client.js';
import type { AccessContext } from '../../../shared/authz/access-context.js';
import type { FileStorageService } from '../../../shared/files/file-storage.service.js';
import type { PrismaService } from '../../../shared/prisma/prisma.service.js';
import type {
  PublicationSourceReader,
  PublicationVersion,
} from '../publication-source.reader.js';
import {
  ProgramPdfExportsService,
  snapshotOf,
  type PdfJobData,
} from './program-pdf-exports.service.js';

function makeVersion(
  status: ProgramVersionStatus = ProgramVersionStatus.ACTIVE,
): PublicationVersion {
  return {
    id: 'ver-1',
    program: { id: 'prog-1', programCode: 'CNTT-THS', facultyId: 'fac-1' },
    programName: 'Khoa học máy tính',
    majorCode: '8480101',
    majorName: 'Khoa học máy tính',
    versionNumber: '1.0',
    status,
    semesterCount: 4,
    totalCredits: new Prisma.Decimal(60),
    compulsoryCredits: new Prisma.Decimal(45),
    electiveCredits: new Prisma.Decimal(15),
    decisionNumber: '1234/QĐ-ĐHBK',
    signedDate: new Date('2026-08-01T00:00:00.000Z'),
    effectiveSemester: { semesterCode: '2610' },
    electiveGroups: [],
    plos: [],
    curriculumItems: [],
  } as unknown as PublicationVersion;
}

describe('ProgramPdfExportsService & snapshotOf', () => {
  it('maps MASTER and DOCTORATE degree labels and renders ACTIVE status as Mới nhất', () => {
    const now = new Date('2026-11-28T04:00:00.000Z');
    const masterSnap = snapshotOf(makeVersion(), DegreeLevel.MASTER, now);
    expect(masterSnap.degreeLevel).toBe('Thạc sĩ');
    expect(masterSnap.statusLabel).toBe('Mới nhất');

    const doctorateSnap = snapshotOf(
      makeVersion(),
      DegreeLevel.DOCTORATE,
      now,
      ['K2025', 'K2026'],
    );
    expect(doctorateSnap.degreeLevel).toBe('Tiến sĩ');
    expect(doctorateSnap.statusLabel).toBe(
      'Mới nhất (Khóa áp dụng: K2025, K2026)',
    );
  });

  it('includes assigned cohorts when queuing a PDF export job', async () => {
    let queuedData: PdfJobData | undefined;
    const queue = {
      add: vi.fn(async (_name: string, data: PdfJobData) => {
        queuedData = data;
        return {
          id: data.exportId,
          data,
          getState: async () => 'waiting',
        };
      }),
      getJobs: vi.fn().mockResolvedValue([]),
    } as unknown as Queue<PdfJobData>;
    const prisma = {
      program: {
        findUniqueOrThrow: vi
          .fn()
          .mockResolvedValue({ degreeLevel: DegreeLevel.MASTER }),
      },
      cohortVersion: {
        findMany: vi.fn().mockResolvedValue([
          { cohort: { cohortCode: 'K2024' } },
          { cohort: { cohortCode: 'K2025' } },
        ]),
      },
    } as unknown as PrismaService;
    const source = {
      read: vi
        .fn()
        .mockResolvedValue(makeVersion(ProgramVersionStatus.ACTIVE)),
    } as unknown as PublicationSourceReader;
    const files = {} as FileStorageService;

    const service = new ProgramPdfExportsService(queue, prisma, source, files);
    const exported = await service.create(
      { userId: 'user-1' } as AccessContext,
      'prog-1',
      'ver-1',
    );

    expect(exported.state).toBe('QUEUED');
    expect(queuedData?.snapshot.degreeLevel).toBe('Thạc sĩ');
    expect(queuedData?.snapshot.statusLabel).toBe(
      'Mới nhất (Khóa áp dụng: K2024, K2025)',
    );
  });
});
