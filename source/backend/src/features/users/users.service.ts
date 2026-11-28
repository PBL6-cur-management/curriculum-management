import { Injectable, Logger } from '@nestjs/common';
import { Prisma, UserStatus } from '../../generated/prisma/client.js';
import { AppException } from '../../shared/exception/app.exception.js';
import { PrismaService } from '../../shared/prisma/prisma.service.js';
import { PasswordService } from '../../shared/password/password.service.js';
import { generateTemporaryPassword } from '../../shared/password/temporary-password.js';
import { toPage, toSkipTake } from '../../shared/pagination/page.js';
import type { Page } from '../../shared/pagination/page.js';
import { todayDate } from '../../shared/time/today.js';
import { CreateUserDto } from './create-user.dto.js';
import {
  CreatedUserDto,
  TemporaryPasswordDto,
  toUserDetailDto,
  toUserSummaryDto,
  USER_DETAIL_SELECT,
  type UserDetailDto,
  type UserRow,
  type UserSummaryDto,
} from './user.dto.js';
import { USER_ERRORS } from './users.errors.js';
import { UpdateUserDto } from './update-user.dto.js';
import { ListUsersQueryDto } from './list-users-query.dto.js';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
  ) {}

  async list(query: ListUsersQueryDto): Promise<Page<UserSummaryDto>> {
    const where: Prisma.UserWhereInput = {
      status: query.status,
      orgUnitId: query.orgUnitId,
      ...(query.q && {
        OR: [
          { username: { contains: query.q, mode: 'insensitive' } },
          { userCode: { contains: query.q, mode: 'insensitive' } },
          { fullName: { contains: query.q, mode: 'insensitive' } },
        ],
      }),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: USER_DETAIL_SELECT,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        ...toSkipTake(query),
      }),
      this.prisma.user.count({ where }),
    ]);
    const today = todayDate();
    return toPage(
      rows.map((row) => toUserSummaryDto(row, today)),
      total,
      query,
    );
  }

  async get(userId: string): Promise<UserDetailDto> {
    return toUserDetailDto(await this.findOrThrow(userId), todayDate());
  }

  async create(dto: CreateUserDto, actorId: string): Promise<CreatedUserDto> {
    await this.assertUnique(dto.username, dto.userCode);
    await this.assertOrgUnit(dto.orgUnitId);
    const temporaryPassword = generateTemporaryPassword();
    try {
      const row = await this.prisma.user.create({
        data: {
          username: dto.username,
          userCode: dto.userCode,
          fullName: dto.fullName,
          email: dto.email,
          orgUnitId: dto.orgUnitId,
          passwordHash: await this.passwords.hash(temporaryPassword),
          mustChangePassword: true,
        },
        select: USER_DETAIL_SELECT,
      });
      this.logger.log(`User ${row.id} (${row.username}) created by ${actorId}`);
      return { user: toUserDetailDto(row, todayDate()), temporaryPassword };
    } catch (error) {
      this.throwUniqueError(error);
      throw error;
    }
  }

  async update(userId: string, dto: UpdateUserDto): Promise<UserDetailDto> {
    await this.findOrThrow(userId);
    if (dto.userCode !== undefined) {
      await this.assertUnique(undefined, dto.userCode, userId);
    }
    if (dto.orgUnitId !== undefined) {
      await this.assertOrgUnit(dto.orgUnitId ?? undefined);
    }
    try {
      const row = await this.prisma.user.update({
        where: { id: userId },
        data: {
          userCode: dto.userCode,
          fullName: dto.fullName,
          email: dto.email,
          orgUnitId: dto.orgUnitId,
        },
        select: USER_DETAIL_SELECT,
      });
      return toUserDetailDto(row, todayDate());
    } catch (error) {
      this.throwUniqueError(error);
      throw error;
    }
  }

  async disable(userId: string, actorId: string): Promise<UserDetailDto> {
    if (userId === actorId) {
      throw new AppException(USER_ERRORS.CANNOT_DISABLE_SELF);
    }
    return this.setStatus(userId, UserStatus.DISABLED, actorId);
  }

  async enable(userId: string, actorId: string): Promise<UserDetailDto> {
    return this.setStatus(userId, UserStatus.ACTIVE, actorId);
  }

  async resetPassword(
    userId: string,
    actorId: string,
  ): Promise<TemporaryPasswordDto> {
    await this.findOrThrow(userId);
    const temporaryPassword = generateTemporaryPassword();
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: await this.passwords.hash(temporaryPassword),
        mustChangePassword: true,
      },
    });
    this.logger.log(`Password of user ${userId} reset by ${actorId}`);
    return { temporaryPassword };
  }

  private async assertUnique(
    username: string | undefined,
    userCode: string | undefined,
    excludeUserId?: string,
  ): Promise<void> {
    const conditions: Prisma.UserWhereInput[] = [];
    if (username !== undefined) {
      conditions.push({ username });
    }
    if (userCode !== undefined) {
      conditions.push({ userCode });
    }
    if (conditions.length === 0) {
      return;
    }
    const clash = await this.prisma.user.findFirst({
      where: {
        OR: conditions,
        ...(excludeUserId && { id: { not: excludeUserId } }),
      },
      select: { username: true, userCode: true },
    });
    if (clash) {
      const field =
        username !== undefined && clash.username === username
          ? 'username'
          : 'userCode';
      this.throwTaken(field);
    }
  }

  private async assertOrgUnit(orgUnitId?: string | null): Promise<void> {
    if (!orgUnitId) {
      return;
    }
    const unit = await this.prisma.orgUnit.findUnique({
      where: { id: orgUnitId },
      select: { id: true },
    });
    if (!unit) {
      throw new AppException(USER_ERRORS.ORG_UNIT_NOT_FOUND);
    }
  }

  private async findOrThrow(userId: string): Promise<UserRow> {
    const row = await this.prisma.user.findUnique({
      where: { id: userId },
      select: USER_DETAIL_SELECT,
    });
    if (!row) {
      throw new AppException(USER_ERRORS.USER_NOT_FOUND);
    }
    return row;
  }

  private async setStatus(
    userId: string,
    status: UserStatus,
    actorId: string,
  ): Promise<UserDetailDto> {
    const current = await this.findOrThrow(userId);
    if (current.status === status) {
      return toUserDetailDto(current, todayDate());
    }
    const row = await this.prisma.user.update({
      where: { id: userId },
      data: { status },
      select: USER_DETAIL_SELECT,
    });
    this.logger.log(`User ${userId} status set to ${status} by ${actorId}`);
    return toUserDetailDto(row, todayDate());
  }

  private throwUniqueError(error: unknown): void {
    if (
      !(error instanceof Prisma.PrismaClientKnownRequestError) ||
      error.code !== 'P2002'
    ) {
      return;
    }
    const target = error.meta?.target;
    const fields = Array.isArray(target) ? target : [target];
    if (fields.some((field) => String(field).includes('username'))) {
      this.throwTaken('username');
    }
    if (fields.some((field) => String(field).includes('userCode'))) {
      this.throwTaken('userCode');
    }
  }

  private throwTaken(field: 'username' | 'userCode'): never {
    const definition =
      field === 'username'
        ? USER_ERRORS.USERNAME_TAKEN
        : USER_ERRORS.USER_CODE_TAKEN;
    throw new AppException(definition, [{ field, constraints: ['unique'] }]);
  }
}
