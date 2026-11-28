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
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AccessContext } from '../../shared/authz/access-context.js';
import { CurrentAccess } from '../../shared/authz/current-access.decorator.js';
import { PERMISSIONS } from '../../shared/authz/permission-codes.js';
import { RequirePermission } from '../../shared/authz/require-permission.decorator.js';
import {
  CreateProgramTrackDto,
  ProgramTrackDto,
  UpdateProgramTrackDto,
} from './program-track.dto.js';
import { ProgramTracksService } from './program-tracks.service.js';

@ApiTags('Program Tracks')
@Controller()
export class ProgramTracksController {
  constructor(private readonly tracks: ProgramTracksService) {}

  @Get('program-versions/:versionId/tracks')
  @RequirePermission(PERMISSIONS.PROGRAM_VIEW)
  @ApiOperation({ summary: 'Danh sách chuyên ngành / định hướng trong phiên bản CTĐT' })
  @ApiOkResponse({ type: [ProgramTrackDto] })
  list(
    @Param('versionId') versionId: string,
    @CurrentAccess() access: AccessContext,
  ): Promise<ProgramTrackDto[]> {
    return this.tracks.list(versionId, access);
  }

  @Post('program-versions/:versionId/tracks')
  @RequirePermission(PERMISSIONS.CURRICULUM_EDIT)
  @ApiOperation({ summary: 'Thêm chuyên ngành / định hướng con vào phiên bản CTĐT' })
  @ApiOkResponse({ type: ProgramTrackDto })
  create(
    @Param('versionId') versionId: string,
    @Body() dto: CreateProgramTrackDto,
    @CurrentAccess() access: AccessContext,
  ): Promise<ProgramTrackDto> {
    return this.tracks.create(versionId, dto, access);
  }

  @Patch('program-tracks/:trackId')
  @RequirePermission(PERMISSIONS.CURRICULUM_EDIT)
  @ApiOperation({ summary: 'Cập nhật chuyên ngành / định hướng con' })
  @ApiOkResponse({ type: ProgramTrackDto })
  update(
    @Param('trackId') trackId: string,
    @Body() dto: UpdateProgramTrackDto,
    @CurrentAccess() access: AccessContext,
  ): Promise<ProgramTrackDto> {
    return this.tracks.update(trackId, dto, access);
  }

  @Delete('program-tracks/:trackId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission(PERMISSIONS.CURRICULUM_EDIT)
  @ApiOperation({ summary: 'Xóa chuyên ngành / định hướng con' })
  remove(
    @Param('trackId') trackId: string,
    @CurrentAccess() access: AccessContext,
  ): Promise<void> {
    return this.tracks.remove(trackId, access);
  }
}
