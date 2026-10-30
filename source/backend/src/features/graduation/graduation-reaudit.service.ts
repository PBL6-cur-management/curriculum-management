import { Injectable, Logger } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import type {
  GraduationReauditTask,
  Prisma,
} from '../../generated/prisma/client.js';
import { AccessContext } from '../../shared/authz/access-context.js';
import { COMMON_ERRORS } from '../../shared/exception/error-codes.js';
import { AppException } from '../../shared/exception/app.exception.js';
import { assertGraduationWrite } from '../../shared/graduation/graduation-access.js';
import { GRADUATION_ERRORS } from '../../shared/graduation/graduation.errors.js';
import type { GraduationLookup } from '../../shared/graduation/graduation.types.js';
import type { PageQueryDto } from '../../shared/pagination/page-query.dto.js';
import { toPage, toSkipTake } from '../../shared/pagination/page.js';
import { PrismaService } from '../../shared/prisma/prisma.service.js';
import { STUDENT_ROLES } from '../../shared/students/student.constants.js';
import { graduationTransaction } from './graduation-jobs.constants.js';
import { GraduationScheduler } from './graduation.scheduler.js';

export class GraduationReauditTaskDto {
  @ApiProperty() id!: string;
  @ApiProperty() contextId!: string;
  @ApiProperty({
    enum: ['PENDING', 'RUNNING', 'COMPLETED', 'COVERED', 'FAILED'],
  })
  status!: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'COVERED' | 'FAILED';
  @ApiProperty() attempts!: number;
  @ApiProperty({ nullable: true, type: String }) completedAuditId!:
    string | null;
  @ApiProperty({ nullable: true, type: String }) errorCode!: string | null;
}

export class GraduationReauditTaskPageDto {
  @ApiProperty({ type: [GraduationReauditTaskDto] })
  items!: GraduationReauditTaskDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() pageSize!: number;
}

function toTask(row: GraduationReauditTask): GraduationReauditTaskDto {
  return {
    id: row.id,
    contextId: row.contextId,
    status: row.status,
    attempts: row.attempts,
    completedAuditId: row.completedAuditId,
    errorCode: row.errorCode,
  };
}

function officeAccess(access: AccessContext): AccessContext {
  const assignments = access.assignments.filter(
    (assignment) => assignment.roleCode === STUDENT_ROLES.OFFICE,
  );
  if (!assignments.length)
    throw new AppException(COMMON_ERRORS.PERMISSION_DENIED);
  return new AccessContext(access.userId, assignments);
}

@Injectable()
export class GraduationReauditService {
  private readonly logger = new Logger(GraduationReauditService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly scheduler: GraduationScheduler,
  ) {}

  async list(
    access: AccessContext,
    lookup: GraduationLookup,
    query: PageQueryDto,
  ): Promise<GraduationReauditTaskPageDto> {
    assertGraduationWrite(officeAccess(access), {
      programIds: [lookup.programId],
    });
    const where: Prisma.GraduationReauditTaskWhereInput = { context: lookup };
    return graduationTransaction(this.prisma, async (tx) => {
      const [rows, total] = await Promise.all([
        tx.graduationReauditTask.findMany({
          where,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          ...toSkipTake(query),
        }),
        tx.graduationReauditTask.count({ where }),
      ]);
      return toPage(rows.map(toTask), total, query);
    });
  }

  async retry(
    access: AccessContext,
    taskId: string,
  ): Promise<GraduationReauditTaskDto> {
    const office = officeAccess(access);
    const row = await graduationTransaction(this.prisma, async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "GraduationReauditTask" WHERE "id" = ${taskId} FOR UPDATE`;
      const task = await tx.graduationReauditTask.findUnique({
        where: { id: taskId },
        include: { context: true },
      });
      if (!task) throw new AppException(GRADUATION_ERRORS.ACCESS_REVOKED);
      assertGraduationWrite(office, { programIds: [task.context.programId] });
      if (task.status !== 'FAILED') return task;
      return tx.graduationReauditTask.update({
        where: { id: taskId },
        data: {
          status: 'PENDING',
          attempts: 0,
          completedAuditId: null,
          errorCode: null,
          leaseToken: null,
          leaseUntil: null,
          finishedAt: null,
        },
      });
    });
    if (row.status === 'PENDING') {
      try {
        await this.scheduler.enqueueReaudit(row.id);
      } catch {
        this.logger.error(
          `GRADUATION_JOB_FAILED task=${row.id}; tác vụ đã lưu, chờ phục hồi.`,
        );
      }
    }
    return toTask(row);
  }
}
