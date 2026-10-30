import { Readable } from 'node:stream';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AttachmentFileType,
  CourseStatus,
  Prisma,
  ScopeSource,
  ScopeType,
  SyllabusStatus,
  SyllabusMaterialKind,
} from '../../generated/prisma/client.js';
import {
  AccessContext,
  type ActiveAssignment,
} from '../../shared/authz/access-context.js';
import { PERMISSIONS } from '../../shared/authz/permission-codes.js';
import type { FileStorageService } from '../../shared/files/file-storage.service.js';
import type { PrismaService } from '../../shared/prisma/prisma.service.js';
import { SyllabusAttachmentsService } from './syllabus-attachments.service.js';

function holder(userId: string, seesAll: boolean): AccessContext {
  const assignment: ActiveAssignment = {
    assignmentId: null,
    roleId: 'r',
    roleCode: 'R',
    roleName: 'R',
    scopeSource: ScopeSource.NONE,
    scopeType: ScopeType.ASSIGNMENT,
    scopeUnit: null,
    scope: {
      all: false,
      orgUnitIds: new Set(['home']),
      subjectGroupIds: new Set(),
      programIds: new Set(),
      studentIds: new Set(),
    },
    permissions: new Map([
      [PERMISSIONS.SYLLABUS_EDIT, { mode: 'VIA_REQUEST', scope: 'SCOPED' }],
      [
        PERMISSIONS.PROGRAM_VIEW,
        { mode: 'DIRECT', scope: seesAll ? 'ALL' : 'SCOPED' },
      ],
    ]),
  };
  return new AccessContext(userId, [assignment]);
}

const R3 = holder('user', true);
const OTHER_R3 = holder('other', true);
const R6 = holder('student', false);

function accessRow(status: SyllabusStatus) {
  return {
    id: 's1',
    status,
    courseId: 'c1',
    course: {
      id: 'c1',
      courseCode: 'IT001',
      courseName: 'Nhập môn',
      englishName: null,
      credits: new Prisma.Decimal('3'),
      status: CourseStatus.ACTIVE,
      ownerFacultyId: 'home',
      ownerGroupId: null,
      ownerFaculty: { unitCode: 'KHOA_CNTT' },
    },
  };
}

function upload(name: string, bytes: number[]): Express.Multer.File {
  return {
    originalname: Buffer.from(name, 'utf8').toString('latin1'),
    buffer: Buffer.from(bytes),
  } as Express.Multer.File;
}

const PDF_BYTES = [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31];

describe('SyllabusAttachmentsService', () => {
  let prisma: {
    syllabus: {
      findUnique: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
    };
    syllabusAttachment: {
      count: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
    };
  };
  let files: {
    write: ReturnType<typeof vi.fn>;
    open: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };
  let service: SyllabusAttachmentsService;

  beforeEach(() => {
    prisma = {
      syllabus: {
        findUnique: vi.fn().mockResolvedValue(accessRow(SyllabusStatus.DRAFT)),
        findFirst: vi.fn().mockResolvedValue(null),
      },
      syllabusAttachment: {
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn((args: { data: Record<string, unknown> }) =>
          Promise.resolve({
            id: 'a1',
            ...args.data,
            recordedAt: new Date(),
            uploadedBy: { id: 'user', fullName: 'Người dùng' },
          }),
        ),
        findUnique: vi.fn(),
        delete: vi.fn().mockResolvedValue({}),
      },
    };
    files = {
      write: vi.fn().mockResolvedValue(undefined),
      open: vi.fn(),
      remove: vi.fn().mockResolvedValue(undefined),
    };
    service = new SyllabusAttachmentsService(
      prisma as unknown as PrismaService,
      files as unknown as FileStorageService,
    );
  });

  describe('upload', () => {
    it('adds a signed file to a published or historical revision for a holder of syllabus.edit (US-077)', async () => {
      for (const status of [
        SyllabusStatus.PUBLISHED,
        SyllabusStatus.HISTORICAL,
      ]) {
        prisma.syllabus.findUnique.mockResolvedValue(accessRow(status));

        await expect(
          service.upload(
            's1',
            upload('Quyết định ký.pdf', PDF_BYTES),
            SyllabusMaterialKind.SIGNED_SYLLABUS,
            R3,
          ),
        ).resolves.toMatchObject({ fileName: 'Quyết định ký.pdf' });
      }
      expect(prisma.syllabusAttachment.create).toHaveBeenCalledTimes(2);
    });

    it('still asks the scope of the course for a published revision', async () => {
      prisma.syllabus.findUnique.mockResolvedValue({
        ...accessRow(SyllabusStatus.PUBLISHED),
        course: {
          ...accessRow(SyllabusStatus.PUBLISHED).course,
          ownerFacultyId: 'elsewhere',
        },
      });

      await expect(
        service.upload(
          's1',
          upload('Ký.pdf', PDF_BYTES),
          SyllabusMaterialKind.SIGNED_SYLLABUS,
          R3,
        ),
      ).rejects.toMatchObject({ code: 'OUT_OF_SCOPE' });
      expect(files.write).not.toHaveBeenCalled();
    });

    it('stores a PDF under a random name and keeps the original name in the row', async () => {
      const result = await service.upload(
        's1',
        upload('Đề cương ký.pdf', PDF_BYTES),
        SyllabusMaterialKind.SIGNED_SYLLABUS,
        R3,
      );

      expect(prisma.syllabusAttachment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            materialKind: SyllabusMaterialKind.SIGNED_SYLLABUS,
          }),
        }),
      );
      const path = files.write.mock.calls[0][0] as string;
      expect(path).toMatch(/^syllabi\/s1\/[0-9a-f-]{36}\.pdf$/);
      expect(result).toMatchObject({
        materialKind: SyllabusMaterialKind.SIGNED_SYLLABUS,
        fileName: 'Đề cương ký.pdf',
        fileType: AttachmentFileType.PDF,
        sizeBytes: PDF_BYTES.length,
        canDelete: true,
      });
    });

    it('refuses a missing file', async () => {
      await expect(
        service.upload(
          's1',
          undefined,
          SyllabusMaterialKind.SIGNED_SYLLABUS,
          R3,
        ),
      ).rejects.toMatchObject({
        code: 'ATTACHMENT_FILE_REQUIRED',
      });
    });

    it('checks the draft rules before looking at the file', async () => {
      await expect(
        service.upload(
          's1',
          undefined,
          SyllabusMaterialKind.SIGNED_SYLLABUS,
          R6,
        ),
      ).rejects.toMatchObject({
        code: 'SYLLABUS_NOT_FOUND',
      });
    });

    it('refuses an executable renamed to .pdf', async () => {
      await expect(
        service.upload(
          's1',
          upload('x.pdf', [0x4d, 0x5a, 0x90]),
          SyllabusMaterialKind.SIGNED_SYLLABUS,
          R3,
        ),
      ).rejects.toMatchObject({ code: 'ATTACHMENT_TYPE_NOT_ALLOWED' });
      expect(files.write).not.toHaveBeenCalled();
    });

    it('refuses the eleventh file and writes nothing', async () => {
      prisma.syllabusAttachment.count.mockResolvedValue(10);

      await expect(
        service.upload(
          's1',
          upload('a.pdf', PDF_BYTES),
          SyllabusMaterialKind.SIGNED_SYLLABUS,
          R3,
        ),
      ).rejects.toMatchObject({ code: 'ATTACHMENT_LIMIT_REACHED' });
      expect(files.write).not.toHaveBeenCalled();
    });

    it('removes the file again when the row cannot be saved', async () => {
      const failure = new Error('db down');
      prisma.syllabusAttachment.create.mockRejectedValue(failure);

      await expect(
        service.upload(
          's1',
          upload('a.pdf', PDF_BYTES),
          SyllabusMaterialKind.SIGNED_SYLLABUS,
          R3,
        ),
      ).rejects.toBe(failure);
      expect(files.remove).toHaveBeenCalledWith(files.write.mock.calls[0][0]);
    });
  });

  describe('open', () => {
    const row = (status: SyllabusStatus) => ({
      fileName: 'Đề cương.pdf',
      filePath: 'syllabi/s1/x.pdf',
      syllabus: accessRow(status),
    });

    it('hides the file of a Draft from a student', async () => {
      prisma.syllabusAttachment.findUnique.mockResolvedValue(
        row(SyllabusStatus.DRAFT),
      );

      await expect(service.open('a1', R6)).rejects.toMatchObject({
        code: 'SYLLABUS_NOT_FOUND',
      });
    });

    it('streams the file with its original name and a type taken from the stored path', async () => {
      prisma.syllabusAttachment.findUnique.mockResolvedValue(
        row(SyllabusStatus.DRAFT),
      );
      files.open.mockResolvedValue({ stream: Readable.from([]), sizeBytes: 1 });

      const result = await service.open('a1', R3);

      expect(result).toMatchObject({
        fileName: 'Đề cương.pdf',
        mime: 'application/pdf',
      });
    });

    it('is not found for an unknown id', async () => {
      prisma.syllabusAttachment.findUnique.mockResolvedValue(null);

      await expect(service.open('nope', R3)).rejects.toMatchObject({
        code: 'ATTACHMENT_NOT_FOUND',
      });
    });
  });

  describe('remove', () => {
    const row = {
      id: 'a1',
      filePath: 'syllabi/s1/x.pdf',
      uploadedById: 'user',
      syllabus: accessRow(SyllabusStatus.DRAFT),
    };

    it('lets the uploader remove the row and then the file', async () => {
      prisma.syllabusAttachment.findUnique.mockResolvedValue(row);

      await service.remove('a1', R3);

      expect(prisma.syllabusAttachment.delete).toHaveBeenCalledWith({
        where: { id: 'a1' },
      });
      expect(files.remove).toHaveBeenCalledWith('syllabi/s1/x.pdf');
    });

    it('refuses anyone else', async () => {
      prisma.syllabusAttachment.findUnique.mockResolvedValue(row);

      await expect(service.remove('a1', OTHER_R3)).rejects.toMatchObject({
        code: 'ATTACHMENT_NOT_UPLOADER',
      });
      expect(prisma.syllabusAttachment.delete).not.toHaveBeenCalled();
    });

    it('still succeeds when the file cannot be deleted', async () => {
      prisma.syllabusAttachment.findUnique.mockResolvedValue(row);
      files.remove.mockRejectedValue(new Error('EBUSY'));

      await expect(service.remove('a1', R3)).resolves.toBeUndefined();
    });

    it('locks the files of a published or historical revision before asking who uploaded them (D15)', async () => {
      for (const status of [
        SyllabusStatus.PUBLISHED,
        SyllabusStatus.HISTORICAL,
      ]) {
        prisma.syllabusAttachment.findUnique.mockResolvedValue({
          ...row,
          syllabus: accessRow(status),
        });

        await expect(service.remove('a1', OTHER_R3)).rejects.toMatchObject({
          code: 'ATTACHMENT_LOCKED',
        });
        await expect(service.remove('a1', R3)).rejects.toMatchObject({
          code: 'ATTACHMENT_LOCKED',
        });
      }
      expect(prisma.syllabusAttachment.delete).not.toHaveBeenCalled();
    });
  });
});
