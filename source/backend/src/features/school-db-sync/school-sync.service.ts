import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  SchoolSyncStatus,
  type Prisma,
  type SchoolMappingKind,
  type SchoolSyncConfiguration,
  type SyncConflict,
  type SyncLog,
} from '../../generated/prisma/client.js';
import type { AccessContext } from '../../shared/authz/access-context.js';
import { PERMISSIONS } from '../../shared/authz/permission-codes.js';
import type { Env } from '../../shared/config/env.validation.js';
import { AppException } from '../../shared/exception/app.exception.js';
import type { PageQueryDto } from '../../shared/pagination/page-query.dto.js';
import { toPage, toSkipTake, type Page } from '../../shared/pagination/page.js';
import { PrismaService } from '../../shared/prisma/prisma.service.js';
import { APP_TIME_ZONE, toIsoDay } from '../../shared/time/today.js';
import type {
  SaveSyncConfigurationDto,
  SaveSyncMappingsDto,
  StartSyncRunDto,
  SyncReferenceQueryDto,
  SyncRunQueryDto,
  TestSyncConnectionDto,
} from './dto/school-sync.dto.js';
import type {
  SyncConfigurationDto,
  SyncConflictDto,
  SyncConnectionTestDto,
  SyncMappingSetDto,
  SyncReferenceOptionDto,
  SyncRunDto,
} from './dto/school-sync-response.dto.js';
import { SchoolSyncCipher } from './school-sync.cipher.js';
import {
  ACADEMIC_OFFICE_ROLE,
  SIMULATED_HOSTS,
} from './school-sync.constants.js';
import { SCHOOL_SYNC_ERRORS, SYNC_FAILURE } from './school-sync.errors.js';
import {
  SINGLETON_KEY,
  SchoolSyncRunner,
  connectionOf,
  isRunnable,
} from './school-sync.runner.js';
import { nextRunAfter } from './school-sync.schedule.js';
import { SchoolSourceReader } from './school-source.reader.js';

// Only the Academic Office holding sync.configure directly (DIRECT) may use any route, even if another role was granted it.
export function assertOffice(access: AccessContext): void {
  const allowed = access.assignments.some(
    (assignment) =>
      assignment.roleCode === ACADEMIC_OFFICE_ROLE &&
      assignment.permissions.get(PERMISSIONS.SYNC_CONFIGURE)?.mode === 'DIRECT',
  );
  if (!allowed) throw new AppException(SCHOOL_SYNC_ERRORS.OFFICE_ONLY);
}

const CONNECTION_FIELDS = ['profile', 'host', 'port', 'database', 'username'] as const;

@Injectable()
export class SchoolSyncService {
  private readonly externalHosts: ReadonlySet<string>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly runner: SchoolSyncRunner,
    private readonly source: SchoolSourceReader,
    private readonly cipher: SchoolSyncCipher,
    config: ConfigService<Env, true>,
  ) {
    this.externalHosts = new Set(
      (config.get('SCHOOL_SYNC_EXTERNAL_HOSTS', { infer: true }) ?? '')
        .split(',')
        .map((host: string) => host.trim().toLowerCase())
        .filter(Boolean),
    );
  }

  private async loadConfiguration(
    db: Prisma.TransactionClient = this.prisma,
  ): Promise<SchoolSyncConfiguration> {
    return db.schoolSyncConfiguration.upsert({
      where: { singletonKey: SINGLETON_KEY },
      create: { singletonKey: SINGLETON_KEY },
      update: {},
    });
  }

  private async activeRunId(db: Prisma.TransactionClient = this.prisma): Promise<string | null> {
    const run = await db.syncLog.findFirst({
      where: { status: SchoolSyncStatus.RUNNING },
      select: { id: true },
    });
    return run?.id ?? null;
  }

  private toConfigurationDto(
    config: SchoolSyncConfiguration,
    activeRunId: string | null,
  ): SyncConfigurationDto {
    return {
      id: config.id,
      revision: config.revision,
      mode: config.mode,
      profile: config.profile,
      enabled: config.enabled,
      sourceIdentity: config.sourceIdentity,
      host: config.host,
      port: config.port,
      database: config.database,
      username: config.username,
      passwordConfigured: config.passwordCiphertext !== null,
      connectionRevision: config.connectionRevision,
      verifiedConnectionRevision: config.verifiedConnectionRevision,
      cadence: config.cadence,
      localTime: config.localTime,
      weekday: config.weekday,
      timeZone: APP_TIME_ZONE,
      nextRunAt: config.nextDueAt?.toISOString() ?? null,
      lastSuccessfulRunId: config.lastSuccessfulRunId,
      lastSnapshotVersion: config.lastSnapshotVersion,
      activeRunId,
      externalAllowed: this.externalHosts.size > 0,
      updatedAt: config.updatedAt.toISOString(),
    };
  }

  private hostAllowed(profile: SchoolSyncConfiguration['profile'], host: string): boolean {
    const name = host.toLowerCase();
    return profile === 'SIMULATED_SQL_SERVER'
      ? SIMULATED_HOSTS.includes(name)
      : this.externalHosts.has(name);
  }

  async getConfiguration(access: AccessContext): Promise<SyncConfigurationDto> {
    assertOffice(access);
    const config = await this.loadConfiguration();
    return this.toConfigurationDto(config, await this.activeRunId());
  }

  async saveConfiguration(
    dto: SaveSyncConfigurationDto,
    access: AccessContext,
    now: Date = new Date(),
  ): Promise<SyncConfigurationDto> {
    assertOffice(access);
    const saved = await this.prisma.$transaction(async (tx) => {
      const current = await this.loadConfiguration(tx);
      await tx.$queryRaw`SELECT "id" FROM "SchoolSyncConfiguration" WHERE "id" = ${current.id} FOR UPDATE`;
      if (current.revision !== dto.revision) {
        throw new AppException(SCHOOL_SYNC_ERRORS.STALE_CONFIGURATION);
      }
      if (await this.activeRunId(tx)) {
        throw new AppException(SCHOOL_SYNC_ERRORS.RUN_IN_PROGRESS);
      }
      if (dto.sourceIdentity !== current.sourceIdentity && current.lastSuccessfulRunId) {
        throw new AppException(SCHOOL_SYNC_ERRORS.SOURCE_IDENTITY_LOCKED);
      }
      const next = {
        profile: dto.profile,
        host: dto.host ?? null,
        port: dto.port ?? null,
        database: dto.database ?? null,
        username: dto.username ?? null,
      };
      const hasPassword = Boolean(dto.password) || current.passwordCiphertext !== null;
      if (dto.mode === 'SCHOOL_DB') {
        if (!next.host || !next.port || !next.database || !next.username || !hasPassword) {
          throw new AppException(SCHOOL_SYNC_ERRORS.INCOMPLETE_CONNECTION);
        }
      }
      if (next.host && !this.hostAllowed(next.profile, next.host)) {
        throw new AppException(SCHOOL_SYNC_ERRORS.HOST_NOT_ALLOWED);
      }
      const envelope = dto.password ? this.cipher.seal(dto.password) : null;
      const connectionChanged =
        envelope !== null ||
        CONNECTION_FIELDS.some((field) => next[field] !== current[field]);
      const weekday = dto.cadence === 'WEEKLY' ? (dto.weekday ?? 1) : null;
      const enabled = dto.enabled && dto.mode === 'SCHOOL_DB';
      return tx.schoolSyncConfiguration.update({
        where: { id: current.id },
        data: {
          revision: current.revision + 1,
          mode: dto.mode,
          enabled,
          sourceIdentity: dto.sourceIdentity,
          ...next,
          ...envelope,
          ...(connectionChanged && {
            connectionRevision: current.connectionRevision + 1,
            verifiedConnectionRevision: null,
          }),
          cadence: dto.cadence,
          localTime: dto.localTime,
          weekday,
          nextDueAt: enabled
            ? nextRunAfter({ cadence: dto.cadence, localTime: dto.localTime, weekday }, now)
            : null,
        },
      });
    });
    return this.toConfigurationDto(saved, null);
  }

  // Tests the SAVED connection only; success marks exactly that connection revision as verified.
  async testConnection(
    dto: TestSyncConnectionDto,
    access: AccessContext,
  ): Promise<SyncConnectionTestDto> {
    assertOffice(access);
    const config = await this.loadConfiguration();
    if (config.revision !== dto.configurationRevision) {
      throw new AppException(SCHOOL_SYNC_ERRORS.STALE_CONFIGURATION);
    }
    const connection = connectionOf(config, this.cipher);
    const code =
      !connection || !this.hostAllowed(config.profile, connection.host)
        ? 'CONNECTOR_UNAVAILABLE'
        : await this.source.probe(connection);
    const result: SyncConnectionTestDto['code'] =
      code === 'CONNECTED' ||
      code === 'CONNECTION_FAILED' ||
      code === 'READ_ONLY_REQUIRED' ||
      code === 'SOURCE_CONTRACT_INVALID'
        ? code
        : 'CONNECTOR_UNAVAILABLE';
    if (result === 'CONNECTED') {
      await this.prisma.schoolSyncConfiguration.updateMany({
        where: { id: config.id, connectionRevision: config.connectionRevision },
        data: { verifiedConnectionRevision: config.connectionRevision },
      });
    }
    return {
      success: result === 'CONNECTED',
      code: result,
      message:
        result === 'CONNECTED'
          ? 'Kết nối được, tài khoản chỉ đọc và có đủ các view cms_sync_v1.'
          : SYNC_FAILURE[result],
      testedAt: new Date().toISOString(),
      configurationRevision: config.revision,
    };
  }

  async getMappings(access: AccessContext): Promise<SyncMappingSetDto> {
    assertOffice(access);
    const config = await this.loadConfiguration();
    const items = await this.prisma.schoolReferenceMapping.findMany({
      where: { configurationId: config.id },
      orderBy: [{ kind: 'asc' }, { sourceCode: 'asc' }],
      select: { kind: true, sourceCode: true, targetCode: true },
    });
    return { revision: config.revision, items };
  }

  private async unknownTargets(
    db: Prisma.TransactionClient,
    kind: SchoolMappingKind,
    codes: string[],
  ): Promise<string[]> {
    if (codes.length === 0) return [];
    const found: { code: string }[] =
      kind === 'COHORT'
        ? (await db.cohort.findMany({ where: { cohortCode: { in: codes } }, select: { cohortCode: true } })).map((row) => ({ code: row.cohortCode }))
        : kind === 'PROGRAM'
          ? (await db.program.findMany({ where: { programCode: { in: codes } }, select: { programCode: true } })).map((row) => ({ code: row.programCode }))
          : kind === 'SEMESTER'
            ? (await db.semester.findMany({ where: { semesterCode: { in: codes } }, select: { semesterCode: true } })).map((row) => ({ code: row.semesterCode }))
            : (await db.course.findMany({ where: { courseCode: { in: codes } }, select: { courseCode: true } })).map((row) => ({ code: row.courseCode }));
    const known = new Set(found.map((row) => row.code));
    return codes.filter((code) => !known.has(code));
  }

  async saveMappings(
    dto: SaveSyncMappingsDto,
    access: AccessContext,
  ): Promise<SyncMappingSetDto> {
    assertOffice(access);
    const seen = new Set<string>();
    for (const item of dto.items) {
      const key = `${item.kind}|${item.sourceCode}`;
      if (seen.has(key)) throw new AppException(SCHOOL_SYNC_ERRORS.MAPPING_DUPLICATE);
      seen.add(key);
    }
    await this.prisma.$transaction(async (tx) => {
      const current = await this.loadConfiguration(tx);
      await tx.$queryRaw`SELECT "id" FROM "SchoolSyncConfiguration" WHERE "id" = ${current.id} FOR UPDATE`;
      if (current.revision !== dto.revision) {
        throw new AppException(SCHOOL_SYNC_ERRORS.STALE_CONFIGURATION);
      }
      if (await this.activeRunId(tx)) {
        throw new AppException(SCHOOL_SYNC_ERRORS.RUN_IN_PROGRESS);
      }
      for (const kind of ['COHORT', 'PROGRAM', 'SEMESTER', 'COURSE'] as const) {
        const codes = [...new Set(dto.items.filter((item) => item.kind === kind).map((item) => item.targetCode))];
        const unknown = await this.unknownTargets(tx, kind, codes);
        if (unknown.length > 0) {
          throw new AppException(SCHOOL_SYNC_ERRORS.MAPPING_TARGET_UNKNOWN, [
            { field: `items.${kind}`, constraints: unknown.slice(0, 10) },
          ]);
        }
      }
      await tx.schoolReferenceMapping.deleteMany({ where: { configurationId: current.id } });
      await tx.schoolReferenceMapping.createMany({
        data: dto.items.map((item) => ({
          configurationId: current.id,
          kind: item.kind,
          sourceCode: item.sourceCode,
          targetCode: item.targetCode,
        })),
      });
      await tx.schoolSyncConfiguration.update({
        where: { id: current.id },
        data: { revision: current.revision + 1 },
      });
    });
    return this.getMappings(access);
  }

  async referenceOptions(
    query: SyncReferenceQueryDto,
    access: AccessContext,
  ): Promise<Page<SyncReferenceOptionDto>> {
    assertOffice(access);
    const q = query.q?.trim();
    const { skip, take } = toSkipTake(query);
    const contains = (field: string) =>
      q ? { [field]: { contains: q, mode: 'insensitive' as const } } : {};
    if (query.kind === 'COHORT') {
      const where = contains('cohortCode');
      const [rows, total] = await Promise.all([
        this.prisma.cohort.findMany({ where, orderBy: { cohortCode: 'asc' }, skip, take }),
        this.prisma.cohort.count({ where }),
      ]);
      return toPage(rows.map((row) => ({ id: row.id, code: row.cohortCode, label: row.cohortCode, startDate: null })), total, query);
    }
    if (query.kind === 'PROGRAM') {
      const where = contains('programCode');
      const [rows, total] = await Promise.all([
        this.prisma.program.findMany({ where, orderBy: { programCode: 'asc' }, skip, take }),
        this.prisma.program.count({ where }),
      ]);
      return toPage(rows.map((row) => ({ id: row.id, code: row.programCode, label: row.programCode, startDate: null })), total, query);
    }
    if (query.kind === 'SEMESTER') {
      const where = contains('semesterCode');
      const [rows, total] = await Promise.all([
        this.prisma.semester.findMany({ where, orderBy: { semesterCode: 'desc' }, skip, take }),
        this.prisma.semester.count({ where }),
      ]);
      return toPage(
        rows.map((row) => ({
          id: row.id,
          code: row.semesterCode,
          label: row.semesterCode,
          startDate: row.startDate ? toIsoDay(row.startDate) : null,
        })),
        total,
        query,
      );
    }
    const where: Prisma.CourseWhereInput = q
      ? {
          OR: [
            { courseCode: { contains: q, mode: 'insensitive' } },
            { courseName: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {};
    const [rows, total] = await Promise.all([
      this.prisma.course.findMany({ where, orderBy: { courseCode: 'asc' }, skip, take }),
      this.prisma.course.count({ where }),
    ]);
    return toPage(
      rows.map((row) => ({ id: row.id, code: row.courseCode, label: `${row.courseCode} · ${row.courseName}`, startDate: null })),
      total,
      query,
    );
  }

  private async toRunDto(run: SyncLog): Promise<SyncRunDto> {
    const [config, running] = await Promise.all([
      this.loadConfiguration(),
      this.activeRunId(),
    ]);
    return this.runDto(run, run.status === 'FAILED' && isRunnable(config) && !running);
  }

  private runDto(run: SyncLog, canRetry: boolean): SyncRunDto {
    return {
      id: run.id,
      dataSource: 'SCHOOL_DB',
      profile: run.profile,
      trigger: run.trigger,
      retryOfId: run.retryOfId,
      status: run.status,
      startedAt: run.startedAt.toISOString(),
      finishedAt: run.finishedAt?.toISOString() ?? null,
      expiresAt: run.expiresAt.toISOString(),
      configurationRevision: run.configurationRevision,
      snapshotVersion: run.snapshotVersion,
      recordCount: run.recordCount,
      studentCount: run.studentCount,
      resultCount: run.resultCount,
      classCount: run.classCount,
      changedCount: run.changedCount,
      conflictCount: run.conflictCount,
      errorCode: run.errorCode,
      errorMessage: run.errorMessage,
      canRetry,
    };
  }

  async startRun(dto: StartSyncRunDto, access: AccessContext): Promise<SyncRunDto> {
    assertOffice(access);
    const run = await this.runner.reserve({
      trigger: 'MANUAL',
      requestKey: `manual:${dto.requestId}`,
      requestedById: access.userId,
      retryOfId: null,
    });
    return this.toRunDto(run);
  }

  // A retry is a new run linked to the failure; the failed log itself never changes (D12).
  async retryRun(runId: string, dto: StartSyncRunDto, access: AccessContext): Promise<SyncRunDto> {
    assertOffice(access);
    const failed = await this.prisma.syncLog.findUnique({ where: { id: runId } });
    if (!failed) throw new AppException(SCHOOL_SYNC_ERRORS.RUN_NOT_FOUND);
    if (failed.status !== 'FAILED') throw new AppException(SCHOOL_SYNC_ERRORS.RETRY_NOT_ALLOWED);
    const run = await this.runner.reserve({
      trigger: 'RETRY',
      requestKey: `retry:${dto.requestId}`,
      requestedById: access.userId,
      retryOfId: failed.id,
    });
    return this.toRunDto(run);
  }

  async listRuns(query: SyncRunQueryDto, access: AccessContext): Promise<Page<SyncRunDto>> {
    assertOffice(access);
    const where: Prisma.SyncLogWhereInput = {
      ...(query.status && { status: query.status }),
      ...((query.startedFrom || query.startedTo) && {
        startedAt: {
          ...(query.startedFrom && { gte: new Date(query.startedFrom) }),
          ...(query.startedTo && { lt: new Date(query.startedTo) }),
        },
      }),
    };
    const [rows, total, config, running] = await Promise.all([
      this.prisma.syncLog.findMany({
        where,
        orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
        ...toSkipTake(query),
      }),
      this.prisma.syncLog.count({ where }),
      this.loadConfiguration(),
      this.activeRunId(),
    ]);
    const retryable = isRunnable(config) && !running;
    return toPage(
      rows.map((run) => this.runDto(run, retryable && run.status === 'FAILED')),
      total,
      query,
    );
  }

  async getRun(runId: string, access: AccessContext): Promise<SyncRunDto> {
    assertOffice(access);
    const run = await this.prisma.syncLog.findUnique({ where: { id: runId } });
    if (!run) throw new AppException(SCHOOL_SYNC_ERRORS.RUN_NOT_FOUND);
    return this.toRunDto(run);
  }

  async listConflicts(
    runId: string,
    query: PageQueryDto,
    access: AccessContext,
  ): Promise<Page<SyncConflictDto>> {
    assertOffice(access);
    const run = await this.prisma.syncLog.findUnique({ where: { id: runId }, select: { id: true } });
    if (!run) throw new AppException(SCHOOL_SYNC_ERRORS.RUN_NOT_FOUND);
    const where = { syncLogId: runId };
    const [rows, total] = await Promise.all([
      this.prisma.syncConflict.findMany({
        where,
        orderBy: [{ entityType: 'asc' }, { recordKey: 'asc' }],
        ...toSkipTake(query),
      }),
      this.prisma.syncConflict.count({ where }),
    ]);
    return toPage(rows.map(toConflictDto), total, query);
  }
}

type ConflictValues = SyncConflictDto['before'];

function toConflictDto(row: SyncConflict): SyncConflictDto {
  return {
    id: row.id,
    entityType: row.entityType,
    recordKey: row.recordKey,
    previousSource: 'EXCEL',
    selectedSource: 'SCHOOL_DB',
    fields: row.fields,
    before: row.before as unknown as ConflictValues,
    after: row.after as unknown as ConflictValues,
  };
}
