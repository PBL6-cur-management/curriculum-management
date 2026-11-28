import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import type { AccessContext } from '../../shared/authz/access-context.js';
import { PERMISSIONS } from '../../shared/authz/permission-codes.js';
import { AppException } from '../../shared/exception/app.exception.js';
import { PrismaService } from '../../shared/prisma/prisma.service.js';
import { mapUniqueViolation } from '../../shared/prisma/unique-violation.js';
import { programTarget } from '../../shared/programs/program-target.js';
import { assertCurriculumWrite, VERSION_SELECT } from './curriculum-access.js';
import { CurriculumReadService } from './curriculum-read.service.js';
import {
  TRACK_INCLUDE,
  toProgramTrackDto,
  type CreateProgramTrackDto,
  type ProgramTrackDto,
  type UpdateProgramTrackDto,
} from './program-track.dto.js';

export const TRACK_ERRORS = {
  TRACK_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    code: 'TRACK_NOT_FOUND',
    message: 'Không tìm thấy chuyên ngành / định hướng trong phiên bản này.',
  },
  TRACK_CODE_TAKEN: {
    status: HttpStatus.CONFLICT,
    code: 'TRACK_CODE_TAKEN',
    message: 'Mã định hướng đã tồn tại trong phiên bản CTĐT này.',
  },
  TRACK_IN_USE_BY_STUDENTS: {
    status: HttpStatus.CONFLICT,
    code: 'TRACK_IN_USE_BY_STUDENTS',
    message: 'Không thể xóa định hướng đang có sinh viên theo học.',
  },
} as const;

@Injectable()
export class ProgramTracksService {
  private readonly logger = new Logger(ProgramTracksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly reader: CurriculumReadService,
  ) {}

  async list(
    versionId: string,
    access: AccessContext,
  ): Promise<ProgramTrackDto[]> {
    const version = await this.reader.findVersion(versionId);
    access.assertCan(PERMISSIONS.PROGRAM_VIEW, programTarget(version.program));
    const rows = await this.prisma.programTrack.findMany({
      where: { versionId },
      include: TRACK_INCLUDE,
      orderBy: [{ sortOrder: 'asc' }, { trackCode: 'asc' }],
    });
    return rows.map(toProgramTrackDto);
  }

  async create(
    versionId: string,
    dto: CreateProgramTrackDto,
    access: AccessContext,
  ): Promise<ProgramTrackDto> {
    const version = await this.reader.findVersion(versionId);
    await assertCurriculumWrite(
      this.prisma,
      access,
      version,
      programTarget(version.program),
    );
    const created = await this.prisma.programTrack
      .create({
        data: {
          versionId,
          trackCode: dto.trackCode,
          trackName: dto.trackName,
          englishName: dto.englishName ?? null,
          description: dto.description ?? null,
          sortOrder: dto.sortOrder ?? 0,
          compulsoryCredits: dto.compulsoryCredits ?? null,
          electiveCredits: dto.electiveCredits ?? null,
        },
        include: TRACK_INCLUDE,
      })
      .catch((error: unknown) => {
        throw mapUniqueViolation(
          error,
          TRACK_ERRORS.TRACK_CODE_TAKEN,
          'trackCode',
        );
      });
    this.logger.log(
      `Track ${dto.trackCode} created in version ${versionId} by ${access.userId}`,
    );
    return toProgramTrackDto(created);
  }

  async update(
    trackId: string,
    dto: UpdateProgramTrackDto,
    access: AccessContext,
  ): Promise<ProgramTrackDto> {
    const existing = await this.prisma.programTrack.findUnique({
      where: { id: trackId },
      include: { version: { select: VERSION_SELECT } },
    });
    if (!existing) throw new AppException(TRACK_ERRORS.TRACK_NOT_FOUND);
    await assertCurriculumWrite(
      this.prisma,
      access,
      existing.version,
      programTarget(existing.version.program),
    );
    const updated = await this.prisma.programTrack
      .update({
        where: { id: trackId },
        data: {
          ...(dto.trackCode !== undefined && { trackCode: dto.trackCode }),
          ...(dto.trackName !== undefined && { trackName: dto.trackName }),
          ...(dto.englishName !== undefined && { englishName: dto.englishName }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
          ...(dto.compulsoryCredits !== undefined && {
            compulsoryCredits: dto.compulsoryCredits,
          }),
          ...(dto.electiveCredits !== undefined && {
            electiveCredits: dto.electiveCredits,
          }),
        },
        include: TRACK_INCLUDE,
      })
      .catch((error: unknown) => {
        throw mapUniqueViolation(
          error,
          TRACK_ERRORS.TRACK_CODE_TAKEN,
          'trackCode',
        );
      });
    this.logger.log(`Track ${trackId} updated by ${access.userId}`);
    return toProgramTrackDto(updated);
  }

  async remove(trackId: string, access: AccessContext): Promise<void> {
    const existing = await this.prisma.programTrack.findUnique({
      where: { id: trackId },
      include: {
        version: { select: VERSION_SELECT },
        _count: { select: { enrollments: true } },
      },
    });
    if (!existing) throw new AppException(TRACK_ERRORS.TRACK_NOT_FOUND);
    await assertCurriculumWrite(
      this.prisma,
      access,
      existing.version,
      programTarget(existing.version.program),
    );
    if (existing._count.enrollments > 0) {
      throw new AppException(TRACK_ERRORS.TRACK_IN_USE_BY_STUDENTS);
    }
    await this.prisma.programTrack.delete({ where: { id: trackId } });
    this.logger.log(
      `Track ${existing.trackCode} removed from version ${existing.versionId} by ${access.userId}`,
    );
  }
}
