import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  Logger,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { TeamMemberService } from './team-member.service';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiNotFoundResponse,
  ApiForbiddenResponse,
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import {
  CurrentUser,
  UserWithCompany,
} from '../auth/decorators/current-user.decorator';
import {
  UpdateTeamMemberDto,
  TeamMemberResponseDto,
  TeamMemberWithRelationsResponseDto,
  TeamMemberStatsResponseDto,
  TeamMemberSearchQueryDto,
  InviteTeamMemberDto,
  BulkInviteTeamMembersDto,
  UpdateTeamMemberRoleDto,
  AcceptInvitationDto,
  AcceptInvitationByTokenDto,
} from './team-member.dto';
import { CompanyAuth } from '../auth/decorators/company-auth.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { Auth } from '../auth/decorators/auth.decorator';
import { AdminOnly } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UseGuards } from '@nestjs/common';
import {
  TeamMemberRoleEnum,
  TeamMemberStatusEnum,
} from '../../database/generated/client';
import { JwtPayload } from '../../common/interfaces/jwt-payload';

@ApiTags('KYB - Team Management')
@ApiBearerAuth()
@Controller('kyb')
@CompanyAuth()
export class TeamMemberController {
  private readonly logger = new Logger(TeamMemberController.name);

  constructor(private readonly teamMemberService: TeamMemberService) {}

  // *************************************************
  // ************** TEAM MEMBER CRUD ****************
  // *************************************************

  @Post('companies/:companyId/team-members/invite')
  @UseGuards(RolesGuard)
  @AdminOnly()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Invite team member',
    description: 'Invite a new team member to the company (Owner/Admin only)',
  })
  @ApiResponse({
    status: 201,
    description: 'Team member invited successfully',
    type: TeamMemberResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid data or email already invited',
  })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  async inviteTeamMember(
    @Param('companyId', ParseIntPipe) companyId: number,
    @CurrentUser('withCompany') user: UserWithCompany,
    @Body() inviteDto: InviteTeamMemberDto,
  ): Promise<TeamMemberResponseDto> {
    try {
      const teamMember = await this.teamMemberService.inviteTeamMember(
        user.internalUserId,
        companyId,
        inviteDto,
      );
      return teamMember as TeamMemberResponseDto;
    } catch (error) {
      this.logger.error(
        `Invite team member to company ${companyId} failed for user ${user.sub}:`,
        error,
      );
      throw error;
    }
  }

  @Post('companies/:companyId/team-members/bulk-invite')
  @UseGuards(RolesGuard)
  @AdminOnly()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Bulk invite team members',
    description: 'Invite multiple team members at once (Owner/Admin only)',
  })
  @ApiResponse({
    status: 201,
    description: 'Bulk invitation completed',
    schema: {
      type: 'object',
      properties: {
        successful: {
          type: 'array',
          items: { $ref: '#/components/schemas/TeamMemberResponseDto' },
        },
        failed: { type: 'array', items: { type: 'object' } },
        totalProcessed: { type: 'number' },
        successCount: { type: 'number' },
        failureCount: { type: 'number' },
      },
    },
  })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  async bulkInviteTeamMembers(
    @Param('companyId', ParseIntPipe) companyId: number,
    @CurrentUser('withCompany') user: UserWithCompany,
    @Body() bulkInviteDto: BulkInviteTeamMembersDto,
  ) {
    try {
      return await this.teamMemberService.bulkInviteTeamMembers(
        user.internalUserId,
        companyId,
        bulkInviteDto,
      );
    } catch (error) {
      this.logger.error(
        `Bulk invite to company ${companyId} failed for user ${user.sub}:`,
        error,
      );
      throw error;
    }
  }

  @Get('companies/:companyId/team-members')
  @ApiOperation({
    summary: 'Get company team members',
    description: 'Get all team members for a company',
  })
  @ApiResponse({
    status: 200,
    description: 'Team members retrieved successfully',
    type: [TeamMemberResponseDto],
  })
  @ApiForbiddenResponse({ description: 'Access denied to this company' })
  @ApiQuery({ name: 'role', required: false, enum: TeamMemberRoleEnum })
  @ApiQuery({ name: 'status', required: false, enum: TeamMemberStatusEnum })
  @ApiQuery({ name: 'search', required: false, type: String })
  async getCompanyTeamMembers(
    @Param('companyId', ParseIntPipe) companyId: number,
    @CurrentUser('withCompany') user: UserWithCompany,
    @Query() filters: TeamMemberSearchQueryDto,
  ): Promise<TeamMemberResponseDto[]> {
    try {
      const teamMembers = await this.teamMemberService.getCompanyTeamMembers(
        companyId,
        user.internalUserId,
        filters,
      );
      return teamMembers as TeamMemberResponseDto[];
    } catch (error) {
      this.logger.error(
        `Get team members for company ${companyId} failed for user ${user.sub}:`,
        error,
      );
      throw error;
    }
  }

  @Get('companies/:companyId/team-members/stats')
  @ApiOperation({
    summary: 'Get team statistics',
    description: 'Get team member statistics for a company',
  })
  @ApiResponse({
    status: 200,
    description: 'Team statistics retrieved successfully',
    type: TeamMemberStatsResponseDto,
  })
  @ApiForbiddenResponse({ description: 'Access denied to this company' })
  async getTeamStats(
    @Param('companyId', ParseIntPipe) companyId: number,
    @CurrentUser('withCompany') user: UserWithCompany,
  ): Promise<TeamMemberStatsResponseDto> {
    try {
      return await this.teamMemberService.getTeamStats(
        companyId,
        user.internalUserId,
      );
    } catch (error) {
      this.logger.error(
        `Get team stats for company ${companyId} failed for user ${user.sub}:`,
        error,
      );
      throw error;
    }
  }

  @Get('team-members/:id')
  @ApiOperation({
    summary: 'Get team member by ID',
    description: 'Get detailed team member information',
  })
  @ApiResponse({
    status: 200,
    description: 'Team member retrieved successfully',
    type: TeamMemberWithRelationsResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Team member not found' })
  @ApiForbiddenResponse({ description: 'Access denied' })
  async getTeamMemberById(
    @Param('id', ParseIntPipe) teamMemberId: number,
    @CurrentUser('withCompany') user: UserWithCompany,
  ): Promise<TeamMemberWithRelationsResponseDto> {
    try {
      const teamMember = await this.teamMemberService.getTeamMemberById(
        teamMemberId,
        user.internalUserId,
      );
      return teamMember as TeamMemberWithRelationsResponseDto;
    } catch (error) {
      this.logger.error(
        `Get team member ${teamMemberId} failed for user ${user.sub}:`,
        error,
      );
      throw error;
    }
  }

  @Put('team-members/:id')
  @ApiOperation({
    summary: 'Update team member',
    description: 'Update team member information (Owner/Admin or own profile)',
  })
  @ApiResponse({
    status: 200,
    description: 'Team member updated successfully',
    type: TeamMemberResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Team member not found' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  async updateTeamMember(
    @Param('id', ParseIntPipe) teamMemberId: number,
    @CurrentUser('withCompany') user: UserWithCompany,
    @Body() updateDto: UpdateTeamMemberDto,
  ): Promise<TeamMemberResponseDto> {
    try {
      const teamMember = await this.teamMemberService.updateTeamMember(
        teamMemberId,
        user.internalUserId,
        updateDto,
      );
      return teamMember as TeamMemberResponseDto;
    } catch (error) {
      this.logger.error(
        `Update team member ${teamMemberId} failed for user ${user.sub}:`,
        error,
      );
      throw error;
    }
  }

  @Put('team-members/:id/role')
  @UseGuards(RolesGuard)
  @AdminOnly()
  @ApiOperation({
    summary: 'Update team member role',
    description: 'Update team member role (Owner/Admin only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Team member role updated successfully',
    type: TeamMemberResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Team member not found' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  async updateTeamMemberRole(
    @Param('id', ParseIntPipe) teamMemberId: number,
    @CurrentUser('withCompany') user: UserWithCompany,
    @Body() updateRoleDto: UpdateTeamMemberRoleDto,
  ): Promise<TeamMemberResponseDto> {
    try {
      const teamMember = await this.teamMemberService.updateTeamMemberRole(
        teamMemberId,
        user.internalUserId,
        updateRoleDto.role,
      );
      return teamMember as TeamMemberResponseDto;
    } catch (error) {
      this.logger.error(
        `Update team member role ${teamMemberId} failed for user ${user.sub}:`,
        error,
      );
      throw error;
    }
  }

  @Delete('team-members/:id')
  @UseGuards(RolesGuard)
  @AdminOnly()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Remove team member',
    description: 'Remove team member from company (Owner/Admin only)',
  })
  @ApiResponse({
    status: 204,
    description: 'Team member removed successfully',
  })
  @ApiNotFoundResponse({ description: 'Team member not found' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  async removeTeamMember(
    @Param('id', ParseIntPipe) teamMemberId: number,
    @CurrentUser('withCompany') user: UserWithCompany,
  ): Promise<void> {
    try {
      await this.teamMemberService.removeTeamMember(
        teamMemberId,
        user.internalUserId,
      );
    } catch (error) {
      this.logger.error(
        `Remove team member ${teamMemberId} failed for user ${user.sub}:`,
        error,
      );
      throw error;
    }
  }

  @Post('team-members/:id/suspend')
  @UseGuards(RolesGuard)
  @AdminOnly()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Suspend team member',
    description: 'Suspend a team member (Owner/Admin only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Team member suspended successfully',
    type: TeamMemberResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Team member not found' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  async suspendTeamMember(
    @Param('id', ParseIntPipe) teamMemberId: number,
    @CurrentUser('withCompany') user: UserWithCompany,
  ): Promise<TeamMemberResponseDto> {
    try {
      const teamMember = await this.teamMemberService.suspendTeamMember(
        teamMemberId,
        user.internalUserId,
      );
      return teamMember as TeamMemberResponseDto;
    } catch (error) {
      this.logger.error(
        `Suspend team member ${teamMemberId} failed for user ${user.sub}:`,
        error,
      );
      throw error;
    }
  }

  @Post('team-members/:id/reactivate')
  @UseGuards(RolesGuard)
  @AdminOnly()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reactivate team member',
    description: 'Reactivate a suspended team member (Owner/Admin only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Team member reactivated successfully',
    type: TeamMemberResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Team member not found' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  async reactivateTeamMember(
    @Param('id', ParseIntPipe) teamMemberId: number,
    @CurrentUser('withCompany') user: UserWithCompany,
  ): Promise<TeamMemberResponseDto> {
    try {
      const teamMember = await this.teamMemberService.reactivateTeamMember(
        teamMemberId,
        user.internalUserId,
      );
      return teamMember as TeamMemberResponseDto;
    } catch (error) {
      this.logger.error(
        `Reactivate team member ${teamMemberId} failed for user ${user.sub}:`,
        error,
      );
      throw error;
    }
  }

  // *************************************************
  // ************** INVITATION MANAGEMENT ***********
  // *************************************************

  @Post('invitations/accept-by-token')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Accept invitation by token',
    description: 'Accept a team invitation using the token from the email link (public endpoint)',
  })
  @ApiResponse({
    status: 200,
    description: 'Invitation accepted successfully',
    type: TeamMemberResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid or expired invitation token',
  })
  async acceptInvitationByToken(
    @Body() acceptDto: AcceptInvitationByTokenDto,
  ): Promise<TeamMemberResponseDto> {
    try {
      const teamMember = await this.teamMemberService.acceptInvitationByToken(
        acceptDto.token,
      );
      return teamMember as TeamMemberResponseDto;
    } catch (error) {
      this.logger.error(
        `Accept invitation by token failed:`,
        error,
      );
      throw error;
    }
  }

  @Get('invitations/pending')
  @Auth()
  @ApiOperation({
    summary: 'Get pending invitations',
    description: 'Get pending team invitations for current user email',
  })
  @ApiResponse({
    status: 200,
    description: 'Pending invitations retrieved successfully',
    type: [TeamMemberWithRelationsResponseDto],
  })
  async getPendingInvitations(
    @CurrentUser('withCompany') user: UserWithCompany,
  ) {
    try {
      return await this.teamMemberService.getPendingInvitations(user.email);
    } catch (error) {
      this.logger.error(
        `Get pending invitations failed for user ${user.sub}:`,
        error,
      );
      throw error;
    }
  }

  @Post('invitations/:id/accept')
  @Auth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Accept team invitation',
    description: 'Accept a pending team invitation (authenticated user)',
  })
  @ApiResponse({
    status: 200,
    description: 'Invitation accepted successfully',
    type: TeamMemberResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Invitation not found' })
  @ApiBadRequestResponse({
    description: 'Invitation already accepted or inactive',
  })
  async acceptInvitation(
    @Param('id', ParseIntPipe) teamMemberId: number,
    @CurrentUser('withCompany') user: UserWithCompany,
    @Body() acceptDto?: AcceptInvitationDto,
  ): Promise<TeamMemberResponseDto> {
    try {
      const teamMember = await this.teamMemberService.acceptInvitation(
        teamMemberId,
        user.internalUserId,
        acceptDto,
      );
      return teamMember as TeamMemberResponseDto;
    } catch (error) {
      this.logger.error(
        `Accept invitation ${teamMemberId} failed for user ${user.sub}:`,
        error,
      );
      throw error;
    }
  }

  @Post('invitations/:id/resend')
  @UseGuards(RolesGuard)
  @AdminOnly()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Resend invitation',
    description: 'Resend invitation email to a pending team member (Owner/Admin only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Invitation resent successfully',
    type: TeamMemberResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Team member not found' })
  @ApiBadRequestResponse({ description: 'Team member is not pending' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  async resendInvitation(
    @Param('id', ParseIntPipe) teamMemberId: number,
    @CurrentUser('withCompany') user: UserWithCompany,
  ): Promise<TeamMemberResponseDto> {
    try {
      const teamMember = await this.teamMemberService.resendInvitation(
        teamMemberId,
        user.internalUserId,
      );
      return teamMember as TeamMemberResponseDto;
    } catch (error) {
      this.logger.error(
        `Resend invitation ${teamMemberId} failed for user ${user.sub}:`,
        error,
      );
      throw error;
    }
  }

  // *************************************************
  // ************** USER TEAM MEMBERSHIPS ***********
  // *************************************************

  @Get('my-memberships')
  @Auth()
  @ApiOperation({
    summary: 'Get user team memberships',
    description: 'Get all companies where user is a team member',
  })
  @ApiResponse({
    status: 200,
    description: 'Team memberships retrieved successfully',
    type: [TeamMemberWithRelationsResponseDto],
  })
  async getUserMemberships(
    @CurrentUser('withCompany') user: UserWithCompany,
  ) {
    try {
      return await this.teamMemberService.getUserMemberships(
        user.internalUserId,
      );
    } catch (error) {
      this.logger.error(
        `Get user memberships failed for user ${user.sub}:`,
        error,
      );
      throw error;
    }
  }

  // *************************************************
  // ************** UTILITY ENDPOINTS ***************
  // *************************************************

  @Post('team-members')
  @UseGuards(RolesGuard)
  @AdminOnly()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create team member directly',
    description:
      'Create team member directly without invitation (Owner/Admin only)',
  })
  @ApiResponse({
    status: 201,
    description: 'Team member created successfully',
    type: TeamMemberResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid data or email already exists',
  })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  async createTeamMember(
    @CurrentUser('withCompany') user: UserWithCompany,
    @Body() createDto: InviteTeamMemberDto & { companyId: number },
  ): Promise<TeamMemberResponseDto> {
    try {
      const teamMember = await this.teamMemberService.createTeamMember(
        user.internalUserId,
        createDto,
      );
      return teamMember as TeamMemberResponseDto;
    } catch (error) {
      this.logger.error(
        `Create team member failed for user ${user.sub}:`,
        error,
      );
      throw error;
    }
  }
}
