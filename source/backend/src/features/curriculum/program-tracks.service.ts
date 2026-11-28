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
  BulkAssignTrackMode,
  TRACK_INCLUDE,
  toProgramTrackDto,
  type BulkAssignTrackItemsDto,
  type BulkAssignTrackResultDto,
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

  async bulkAssign(
    versionId: string,
    dto: BulkAssignTrackItemsDto,
    access: AccessContext,
  ): Promise<BulkAssignTrackResultDto> {
    const version = await this.reader.findVersion(versionId);
    await assertCurriculumWrite(
      this.prisma,
      access,
      version,
      programTarget(version.program),
    );
    const itemIds = [...new Set(dto.itemIds)];
    const trackIds = [...new Set(dto.trackIds)];

    const result = await this.prisma.$transaction(async (tx) => {
      if (trackIds.length > 0) {
        const found = await tx.programTrack.findMany({
          where: { id: { in: trackIds }, versionId },
          select: { id: true },
        });
        if (found.length !== trackIds.length) {
          throw new AppException(TRACK_ERRORS.TRACK_NOT_FOUND);
        }
      }

      const sources = await tx.curriculumItem.findMany({
        where: { id: { in: itemIds }, versionId },
        include: {
          requisites: true,
          ploMappings: { include: { cloLinks: true } },
        },
      });
      const existing = await tx.curriculumItem.findMany({
        where: { versionId },
        select: {
          id: true,
          trackId: true,
          courseId: true,
          plannedSemester: true,
          sortOrder: true,
        },
      });

      const pairKey = (trackId: string | null, courseId: string): string =>
        `${trackId ?? ''}|${courseId}`;
      const taken = new Set(existing.map((e) => pairKey(e.trackId, e.courseId)));
      const maxSort = new Map<number, number>();
      for (const e of existing) {
        maxSort.set(
          e.plannedSemester,
          Math.max(maxSort.get(e.plannedSemester) ?? 0, e.sortOrder),
        );
      }

      const targets: (string | null)[] = trackIds.length > 0 ? trackIds : [null];
      const counts = { updated: 0, created: 0, skipped: 0 };

      const clone = async (
        source: (typeof sources)[number],
        targetTrackId: string | null,
      ): Promise<void> => {
        const key = pairKey(targetTrackId, source.courseId);
        if (taken.has(key)) {
          counts.skipped += 1;
          return;
        }
        const sortOrder = (maxSort.get(source.plannedSemester) ?? 0) + 1;
        maxSort.set(source.plannedSemester, sortOrder);
        const created = await tx.curriculumItem.create({
          data: {
            versionId,
            trackId: targetTrackId,
            plannedSemester: source.plannedSemester,
            sortOrder,
            courseId: source.courseId,
            blockSymbol: source.blockSymbol,
            isElective: dto.isElective ?? source.isElective,
            electiveGroupId: null,
            htDa: source.htDa,
            tqDa: source.tqDa,
            note: source.note,
          },
          select: { id: true },
        });
        if (source.requisites.length > 0) {
          await tx.curriculumRequisite.createMany({
            data: source.requisites.map((r) => ({
              itemId: created.id,
              sourceCourseId: r.sourceCourseId,
              relationType: r.relationType,
              minScore: r.minScore,
            })),
          });
        }
        if (source.ploMappings.length > 0) {
          await tx.coursePLOMapping.createMany({
            data: source.ploMappings.map((m) => ({
              curriculumItemId: created.id,
              ploId: m.ploId,
              weight: m.weight,
            })),
          });
          const cloRows = source.ploMappings.flatMap((m) =>
            m.cloLinks.map((l) => ({
              curriculumItemId: created.id,
              ploId: l.ploId,
              cloId: l.cloId,
            })),
          );
          if (cloRows.length > 0) {
            await tx.cLOPLOMapping.createMany({ data: cloRows });
          }
        }
        taken.add(key);
        counts.created += 1;
      };

      for (const source of sources) {
        let cloneTargets = targets;
        if (dto.mode === BulkAssignTrackMode.MOVE) {
          const first = targets[0] ?? null;
          cloneTargets = targets.slice(1);
          if (source.trackId === first) {
            if (
              dto.isElective !== undefined &&
              dto.isElective !== source.isElective
            ) {
              await tx.curriculumItem.update({
                where: { id: source.id },
                data: {
                  isElective: dto.isElective,
                  ...(!dto.isElective && { electiveGroupId: null }),
                },
              });
              counts.updated += 1;
            } else {
              counts.skipped += 1;
            }
          } else if (taken.has(pairKey(first, source.courseId))) {
            counts.skipped += 1;
          } else {
            await tx.curriculumItem.update({
              where: { id: source.id },
              data: {
                trackId: first,
                electiveGroupId: null,
                ...(dto.isElective !== undefined && {
                  isElective: dto.isElective,
                }),
              },
            });
            taken.delete(pairKey(source.trackId, source.courseId));
            taken.add(pairKey(first, source.courseId));
            counts.updated += 1;
          }
        }
        for (const targetTrackId of cloneTargets) {
          await clone(source, targetTrackId);
        }
      }
      return counts;
    });
    this.logger.log(
      `Bulk-assign in version ${versionId}: ${JSON.stringify(result)} by ${access.userId}`,
    );
    return result;
  }}
