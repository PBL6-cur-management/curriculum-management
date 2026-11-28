import { Injectable, Logger } from '@nestjs/common';
import type { AccessContext } from '../../shared/authz/access-context.js';
import { AppException } from '../../shared/exception/app.exception.js';
import { PrismaService } from '../../shared/prisma/prisma.service.js';
import { mapUniqueViolation } from '../../shared/prisma/unique-violation.js';
import { VersionContentCopier } from '../../shared/programs/version-content.copier.js';
import { CloneProgramDto } from './clone-program.dto.js';
import { currentVersion, type ProgramDetailDto } from './program.dto.js';
import { findProgramOrThrow } from './program-reader.js';
import { PROGRAM_ERRORS } from './programs.errors.js';
import { ProgramsService } from './programs.service.js';

@Injectable()
export class ProgramCloneService {
  private readonly logger = new Logger(ProgramCloneService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly copier: VersionContentCopier,
    private readonly programs: ProgramsService,
  ) {}

  // One transaction, so a failed copier step leaves no half-made program.
  async clone(
    programId: string,
    dto: CloneProgramDto,
    access: AccessContext,
  ): Promise<ProgramDetailDto> {
    const source = await findProgramOrThrow(this.prisma, programId);
    const version = dto.sourceVersionId
      ? source.versions.find(
          (candidate) => candidate.id === dto.sourceVersionId,
        )
      : currentVersion(source);
    if (!version) {
      throw new AppException(PROGRAM_ERRORS.SOURCE_VERSION_INVALID);
    }
    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const program = await tx.program.create({
          data: {
            programCode: dto.programCode,
            facultyId: source.facultyId,
            majorId: source.majorId,
            degreeLevel: source.degreeLevel,
            clonedFromId: version.id,
            versions: {
              create: {
                programName: dto.programName,
                majorCode: version.majorCode,
                majorName: version.majorName,
                semesterCount: version.semesterCount,
                totalCredits: version.totalCredits,
                compulsoryCredits: version.compulsoryCredits,
                electiveCredits: version.electiveCredits,
              },
            },
          },
          select: { id: true, versions: { select: { id: true } } },
        });
        await this.copier.copy(tx, version.id, program.versions[0].id, {
          carryRelease: false,
        });
        return program;
      });
      this.logger.log(
        `Program ${source.programCode} cloned to ${dto.programCode} by ${access.userId}`,
      );
      return await this.programs.detailOf(created.id, access);
    } catch (error) {
      throw mapUniqueViolation(
        error,
        PROGRAM_ERRORS.PROGRAM_CODE_TAKEN,
        'programCode',
      );
    }
  }
}
