import { Injectable, Logger } from '@nestjs/common';
import {
  ChangeRequestStatus,
  ChangeRequestType,
  RequestOrigin,
  ChangeTargetType,
  type Prisma,
} from '../../generated/prisma/client.js';
import type { AccessContext } from '../../shared/authz/access-context.js';
import { PERMISSIONS } from '../../shared/authz/permission-codes.js';
import { isAcademicOfficeHolder } from '../../shared/change-requests/academic-office.js';
import { REQUEST_DRAFT_ERRORS } from '../../shared/change-requests/change-request.errors.js';
import {
  editPermissionsFor,
  TYPE_TARGETS,
  workspaceKindFor,
} from '../../shared/change-requests/request-kinds.js';
import { AppException } from '../../shared/exception/app.exception.js';
import { COMMON_ERRORS } from '../../shared/exception/error-codes.js';
import { FileStorageService } from '../../shared/files/file-storage.service.js';
import { toPage, toSkipTake, type Page } from '../../shared/pagination/page.js';
import { PrismaService } from '../../shared/prisma/prisma.service.js';
import { programContentTarget } from '../../shared/programs/program-content-target.js';
import { waitingBefore } from '../../shared/time/days-since.js';
import { todayDate } from '../../shared/time/today.js';
import { ChangeRequestDetailReader } from './change-request-detail.reader.js';
import { CHANGE_REQUEST_ERRORS } from './change-request-feature.errors.js';
import {
  REQUEST_SUMMARY_SELECT,
  toSummaryDto,
} from './change-request.mapper.js';
import {
  ChangeRequestQueryDto,
  CreateChangeRequestDto,
  UpdateChangeRequestDto,
} from './change-request.dto.js';
import { REQUEST_CODE } from './change-request.constants.js';
import type {
  ChangeRequestDetailDto,
  ChangeRequestSummaryDto,
  ConflictDto,
} from './change-request-response.dto.js';
import { ConflictFinder } from './conflict-finder.js';
import {
  RequestTargetResolver,
  targetKey,
  type ResolvedTarget,
} from './request-target.resolver.js';
import {
  findVisibleRequest,
  visibleWhere,
  type RequestCore,
} from './request-visibility.js';
import { WorkingCopyService } from './working-copy.service.js';

@Injectable()
export class ChangeRequestsService {
  private readonly logger = new Logger(ChangeRequestsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly targets: RequestTargetResolver,
    private readonly copies: WorkingCopyService,
    private readonly conflicts: ConflictFinder,
    private readonly files: FileStorageService,
    private readonly details: ChangeRequestDetailReader,
  ) {}

  async list(
    query: ChangeRequestQueryDto,
    access: AccessContext,
  ): Promise<Page<ChangeRequestSummaryDto>> {
    const where: Prisma.ChangeRequestWhereInput = {
      AND: [
        visibleWhere(access),
        {
          ...(query.status && { status: query.status }),
          ...(query.requestType && { requestType: query.requestType }),
          ...(query.origin && { origin: query.origin }),
          ...(query.createdById && { createdById: query.createdById }),
          ...(query.mine && { createdById: access.userId }),
          // Only PENDING_* rows have levelEnteredAt, so the filter implies them. "N days or more" includes day N.
          ...(query.minDaysWaiting && {
            levelEnteredAt: {
              lt: waitingBefore(query.minDaysWaiting),
            },
          }),
        },
      ],
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.changeRequest.findMany({
        where,
        select: REQUEST_SUMMARY_SELECT,
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        ...toSkipTake(query),
      }),
      this.prisma.changeRequest.count({ where }),
    ]);
    return toPage(rows.map(toSummaryDto), total, query);
  }

  async create(
    dto: CreateChangeRequestDto,
    access: AccessContext,
  ): Promise<ChangeRequestDetailDto> {
    if (!TYPE_TARGETS[dto.requestType].includes(dto.targetType)) {
      throw new AppException(CHANGE_REQUEST_ERRORS.TYPE_TARGET_MISMATCH);
    }
    // The permission first, so a caller who may not create this kind of request learns that before the target is looked up.
    assertMayCreate(access, dto.requestType);
    const target = await this.targets.resolve(dto.targetType, dto.targetId);
    await assertCanCreate(
      this.prisma,
      access,
      dto.requestType,
      dto.targetType,
      target,
    );
    const today = todayDate();
    const id = await this.prisma.$transaction(async (tx) => {
      const request = await tx.changeRequest.create({
        data: {
          requestCode: await nextRequestCode(tx),
          requestType: dto.requestType,
          targetType: dto.targetType,
          targetCode: target.code,
          ...targetKey(target),
          createdById: access.userId,
          title: dto.title,
          reason: dto.reason,
          origin: dto.origin,
          basisDocumentNumber: dto.basisDocumentNumber ?? null,
          // Stored now: F-15 decides who may release into a started semester from the day of creation, not from today's roles.
          createdByAcademicOffice: await isAcademicOfficeHolder(
            tx,
            access.userId,
            today,
          ),
        },
        select: {
          id: true,
          requestType: true,
          targetType: true,
          programId: true,
          courseId: true,
        },
      });
      await this.copies.create(tx, request);
      return request.id;
    });
    this.logger.log(
      `Change request ${id} (${dto.requestType}) created by ${access.userId}`,
    );
    return this.details.read(id, access);
  }

  async update(
    id: string,
    dto: UpdateChangeRequestDto,
    access: AccessContext,
  ): Promise<ChangeRequestDetailDto> {
    const row = await this.findOwnDraft(id, access);
    const origin = dto.origin ?? row.origin;
    const basis =
      dto.basisDocumentNumber !== undefined
        ? dto.basisDocumentNumber
        : row.basisDocumentNumber;
    if (origin === RequestOrigin.UNIVERSITY && !basis) {
      throw new AppException(CHANGE_REQUEST_ERRORS.BASIS_REQUIRED);
    }
    const { count } = await this.prisma.changeRequest.updateMany({
      where: { id, status: ChangeRequestStatus.DRAFT },
      data: {
        title: dto.title,
        reason: dto.reason,
        origin,
        basisDocumentNumber: basis,
      },
    });
    if (count === 0) {
      throw new AppException(REQUEST_DRAFT_ERRORS.NOT_DRAFT);
    }
    return this.details.read(id, access);
  }

  async remove(id: string, access: AccessContext): Promise<void> {
    const row = await this.findOwnDraft(id, access);
    if (row.submissionRound > 0) {
      throw new AppException(CHANGE_REQUEST_ERRORS.REQUEST_NOT_DELETABLE);
    }
    const paths = await this.prisma.$transaction(async (tx) => {
      // A guard write inside the transaction: a submit racing this delete changes the row and loses here.
      const { count } = await tx.changeRequest.updateMany({
        where: {
          id,
          status: ChangeRequestStatus.DRAFT,
          submissionRound: 0,
        },
        data: { updatedAt: new Date() },
      });
      if (count === 0) {
        throw new AppException(CHANGE_REQUEST_ERRORS.REQUEST_NOT_DELETABLE);
      }
      await this.copies.discard(tx, id);
      const documents = await tx.changeRequestDocument.findMany({
        where: { changeRequestId: id },
        select: { filePath: true },
      });
      await tx.changeRequestDocument.deleteMany({
        where: { changeRequestId: id },
      });
      await tx.changeRequest.delete({ where: { id } });
      return documents.map((document) => document.filePath);
    });
    // Files go after the commit: a rollback after a removal would leave rows pointing at nothing.
    await Promise.all(paths.map((path) => this.files.remove(path)));
    this.logger.log(`Change request ${id} deleted by ${access.userId}`);
  }

  async rebase(
    id: string,
    access: AccessContext,
  ): Promise<ChangeRequestDetailDto> {
    const row = await this.findOwnDraft(id, access);
    if (!workspaceKindFor(row.requestType, row.targetType)) {
      throw new AppException(CHANGE_REQUEST_ERRORS.NOT_WORKSPACE_TYPE);
    }
    await this.prisma.$transaction((tx) => this.copies.rebase(tx, row));
    this.logger.log(`Change request ${id} rebased by ${access.userId}`);
    return this.details.read(id, access);
  }

  async conflictsFor(
    targetType: ChangeTargetType,
    targetId: string,
    access: AccessContext,
  ): Promise<ConflictDto[]> {
    const target = await this.targets.resolve(targetType, targetId);
    return this.conflicts.find(targetKey(target), access);
  }

  // Every write by the creator on the request itself starts here; another user's private draft answers 404.
  async findOwnDraft(id: string, access: AccessContext): Promise<RequestCore> {
    const row = await findVisibleRequest(this.prisma, id, access);
    if (row.createdById !== access.userId) {
      throw new AppException(REQUEST_DRAFT_ERRORS.NOT_CREATOR);
    }
    if (row.status !== ChangeRequestStatus.DRAFT) {
      throw new AppException(REQUEST_DRAFT_ERRORS.NOT_DRAFT);
    }
    return row;
  }
}

function assertMayCreate(access: AccessContext, type: ChangeRequestType): void {
  const code =
    type === ChangeRequestType.ORGANIZATION
      ? PERMISSIONS.CHANGE_REQUEST_CREATE_ORGANIZATIONAL
      : PERMISSIONS.CHANGE_REQUEST_CREATE;
  if (!access.has(code)) {
    throw new AppException(COMMON_ERRORS.PERMISSION_DENIED);
  }
}

// An organisational request needs its own permission on the group / program; a data request needs the right to edit
// the target through either path. assertCan reports OUT_OF_SCOPE when the caller holds the permission elsewhere.
async function assertCanCreate(
  db: PrismaService,
  access: AccessContext,
  type: ChangeRequestType,
  targetType: ChangeTargetType,
  target: ResolvedTarget,
): Promise<void> {
  if (type === ChangeRequestType.ORGANIZATION) {
    access.assertCan(
      PERMISSIONS.CHANGE_REQUEST_CREATE_ORGANIZATIONAL,
      target.scope,
    );
    return;
  }
  access.assertCan(PERMISSIONS.CHANGE_REQUEST_CREATE, {});
  const codes = editPermissionsFor(type, targetType);
  // Lecturers edit a programme's rows through their subject group, so the check sees the groups it lists.
  const scope = editsProgramContent(type, targetType)
    ? await programContentTarget(db, {
        id: target.id,
        facultyId: target.scope.orgUnitIds?.[0] ?? '',
      })
    : target.scope;
  if (!codes.some((code) => access.modeFor(code, scope) !== null)) {
    access.assertCan(codes[0], scope);
  }
}

function editsProgramContent(
  type: ChangeRequestType,
  targetType: ChangeTargetType,
): boolean {
  return (
    type === ChangeRequestType.CURRICULUM ||
    (type === ChangeRequestType.OUTCOME &&
      targetType === ChangeTargetType.PROGRAM)
  );
}

// One PostgreSQL sequence: unique and gap-tolerant under concurrency; the year is for reading only (D13).
async function nextRequestCode(tx: Prisma.TransactionClient): Promise<string> {
  const [{ value }] = await tx.$queryRaw<
    { value: bigint }[]
  >`SELECT nextval('change_request_code_seq') AS value`;
  const year = new Date().getFullYear();
  return `${REQUEST_CODE.PREFIX}-${year}-${String(value).padStart(REQUEST_CODE.DIGITS, '0')}`;
}
