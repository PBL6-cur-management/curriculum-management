import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '../../generated/prisma/client.js';
import type { AccessContext } from '../authz/access-context.js';
import type { Env } from '../config/env.validation.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AcademicResultsReader } from '../students/academic-results.reader.js';
import { StudentAppliedVersionReader } from '../students/student-applied-version.reader.js';
import type { StudentAppliedVersionLookup } from '../students/student-applied-version.types.js';
import { readEligibilityContext } from './eligibility-context.reader.js';
import { evaluateEligibility } from './eligibility-evaluator.js';
import { ELIGIBILITY_CONTRACT_VERSION } from './eligibility.constants.js';
import type { RegistrationEligibilityAnswer } from './eligibility.types.js';

export interface RegistrationEligibilityQuery {
  evaluate(
    input: StudentAppliedVersionLookup,
    tx?: Prisma.TransactionClient,
  ): Promise<RegistrationEligibilityAnswer>;
}

@Injectable()
export class RegistrationEligibilityReader {
  constructor(
    private readonly prisma: PrismaService,
    private readonly versions: StudentAppliedVersionReader,
    private readonly results: AcademicResultsReader,
    private readonly config: ConfigService<Env, true>,
  ) {}

  forAccess(access: AccessContext): RegistrationEligibilityQuery {
    return {
      evaluate: (
        input: StudentAppliedVersionLookup,
        tx?: Prisma.TransactionClient,
      ): Promise<RegistrationEligibilityAnswer> => {
        const evaluatedAt = new Date().toISOString();
        const read = async (
          current: Prisma.TransactionClient,
        ): Promise<RegistrationEligibilityAnswer> => {
          const resolution = await this.versions
            .forAccess(access, 'ELIGIBILITY')
            .resolveForStudent(input, current);
          const attempts = await this.results
            .forAccess(access, 'ELIGIBILITY')
            .forStudent(input, current);
          const context = await readEligibilityContext(
            current,
            resolution,
            attempts,
          );
          const answer = evaluateEligibility(context, {
            maxDepth: this.config.get('ELIGIBILITY_MAX_DEPTH', { infer: true }),
          });
          return {
            contractVersion: ELIGIBILITY_CONTRACT_VERSION,
            context: resolution,
            evaluatedAt,
            ...answer,
          };
        };
        return tx
          ? read(tx)
          : this.prisma.$transaction(read, {
              isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
            });
      },
    };
  }
}
