import { Injectable } from '@nestjs/common';
import {
  IntegrationClientStatus,
  Prisma,
} from '../../generated/prisma/client.js';
import type { AccessContext } from '../../shared/authz/access-context.js';
import { AppException } from '../../shared/exception/app.exception.js';
import { generateIntegrationKey } from '../../shared/integration-access/integration-key.js';
import { INTEGRATION_ERRORS } from '../../shared/integration-access/integration.errors.js';
import { PrismaService } from '../../shared/prisma/prisma.service.js';
import { mapUniqueViolation } from '../../shared/prisma/unique-violation.js';
import type {
  CreateIntegrationClientDto,
  IntegrationClientDto,
  IntegrationClientPageDto,
  IntegrationClientQueryDto,
  IssuedIntegrationClientDto,
  UpdateIntegrationClientDto,
} from './dto/integration-client.dto.js';

const CLIENT_SELECT = {
  id: true,
  clientName: true,
  status: true,
  rateLimit: true,
  createdAt: true,
  createdBy: { select: { fullName: true } },
} satisfies Prisma.IntegrationClientSelect;
type ClientRow = Prisma.IntegrationClientGetPayload<{
  select: typeof CLIENT_SELECT;
}>;

const nameTaken = (error: unknown) =>
  mapUniqueViolation(error, INTEGRATION_ERRORS.CLIENT_NAME_TAKEN, 'clientName');

// R1 manages partner access with a session; no route returns, rotates or deletes a stored key.
@Injectable()
export class IntegrationClientsService {
  constructor(private readonly prisma: PrismaService) {}

  private async lastCalls(ids: string[]): Promise<Map<string, Date>> {
    if (!ids.length) return new Map();
    const rows = await this.prisma.integrationCallLog.groupBy({
      by: ['clientId'],
      where: { clientId: { in: ids } },
      _max: { occurredAt: true },
    });
    const last = new Map<string, Date>();
    for (const row of rows)
      if (row.clientId && row._max.occurredAt)
        last.set(row.clientId, row._max.occurredAt);
    return last;
  }

  private toDto(row: ClientRow, lastCalledAt?: Date): IntegrationClientDto {
    return {
      id: row.id,
      clientName: row.clientName,
      status: row.status,
      rateLimit: row.rateLimit,
      createdByName: row.createdBy.fullName,
      createdAt: row.createdAt.toISOString(),
      lastCalledAt: lastCalledAt?.toISOString() ?? null,
    };
  }

  private async one(id: string): Promise<IntegrationClientDto> {
    const row = await this.prisma.integrationClient.findUnique({
      where: { id },
      select: CLIENT_SELECT,
    });
    if (!row) throw new AppException(INTEGRATION_ERRORS.CLIENT_NOT_FOUND);
    return this.toDto(row, (await this.lastCalls([id])).get(id));
  }

  async list(
    query: IntegrationClientQueryDto,
  ): Promise<IntegrationClientPageDto> {
    const where: Prisma.IntegrationClientWhereInput = {
      ...(query.search
        ? { clientName: { contains: query.search, mode: 'insensitive' } }
        : {}),
      ...(query.status ? { status: query.status } : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.integrationClient.findMany({
        where,
        select: CLIENT_SELECT,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.integrationClient.count({ where }),
    ]);
    const last = await this.lastCalls(rows.map((row) => row.id));
    return {
      items: rows.map((row) => this.toDto(row, last.get(row.id))),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async create(
    access: AccessContext,
    body: CreateIntegrationClientDto,
  ): Promise<IssuedIntegrationClientDto> {
    const { key, keyHash } = generateIntegrationKey();
    const row = await this.prisma.integrationClient
      .create({
        data: {
          clientName: body.clientName,
          keyHash,
          ...(body.rateLimit ? { rateLimit: body.rateLimit } : {}),
          createdById: access.userId,
        },
        select: CLIENT_SELECT,
      })
      .catch((error: unknown) => {
        throw nameTaken(error);
      });
    return { client: this.toDto(row), apiKey: key };
  }

  async update(
    id: string,
    body: UpdateIntegrationClientDto,
  ): Promise<IntegrationClientDto> {
    await this.one(id);
    await this.prisma.integrationClient
      .update({
        where: { id },
        data: {
          ...(body.clientName !== undefined
            ? { clientName: body.clientName }
            : {}),
          ...(body.rateLimit !== undefined
            ? { rateLimit: body.rateLimit }
            : {}),
        },
      })
      .catch((error: unknown) => {
        throw nameTaken(error);
      });
    return this.one(id);
  }

  // A lock refuses every later call; a call already admitted before the commit still completes.
  async setStatus(
    id: string,
    status: IntegrationClientStatus,
  ): Promise<IntegrationClientDto> {
    await this.one(id);
    await this.prisma.integrationClient.update({
      where: { id },
      data: { status },
    });
    return this.one(id);
  }
}
