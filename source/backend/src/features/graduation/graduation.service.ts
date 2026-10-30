import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import type { AccessContext } from '../../shared/authz/access-context.js';
import { AppException } from '../../shared/exception/app.exception.js';
import { PrismaService } from '../../shared/prisma/prisma.service.js';
import type { PageQueryDto } from '../../shared/pagination/page-query.dto.js';
import { AcademicResultsReader } from '../../shared/students/academic-results.reader.js';
import { StudentAppliedVersionReader } from '../../shared/students/student-applied-version.reader.js';
import { staffStudentScope } from '../../shared/students/student-access.js';
import {
  assertGraduationRead,
  assertGraduationWrite,
} from '../../shared/graduation/graduation-access.js';
import { staffGraduationCapability } from '../../shared/graduation/graduation-capability.js';
import { GraduationEvaluator } from '../../shared/graduation/graduation-evaluator.js';
import { GRADUATION_ERRORS } from '../../shared/graduation/graduation.errors.js';
import {
  GraduationAuditWriter,
  GRADUATION_AUDIT_INCLUDE,
  graduationAuditValue,
  graduationTransaction,
} from '../../shared/graduation/graduation-audit.writer.js';
import type {
  GraduationLookup,
  GraduationOutcome,
} from '../../shared/graduation/graduation.types.js';

@Injectable()
export class GraduationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly versions: StudentAppliedVersionReader,
    private readonly results: AcademicResultsReader,
    private readonly evaluator: GraduationEvaluator,
    private readonly writer: GraduationAuditWriter,
  ) {}

  private capability(access: AccessContext, lookup: GraduationLookup) {
    return staffGraduationCapability(
      access,
      lookup,
      this.versions,
      this.results,
    );
  }

  async live(
    access: AccessContext,
    lookup: GraduationLookup,
  ): Promise<GraduationOutcome> {
    assertGraduationRead(access, {
      programIds: [lookup.programId],
      studentIds: [lookup.studentId],
    });
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const evaluated = await this.evaluator.evaluate(
            this.capability(access, lookup),
            tx,
          );
          return {
            status: 'REVIEWED',
            result: evaluated.result,
            error: null,
          } as const;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
      );
    } catch (error) {
      const definitions = Object.values(GRADUATION_ERRORS);
      if (
        !(error instanceof AppException) ||
        error.getStatus() !== 409 ||
        !definitions.some((definition) => definition.code === error.code)
      )
        throw error;
      return {
        status: 'CANNOT_AUDIT',
        result: null,
        error: { code: error.code, message: error.message, enrollmentId: null },
      };
    }
  }

  async save(
    access: AccessContext,
    lookup: GraduationLookup,
    requestKey: string,
  ) {
    assertGraduationWrite(access, {
      programIds: [lookup.programId],
      studentIds: [lookup.studentId],
    });
    const operationKey = createHash('sha256')
      .update(JSON.stringify(['STAFF', access.userId, requestKey]))
      .digest('hex');
    return graduationTransaction(this.prisma, (tx) =>
      this.writer.append(tx, {
        lookup,
        capability: this.capability(access, lookup),
        trigger: 'STAFF',
        actorId: access.userId,
        operationKey,
      }),
    );
  }

  async history(
    access: AccessContext,
    lookup: GraduationLookup,
    query: PageQueryDto,
  ) {
    staffStudentScope(access, 'GRADUATION');
    assertGraduationRead(access, {
      programIds: [lookup.programId],
      studentIds: [lookup.studentId],
    });
    return this.prisma.$transaction(
      async (tx) => {
        const student = await tx.student.findUnique({
          where: { id: lookup.studentId },
          select: { id: true },
        });
        if (!student) throw new AppException(GRADUATION_ERRORS.ACCESS_REVOKED);
        const where: Prisma.GraduationAuditWhereInput = { context: lookup };
        const [rows, total] = await Promise.all([
          tx.graduationAudit.findMany({
            where,
            include: GRADUATION_AUDIT_INCLUDE,
            orderBy: [{ auditedAt: 'desc' }, { id: 'desc' }],
            skip: (query.page - 1) * query.pageSize,
            take: query.pageSize,
          }),
          tx.graduationAudit.count({ where }),
        ]);
        return {
          items: await Promise.all(
            rows.map((row) => graduationAuditValue(tx, row)),
          ),
          total,
          page: query.page,
          pageSize: query.pageSize,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  async byId(access: AccessContext, auditId: string) {
    staffStudentScope(access, 'GRADUATION');
    return this.prisma.$transaction(
      async (tx) => {
        const row = await tx.graduationAudit.findUnique({
          where: { id: auditId },
          include: GRADUATION_AUDIT_INCLUDE,
        });
        if (!row) throw new AppException(GRADUATION_ERRORS.ACCESS_REVOKED);
        assertGraduationRead(access, {
          programIds: [row.context.programId],
          studentIds: [row.context.studentId],
        });
        return graduationAuditValue(tx, row);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
}
