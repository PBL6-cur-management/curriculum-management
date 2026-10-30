import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import type { AccessContext } from '../../shared/authz/access-context.js';
import { AppException } from '../../shared/exception/app.exception.js';
import { COMMON_ERRORS } from '../../shared/exception/error-codes.js';
import { toPage, toSkipTake } from '../../shared/pagination/page.js';
import { PrismaService } from '../../shared/prisma/prisma.service.js';
import { requireSemesterStart } from '../../shared/releases/semester-start.js';
import { enrollmentCoversWhere } from '../../shared/students/enrollment-period.js';
import {
  staffStudentScope,
  studentReadWhere,
} from '../../shared/students/student-access.js';
import type { EligibilityStudentsQueryDto } from './dto/registration-eligibility-query.dto.js';
import type { EligibilityStudentPageDto } from './dto/registration-eligibility.dto.js';

@Injectable()
export class EligibilityStudentsService {
  constructor(private readonly prisma: PrismaService) {}
  async list(
    programId: string,
    query: EligibilityStudentsQueryDto,
    access: AccessContext,
  ): Promise<EligibilityStudentPageDto> {
    const scope = staffStudentScope(access, 'ELIGIBILITY');
    if (!scope.all && !scope.programIds.has(programId))
      throw new AppException(COMMON_ERRORS.OUT_OF_SCOPE);
    return this.prisma.$transaction(
      async (tx) => {
        const semester = await requireSemesterStart(tx, query.semesterId);
        const program = await tx.program.findUnique({
          where: { id: programId },
          select: { id: true },
        });
        if (!program)
          throw new NotFoundException('Không tìm thấy chương trình.');
        const search = query.q?.trim();
        const where: Prisma.StudentWhereInput = {
          AND: [
            studentReadWhere(access, 'ELIGIBILITY', programId, semester),
            {
              enrollments: {
                some: { programId, ...enrollmentCoversWhere(semester) },
              },
            },
            ...(search
              ? [
                  {
                    OR: [
                      {
                        studentCode: {
                          contains: search,
                          mode: 'insensitive' as const,
                        },
                      },
                      {
                        fullName: {
                          contains: search,
                          mode: 'insensitive' as const,
                        },
                      },
                    ],
                  },
                ]
              : []),
          ],
        };
        const [items, total] = await Promise.all([
          tx.student.findMany({
            where,
            select: { id: true, studentCode: true, fullName: true },
            orderBy: [{ fullName: 'asc' }, { id: 'asc' }],
            ...toSkipTake(query),
          }),
          tx.student.count({ where }),
        ]);
        return toPage(items, total, query);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
}
