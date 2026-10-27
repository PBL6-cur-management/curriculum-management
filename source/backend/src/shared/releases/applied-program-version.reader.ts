import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { AppException } from '../exception/app.exception.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  CohortVersionLookup,
  CohortVersionsLookup,
  CohortVersionResolution,
} from './applied-version.types.js';
import { readCohortResolutions } from './cohort-version-schedule.js';
import { RELEASE_ERRORS } from './release.errors.js';

@Injectable()
export class AppliedProgramVersionReader {
  constructor(private readonly prisma: PrismaService) {}

  async forCohort(
    input: CohortVersionLookup,
    tx?: Prisma.TransactionClient,
  ): Promise<CohortVersionResolution> {
    const resolutions = await this.forCohorts(
      {
        programId: input.programId,
        cohortIds: [input.cohortId],
        semesterId: input.semesterId,
      },
      tx,
    );
    const resolution = resolutions[0];
    if (!resolution) throw new AppException(RELEASE_ERRORS.COHORT_NOT_FOUND);
    return resolution;
  }
  forCohorts(
    input: CohortVersionsLookup,
    tx?: Prisma.TransactionClient,
  ): Promise<CohortVersionResolution[]> {
    if (tx) return readCohortResolutions(tx, input);
    return this.prisma.$transaction(
      (current) => readCohortResolutions(current, input),
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
}
