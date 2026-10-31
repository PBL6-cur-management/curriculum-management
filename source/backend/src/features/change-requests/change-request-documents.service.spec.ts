import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ChangeDocumentType,
  ChangeRequestStatus,
} from '../../generated/prisma/client.js';
import { AccessContext } from '../../shared/authz/access-context.js';
import type { FileStorageService } from '../../shared/files/file-storage.service.js';
import type { PrismaService } from '../../shared/prisma/prisma.service.js';
import { ChangeRequestDocumentsService } from './change-request-documents.service.js';

const ACCESS = new AccessContext('u1', []);
const PDF = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.from('body')]);

const file = (patch: Partial<Express.Multer.File> = {}) =>
  ({
    originalname: 'to-trinh.pdf',
    buffer: PDF,
    size: PDF.length,
    ...patch,
  }) as Express.Multer.File;

const request = (patch: object = {}) => ({
  id: 'cr1',
  createdById: 'u1',
  status: ChangeRequestStatus.DRAFT,
  submissionRound: 0,
  ...patch,
});

describe('ChangeRequestDocumentsService', () => {
  const prisma = {
    approvalDelegation: { findMany: vi.fn().mockResolvedValue([]) },
    changeRequest: { findFirst: vi.fn() },
    changeRequestDocument: {
      count: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      deleteMany: vi.fn(),
    },
  };
  const files = { write: vi.fn(), remove: vi.fn(), open: vi.fn() };
  let service: ChangeRequestDocumentsService;
  const dto = { documentType: ChangeDocumentType.SUBMISSION };

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.changeRequest.findFirst.mockResolvedValue(request());
    prisma.changeRequestDocument.count.mockResolvedValue(0);
    prisma.changeRequestDocument.create.mockImplementation(
      ({ data }: { data: object }) => ({
        id: 'd1',
        ...data,
        createdAt: new Date('2026-10-19T00:00:00Z'),
        uploadedBy: { id: 'u1', fullName: 'A' },
      }),
    );
    files.write.mockResolvedValue(undefined);
    files.remove.mockResolvedValue(undefined);
    service = new ChangeRequestDocumentsService(
      prisma as unknown as PrismaService,
      files as unknown as FileStorageService,
    );
  });

  describe('upload', () => {
    it('is for the creator, while the request is open, with a file of an accepted type', async () => {
      prisma.changeRequest.findFirst.mockResolvedValue(
        request({ createdById: 'other' }),
      );
      await expect(
        service.upload('cr1', dto, file(), ACCESS),
      ).rejects.toMatchObject({ code: 'REQUEST_NOT_CREATOR' });
      prisma.changeRequest.findFirst.mockResolvedValue(
        request({ status: ChangeRequestStatus.WITHDRAWN }),
      );
      await expect(
        service.upload('cr1', dto, file(), ACCESS),
      ).rejects.toMatchObject({ code: 'REQUEST_CLOSED' });
      prisma.changeRequest.findFirst.mockResolvedValue(request());
      await expect(
        service.upload('cr1', dto, undefined, ACCESS),
      ).rejects.toMatchObject({ code: 'ATTACHMENT_FILE_REQUIRED' });
      await expect(
        service.upload(
          'cr1',
          dto,
          file({ originalname: 'x.exe', buffer: Buffer.from('MZ') }),
          ACCESS,
        ),
      ).rejects.toMatchObject({ code: 'ATTACHMENT_TYPE_NOT_ALLOWED' });
      expect(files.write).not.toHaveBeenCalled();
    });

    it('refuses the 21st document', async () => {
      prisma.changeRequestDocument.count.mockResolvedValue(20);
      await expect(
        service.upload('cr1', dto, file(), ACCESS),
      ).rejects.toMatchObject({ code: 'DOCUMENTS_LIMIT' });
    });

    it('stores the file under a random name, leaves a Draft upload unseen and does not trust the client name for the path', async () => {
      const dtoOut = await service.upload(
        'cr1',
        dto,
        file({ originalname: '../../etc/passwd.pdf' }),
        ACCESS,
      );
      const path = files.write.mock.calls[0][0] as string;
      expect(path).toMatch(/^change-requests\/cr1\/[0-9a-f-]{36}\.pdf$/);
      expect(dtoOut).toMatchObject({
        seenInRound: null,
        canRemove: true,
        fileName: 'passwd.pdf',
      });
    });

    it('marks an upload made while pending as seen in the current round', async () => {
      prisma.changeRequest.findFirst.mockResolvedValue(
        request({
          status: ChangeRequestStatus.PENDING_DIRECTOR,
          submissionRound: 2,
        }),
      );
      const dtoOut = await service.upload('cr1', dto, file(), ACCESS);
      expect(dtoOut).toMatchObject({ seenInRound: 2, canRemove: false });
    });

    it('removes the file when the row cannot be written', async () => {
      prisma.changeRequestDocument.create.mockRejectedValue(
        new Error('db down'),
      );
      await expect(service.upload('cr1', dto, file(), ACCESS)).rejects.toThrow(
        'db down',
      );
      expect(files.remove).toHaveBeenCalledWith(files.write.mock.calls[0][0]);
    });
  });

  describe('remove', () => {
    const row = {
      id: 'd1',
      changeRequestId: 'cr1',
      filePath: 'change-requests/cr1/a.pdf',
    };

    it('deletes the row first and the file after', async () => {
      prisma.changeRequestDocument.findUnique.mockResolvedValue(row);
      const order: string[] = [];
      prisma.changeRequestDocument.deleteMany.mockImplementation(() => {
        order.push('row');
        return { count: 1 };
      });
      files.remove.mockImplementation(() => order.push('file'));
      await service.remove('d1', ACCESS);
      expect(order).toEqual(['row', 'file']);
      expect(prisma.changeRequestDocument.deleteMany).toHaveBeenCalledWith({
        where: {
          id: 'd1',
          seenInRound: null,
          changeRequest: { status: ChangeRequestStatus.DRAFT },
        },
      });
    });

    it('answers LOCKED when an approver could have seen it, and keeps the file', async () => {
      prisma.changeRequestDocument.findUnique.mockResolvedValue(row);
      prisma.changeRequestDocument.deleteMany.mockResolvedValue({ count: 0 });
      await expect(service.remove('d1', ACCESS)).rejects.toMatchObject({
        code: 'DOCUMENT_LOCKED',
      });
      expect(files.remove).not.toHaveBeenCalled();
    });

    it('is for the creator and for a document that exists', async () => {
      prisma.changeRequestDocument.findUnique.mockResolvedValue(null);
      await expect(service.remove('d1', ACCESS)).rejects.toMatchObject({
        code: 'DOCUMENT_NOT_FOUND',
      });
      prisma.changeRequestDocument.findUnique.mockResolvedValue(row);
      prisma.changeRequest.findFirst.mockResolvedValue(
        request({ createdById: 'other' }),
      );
      await expect(service.remove('d1', ACCESS)).rejects.toMatchObject({
        code: 'REQUEST_NOT_CREATOR',
      });
    });
  });

  describe('open', () => {
    it('answers 404 when the request is not visible and streams the file otherwise', async () => {
      prisma.changeRequestDocument.findUnique.mockResolvedValue({
        changeRequestId: 'cr1',
        filePath: 'change-requests/cr1/a.pdf',
        fileName: 'tờ trình.pdf',
      });
      prisma.changeRequest.findFirst.mockResolvedValue(null);
      await expect(service.open('d1', ACCESS)).rejects.toMatchObject({
        code: 'REQUEST_NOT_FOUND',
      });
      prisma.changeRequest.findFirst.mockResolvedValue(request());
      files.open.mockResolvedValue({ stream: 'stream', sizeBytes: 3 });
      await expect(service.open('d1', ACCESS)).resolves.toEqual({
        stream: 'stream',
        fileName: 'tờ trình.pdf',
        mime: 'application/pdf',
      });
    });
  });
});
