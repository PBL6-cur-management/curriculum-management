import { Injectable, Logger } from '@nestjs/common';
import { UserStatus } from '../../generated/prisma/client.js';
import {
  AUTHENTICATED_USER_SELECT,
  type AuthenticatedUser,
} from '../../shared/auth/authenticated-user.js';
import { AppException } from '../../shared/exception/app.exception.js';
import { PasswordService } from '../../shared/password/password.service.js';
import { PrismaService } from '../../shared/prisma/prisma.service.js';
import type { AccessContext } from '../../shared/authz/access-context.js';
import { toMeDto, type MeDto } from './me.dto.js';
import { usableGrants } from '../../shared/change-requests/delegation-authority.js';
import { todayDate } from '../../shared/time/today.js';
import { AUTH_ERRORS } from './auth.errors.js';
import type { ChangePasswordDto } from './change-password.dto.js';
import type { LoginDto } from './login.dto.js';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
  ) {}

  async login(
    dto: LoginDto,
    ip: string | undefined,
  ): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({
      where: { username: dto.username },
      select: { ...AUTHENTICATED_USER_SELECT, passwordHash: true },
    });
    const valid = user
      ? await this.passwords.verify(user.passwordHash, dto.password)
      : await this.passwords.verifyAgainstDummy(dto.password);
    if (!user || !valid) {
      // No supplied username or password in the log: a mistyped password often lands in the username field.
      this.logger.warn(`auth.login_failed from ${ip ?? 'unknown'}`);
      throw new AppException(AUTH_ERRORS.INVALID_CREDENTIALS);
    }
    if (user.status !== UserStatus.ACTIVE)
      throw new AppException(AUTH_ERRORS.ACCOUNT_DISABLED);
    const {
      id,
      username,
      userCode,
      fullName,
      email,
      status,
      mustChangePassword,
      orgUnitId,
    } = user;
    return {
      id,
      username,
      userCode,
      fullName,
      email,
      status,
      mustChangePassword,
      orgUnitId,
    };
  }

  async me(user: AuthenticatedUser, access: AccessContext): Promise<MeDto> {
    const orgUnit = user.orgUnitId
      ? await this.prisma.orgUnit.findUnique({
          where: { id: user.orgUnitId },
          select: { id: true, unitCode: true, unitName: true },
        })
      : null;
    const grants = await usableGrants(this.prisma, user.id, todayDate());
    return toMeDto(user, orgUnit, access, grants.length > 0);
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });
    if (
      !user ||
      !(await this.passwords.verify(user.passwordHash, dto.currentPassword))
    ) {
      throw new AppException(AUTH_ERRORS.CURRENT_PASSWORD_WRONG);
    }
    if (dto.currentPassword === dto.newPassword)
      throw new AppException(AUTH_ERRORS.PASSWORD_UNCHANGED);
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: await this.passwords.hash(dto.newPassword),
        mustChangePassword: false,
      },
    });
  }
}
