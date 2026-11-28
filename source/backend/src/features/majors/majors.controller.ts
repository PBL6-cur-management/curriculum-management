import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AccessContext } from '../../shared/authz/access-context.js';
import { CurrentAccess } from '../../shared/authz/current-access.decorator.js';
import { PERMISSIONS } from '../../shared/authz/permission-codes.js';
import { RequirePermission } from '../../shared/authz/require-permission.decorator.js';
import {
  CreateMajorDto,
  MajorDto,
  MajorPageDto,
  MajorQueryDto,
  SetMajorStatusDto,
  UpdateMajorDto,
} from './majors.dto.js';
import { MajorsService } from './majors.service.js';

@ApiTags('Majors')
@Controller('majors')
export class MajorsController {
  constructor(private readonly majors: MajorsService) {}

  @Get()
  @RequirePermission(PERMISSIONS.PROGRAM_VIEW)
  @ApiOperation({ summary: 'Danh mục ngành đào tạo (Level 0)' })
  @ApiOkResponse({ type: MajorPageDto })
  list(@Query() query: MajorQueryDto): Promise<MajorPageDto> {
    return this.majors.list(query);
  }

  @Get(':majorId')
  @RequirePermission(PERMISSIONS.PROGRAM_VIEW)
  @ApiOperation({ summary: 'Chi tiết ngành đào tạo' })
  @ApiOkResponse({ type: MajorDto })
  detail(@Param('majorId') majorId: string): Promise<MajorDto> {
    return this.majors.detail(majorId);
  }

  @Post()
  @RequirePermission(PERMISSIONS.PROGRAM_EDIT_INFO)
  @ApiOperation({ summary: 'Tạo ngành đào tạo mới (Phòng Đào tạo)' })
  @ApiOkResponse({ type: MajorDto })
  create(
    @Body() dto: CreateMajorDto,
    @CurrentAccess() access: AccessContext,
  ): Promise<MajorDto> {
    return this.majors.create(dto, access);
  }

  @Patch(':majorId')
  @RequirePermission(PERMISSIONS.PROGRAM_EDIT_INFO)
  @ApiOperation({ summary: 'Cập nhật ngành đào tạo (Phòng Đào tạo)' })
  @ApiOkResponse({ type: MajorDto })
  update(
    @Param('majorId') majorId: string,
    @Body() dto: UpdateMajorDto,
    @CurrentAccess() access: AccessContext,
  ): Promise<MajorDto> {
    return this.majors.update(majorId, dto, access);
  }

  @Patch(':majorId/status')
  @RequirePermission(PERMISSIONS.PROGRAM_EDIT_INFO)
  @ApiOperation({ summary: 'Đổi trạng thái ngành đào tạo' })
  @ApiOkResponse({ type: MajorDto })
  setStatus(
    @Param('majorId') majorId: string,
    @Body() dto: SetMajorStatusDto,
    @CurrentAccess() access: AccessContext,
  ): Promise<MajorDto> {
    return this.majors.setStatus(majorId, dto.status, access);
  }
}
