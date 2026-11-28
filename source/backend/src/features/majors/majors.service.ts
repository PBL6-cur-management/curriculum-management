import { Injectable, Logger } from '@nestjs/common';
import {
  MajorStatus,
  OrgUnitStatus,
  OrgUnitType,
  type Prisma,
} from '../../generated/prisma/client.js';
import type { AccessContext } from '../../shared/authz/access-context.js';
import { assertSchoolWideDirect } from '../../shared/authz/edit-path.js';
import { PERMISSIONS } from '../../shared/authz/permission-codes.js';
import { AppException } from '../../shared/exception/app.exception.js';
import { toPage, toSkipTake, type Page } from '../../shared/pagination/page.js';
import { PrismaService } from '../../shared/prisma/prisma.service.js';
import { mapUniqueViolation } from '../../shared/prisma/unique-violation.js';
import {
  MAJOR_INCLUDE,
  toMajorDto,
  type CreateMajorDto,
  type MajorDto,
  type MajorQueryDto,
  type UpdateMajorDto,
} from './majors.dto.js';
import { MAJOR_ERRORS } from './majors.errors.js';

@Injectable()
export class MajorsService {
  private readonly logger = new Logger(MajorsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async list(query: MajorQueryDto): Promise<Page<MajorDto>> {
    const where: Prisma.MajorWhereInput = {
      ...(query.status && { status: query.status }),
      ...(query.facultyId && { facultyId: query.facultyId }),
      ...(query.degreeGroup && { degreeGroup: query.degreeGroup }),
      ...(query.q && {
        OR: [
          { majorCode: { contains: query.q, mode: 'insensitive' } },
          { majorName: { contains: query.q, mode: 'insensitive' } },
          { englishName: { contains: query.q, mode: 'insensitive' } },
        ],
      }),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.major.findMany({
        where,
        include: MAJOR_INCLUDE,
        orderBy: { majorCode: 'asc' },
        ...toSkipTake(query),
      }),
      this.prisma.major.count({ where }),
    ]);
    return toPage(rows.map(toMajorDto), total, query);
  }

  async detail(majorId: string): Promise<MajorDto> {
    const row = await this.prisma.major.findUnique({
      where: { id: majorId },
      include: MAJOR_INCLUDE,
    });
    if (!row) throw new AppException(MAJOR_ERRORS.MAJOR_NOT_FOUND);
    return toMajorDto(row);
  }

  async create(dto: CreateMajorDto, access: AccessContext): Promise<MajorDto> {
    assertSchoolWideDirect(access, PERMISSIONS.PROGRAM_EDIT_INFO);
    const facultyId = dto.facultyId
      ? await this.validateFaculty(dto.facultyId)
      : null;
    try {
      const created = await this.prisma.major.create({
        data: {
          majorCode: dto.majorCode,
          majorName: dto.majorName,
          englishName: dto.englishName ?? null,
          degreeGroup: dto.degreeGroup ?? null,
          facultyId,
        },
        include: MAJOR_INCLUDE,
      });
      this.logger.log(`Major ${created.majorCode} created by ${access.userId}`);
      return toMajorDto(created);
    } catch (error) {
      throw mapUniqueViolation(
        error,
        MAJOR_ERRORS.MAJOR_CODE_TAKEN,
        'majorCode',
      );
    }
  }

  async update(
    majorId: string,
    dto: UpdateMajorDto,
    access: AccessContext,
  ): Promise<MajorDto> {
    assertSchoolWideDirect(access, PERMISSIONS.PROGRAM_EDIT_INFO);
    const existing = await this.prisma.major.findUnique({
      where: { id: majorId },
      select: { id: true, majorCode: true },
    });
    if (!existing) throw new AppException(MAJOR_ERRORS.MAJOR_NOT_FOUND);
    const facultyId =
      dto.facultyId === undefined
        ? undefined
        : dto.facultyId === null
          ? null
          : await this.validateFaculty(dto.facultyId);
    const updated = await this.prisma.major.update({
      where: { id: majorId },
      data: {
        ...(dto.majorName !== undefined && { majorName: dto.majorName }),
        ...(dto.englishName !== undefined && { englishName: dto.englishName }),
        ...(dto.degreeGroup !== undefined && { degreeGroup: dto.degreeGroup }),
        ...(facultyId !== undefined && { facultyId }),
      },
      include: MAJOR_INCLUDE,
    });
    this.logger.log(`Major ${existing.majorCode} updated by ${access.userId}`);
    return toMajorDto(updated);
  }

  async setStatus(
    majorId: string,
    status: MajorStatus,
    access: AccessContext,
  ): Promise<MajorDto> {
    assertSchoolWideDirect(access, PERMISSIONS.PROGRAM_EDIT_INFO);
    const existing = await this.prisma.major.findUnique({
      where: { id: majorId },
      select: { id: true, majorCode: true, status: true },
    });
    if (!existing) throw new AppException(MAJOR_ERRORS.MAJOR_NOT_FOUND);
    if (existing.status === status) {
      throw new AppException(MAJOR_ERRORS.STATUS_UNCHANGED);
    }
    const updated = await this.prisma.major.update({
      where: { id: majorId },
      data: { status },
      include: MAJOR_INCLUDE,
    });
    this.logger.log(
      `Major ${existing.majorCode} set ${status} by ${access.userId}`,
    );
    return toMajorDto(updated);
  }

  private async validateFaculty(facultyId: string): Promise<string> {
    const unit = await this.prisma.orgUnit.findUnique({
      where: { id: facultyId },
      select: { id: true, unitType: true, status: true },
    });
    if (
      !unit ||
      unit.unitType !== OrgUnitType.FACULTY ||
      unit.status !== OrgUnitStatus.ACTIVE
    ) {
      throw new AppException(MAJOR_ERRORS.FACULTY_INVALID);
    }
    return unit.id;
  }
}
