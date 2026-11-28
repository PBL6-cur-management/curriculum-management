import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../shared/auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../../shared/auth/authenticated-user.js';
import { RequirePermission } from '../../shared/authz/require-permission.decorator.js';
import { PERMISSIONS } from '../../shared/authz/permission-codes.js';
import { CreateRoleDto } from './create-role.dto.js';
import {
  MatrixCellDto,
  PermissionMatrixDto,
  RoleDto,
} from './permission-matrix.dto.js';
import { PermissionsService } from './permissions.service.js';
import { SetRolePermissionDto } from './set-role-permission.dto.js';
import { UpdateRoleDto } from './update-role.dto.js';

@ApiTags('permissions')
@ApiCookieAuth()
@Controller()
export class PermissionsController {
  constructor(private readonly permissions: PermissionsService) {}

  @Get('roles')
  @RequirePermission(PERMISSIONS.USER_MANAGE, PERMISSIONS.PERMISSION_VIEW)
  @ApiOkResponse({ type: [RoleDto] })
  roles(): Promise<RoleDto[]> {
    return this.permissions.listRoles();
  }

  @Post('roles')
  @RequirePermission(PERMISSIONS.PERMISSION_MANAGE)
  @ApiCreatedResponse({ type: RoleDto })
  createRole(
    @Body() dto: CreateRoleDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<RoleDto> {
    return this.permissions.createRole(dto, actor.id);
  }

  @Patch('roles/:roleCode')
  @RequirePermission(PERMISSIONS.PERMISSION_MANAGE)
  @ApiOkResponse({ type: RoleDto })
  updateRole(
    @Param('roleCode') roleCode: string,
    @Body() dto: UpdateRoleDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<RoleDto> {
    return this.permissions.updateRole(roleCode, dto, actor.id);
  }

  @Delete('roles/:roleCode')
  @RequirePermission(PERMISSIONS.PERMISSION_MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  deleteRole(
    @Param('roleCode') roleCode: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<void> {
    return this.permissions.deleteRole(roleCode, actor.id);
  }

  @Get('permissions/matrix')
  @RequirePermission(PERMISSIONS.PERMISSION_VIEW)
  @ApiOkResponse({ type: PermissionMatrixDto })
  matrix(): Promise<PermissionMatrixDto> {
    return this.permissions.matrix();
  }

  @Put('roles/:roleCode/permissions/:permissionCode')
  @RequirePermission(PERMISSIONS.PERMISSION_MANAGE)
  @ApiOkResponse({ type: MatrixCellDto })
  setCell(
    @Param('roleCode') roleCode: string,
    @Param('permissionCode') permissionCode: string,
    @Body() dto: SetRolePermissionDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<MatrixCellDto> {
    return this.permissions.setCell(roleCode, permissionCode, dto, actor.id);
  }

  @Delete('roles/:roleCode/permissions/:permissionCode')
  @RequirePermission(PERMISSIONS.PERMISSION_MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  clearCell(
    @Param('roleCode') roleCode: string,
    @Param('permissionCode') permissionCode: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<void> {
    return this.permissions.clearCell(roleCode, permissionCode, actor.id);
  }
}
