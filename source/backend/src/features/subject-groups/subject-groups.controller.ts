import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { AuthenticatedUser } from '../../shared/auth/authenticated-user.js';
import { CurrentUser } from '../../shared/auth/current-user.decorator.js';
import type { AccessContext } from '../../shared/authz/access-context.js';
import { CurrentAccess } from '../../shared/authz/current-access.decorator.js';
import { PERMISSIONS } from '../../shared/authz/permission-codes.js';
import { RequirePermission } from '../../shared/authz/require-permission.decorator.js';
import { CreateSubjectGroupDto } from './create-subject-group.dto.js';
import { SubjectGroupQueryDto } from './subject-group-query.dto.js';
import {
  SubjectGroupDeactivationImpactDto,
  SubjectGroupDetailDto,
  SubjectGroupSummaryDto,
} from './subject-group.dto.js';
import { SubjectGroupsService } from './subject-groups.service.js';
import { UpdateSubjectGroupDto } from './update-subject-group.dto.js';
import { AddSubjectGroupMemberDto } from './add-subject-group-member.dto.js';
import { EndSubjectGroupMemberDto } from './end-subject-group-member.dto.js';
import {
  DemoteCoordinatorDto,
  PromoteCoordinatorDto,
} from './promote-coordinator.dto.js';
import { SubjectGroupMemberDto } from './subject-group-member.dto.js';
import { SubjectGroupMembersService } from './subject-group-members.service.js';

@ApiTags('subject-groups')
@ApiCookieAuth()
@Controller('subject-groups')
export class SubjectGroupsController {
  constructor(
    private readonly groups: SubjectGroupsService,
    private readonly members: SubjectGroupMembersService,
  ) {}

  @Get()
  @RequirePermission(PERMISSIONS.SUBJECT_GROUP_VIEW)
  @ApiOkResponse({ type: [SubjectGroupSummaryDto] })
  list(
    @Query() query: SubjectGroupQueryDto,
    @CurrentAccess() access: AccessContext,
  ) {
    return this.groups.list(query, access);
  }

  @Post()
  @RequirePermission(PERMISSIONS.ORG_UNIT_MANAGE)
  @ApiCreatedResponse({ type: SubjectGroupSummaryDto })
  create(
    @Body() dto: CreateSubjectGroupDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.groups.create(dto, actor.id);
  }

  @Get(':groupId')
  @RequirePermission(PERMISSIONS.SUBJECT_GROUP_VIEW)
  @ApiOkResponse({ type: SubjectGroupDetailDto })
  detail(
    @Param('groupId') groupId: string,
    @CurrentAccess() access: AccessContext,
  ) {
    return this.groups.detail(groupId, access);
  }

  @Patch(':groupId')
  @RequirePermission(PERMISSIONS.ORG_UNIT_MANAGE)
  @ApiOkResponse({ type: SubjectGroupSummaryDto })
  update(
    @Param('groupId') groupId: string,
    @Body() dto: UpdateSubjectGroupDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.groups.update(groupId, dto, actor.id);
  }

  @Get(':groupId/deactivation-impact')
  @RequirePermission(PERMISSIONS.ORG_UNIT_MANAGE)
  @ApiOkResponse({ type: SubjectGroupDeactivationImpactDto })
  impact(@Param('groupId') groupId: string) {
    return this.groups.deactivationImpact(groupId);
  }

  @Post(':groupId/deactivate')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(PERMISSIONS.ORG_UNIT_MANAGE)
  @ApiOkResponse({ type: SubjectGroupSummaryDto })
  deactivate(
    @Param('groupId') groupId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.groups.deactivate(groupId, actor.id);
  }

  @Post(':groupId/activate')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(PERMISSIONS.ORG_UNIT_MANAGE)
  @ApiOkResponse({ type: SubjectGroupSummaryDto })
  activate(
    @Param('groupId') groupId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.groups.activate(groupId, actor.id);
  }

  @Post(':groupId/members')
  @RequirePermission(PERMISSIONS.ORG_UNIT_MANAGE)
  @ApiCreatedResponse({ type: SubjectGroupMemberDto })
  addMember(
    @Param('groupId') groupId: string,
    @Body() dto: AddSubjectGroupMemberDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.members.add(groupId, dto, actor.id);
  }

  @Post(':groupId/members/:memberId/end')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(PERMISSIONS.ORG_UNIT_MANAGE)
  @ApiOkResponse({ type: [SubjectGroupMemberDto] })
  endMember(
    @Param('groupId') groupId: string,
    @Param('memberId') memberId: string,
    @Body() dto: EndSubjectGroupMemberDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.members.end(groupId, memberId, dto, actor.id);
  }

  @Post(':groupId/members/:memberId/revoke')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(PERMISSIONS.ORG_UNIT_MANAGE)
  @ApiOkResponse({ type: SubjectGroupMemberDto })
  revokeMember(
    @Param('groupId') groupId: string,
    @Param('memberId') memberId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.members.revoke(groupId, memberId, actor.id);
  }

  @Post(':groupId/coordinators/:lecturerId/promote')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(PERMISSIONS.ORG_UNIT_MANAGE)
  @ApiOkResponse({ type: SubjectGroupMemberDto })
  promoteCoordinator(
    @Param('groupId') groupId: string,
    @Param('lecturerId') lecturerId: string,
    @Body() dto: PromoteCoordinatorDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.members.promoteCoordinator(
      groupId,
      lecturerId,
      dto,
      actor.id,
    );
  }

  @Post(':groupId/coordinators/:lecturerId/demote')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(PERMISSIONS.ORG_UNIT_MANAGE)
  @ApiOkResponse({ type: [SubjectGroupMemberDto] })
  demoteCoordinator(
    @Param('groupId') groupId: string,
    @Param('lecturerId') lecturerId: string,
    @Body() dto: DemoteCoordinatorDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.members.demoteCoordinator(
      groupId,
      lecturerId,
      dto,
      actor.id,
    );
  }
}
