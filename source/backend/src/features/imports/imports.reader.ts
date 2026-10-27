import { Injectable } from '@nestjs/common';
import type { AccessContext } from '../../shared/authz/access-context.js';
import { AppException } from '../../shared/exception/app.exception.js';
import { toPage, toSkipTake, type Page } from '../../shared/pagination/page.js';
import { PrismaService } from '../../shared/prisma/prisma.service.js';
import type { ImportListQueryDto } from './dto/import.dto.js';
import type { ImportBatchSummaryDto } from './dto/import-response.dto.js';
import { visibleBatches } from './import-access.js';
import { IMPORT_ERRORS } from './import-errors.js';
import {
  BATCH_DETAIL_SELECT,
  BATCH_SUMMARY_SELECT,
  toDetailDto,
  toSummaryDto,
} from './import-mapping.js';

@Injectable()
export class ImportsReader {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    query: ImportListQueryDto,
    access: AccessContext,
  ): Promise<Page<ImportBatchSummaryDto>> {
    const where = {
      AND: [
        visibleBatches(access),
        {
          importType: query.importType,
          status: query.status,
          ...(query.mine ? { performedById: access.userId } : {}),
        },
      ],
    };
    const [rows, total] = await Promise.all([
      this.prisma.importBatch.findMany({
        where,
        select: BATCH_SUMMARY_SELECT,
        orderBy: [{ recordedAt: 'desc' }, { id: 'desc' }],
        ...toSkipTake(query),
      }),
      this.prisma.importBatch.count({ where }),
    ]);
    return toPage(rows.map(toSummaryDto), total, query);
  }

  async visible(batchId: string, access: AccessContext) {
    const row = await this.prisma.importBatch.findFirst({
      where: { AND: [{ id: batchId }, visibleBatches(access)] },
      select: BATCH_DETAIL_SELECT,
    });
    if (!row) throw new AppException(IMPORT_ERRORS.BATCH_NOT_FOUND);
    return row;
  }

  async detail(batchId: string, access: AccessContext) {
    return toDetailDto(await this.visible(batchId, access), access.userId);
  }

  async file(batchId: string, access: AccessContext) {
    const row = await this.visible(batchId, access);
    const file = await this.prisma.importBatchFile.findFirst({
      where: { batchId, expiresAt: { gt: new Date() } },
      select: { content: true },
    });
    if (!file) throw new AppException(IMPORT_ERRORS.FILE_EXPIRED);
    return { content: file.content, fileName: row.fileName };
  }
}
