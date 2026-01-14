import {
  Controller,
  Put,
  Body,
  Param,
  ParseIntPipe,
  Logger,
} from '@nestjs/common';
import { TeamMemberService } from './team-member.service';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiNotFoundResponse,
  ApiForbiddenResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import {
  CurrentUser,
  UserWithCompany,
} from '../auth/decorators/current-user.decorator';
import { UpdateTeamMemberDto, TeamMemberResponseDto } from './team-member.dto';
import { CompanyAuth } from '../auth/decorators/company-auth.decorator';

@ApiTags('KYB - Team Management')
@ApiBearerAuth()
@Controller('kyb')
@CompanyAuth()
export class TeamMemberController {
  private readonly logger = new Logger(TeamMemberController.name);

  constructor(private readonly teamMemberService: TeamMemberService) {}

  // // *************************************************
  // // ************** TEAM MEMBER CRUD ****************
  // // *************************************************

  // @Post('companies/:companyId/team-members/invite')
  // @HttpCode(HttpStatus.CREATED)
  // @ApiOperation({
  //   summary: 'Invite team member',
  //   description: 'Invite a new team member to the company (Owner/Admin only)',
  // })
  // @ApiResponse({
  //   status: 201,
  //   description: 'Team member invited successfully',
  //   type: TeamMemberResponseDto,
  // })
  // @ApiBadRequestResponse({
  //   description: 'Invalid data or email already invited',
  // })
  // @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  // async inviteTeamMember(
  //   @Param('companyId', ParseIntPipe) companyId: number,
  //   @CurrentUser() user: JwtPayload,
  //   @Body() inviteDto: InviteTeamMemberDto,
  // ): Promise<TeamMemberResponseDto> {
  //   try {
  //     const teamMember = await this.teamMemberService.inviteTeamMember(
  //       user.sub,
  //       companyId,
  //       inviteDto,
  //     );
  //     return teamMember as TeamMemberResponseDto;
  //   } catch (error) {
  //     this.logger.error(
  //       `Invite team member to company ${companyId} failed for user ${user.sub}:`,
  //       error,
  //     );
  //     throw error;
  //   }
  // }

  // @Post('companies/:companyId/team-members/bulk-invite')
  // @HttpCode(HttpStatus.CREATED)
  // @ApiOperation({
  //   summary: 'Bulk invite team members',
  //   description: 'Invite multiple team members at once (Owner/Admin only)',
  // })
  // @ApiResponse({
  //   status: 201,
  //   description: 'Bulk invitation completed',
  //   schema: {
  //     type: 'object',
  //     properties: {
  //       successful: {
  //         type: 'array',
  //         items: { $ref: '#/components/schemas/TeamMemberResponseDto' },
  //       },
  //       failed: { type: 'array', items: { type: 'object' } },
  //       totalProcessed: { type: 'number' },
  //       successCount: { type: 'number' },
  //       failureCount: { type: 'number' },
  //     },
  //   },
  // })
  // @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  // async bulkInviteTeamMembers(
  //   @Param('companyId', ParseIntPipe) companyId: number,
  //   @CurrentUser() user: JwtPayload,
  //   @Body() bulkInviteDto: BulkInviteTeamMembersDto,
  // ) {
  //   try {
  //     return await this.teamMemberService.bulkInviteTeamMembers(
  //       user.sub,
  //       companyId,
  //       bulkInviteDto,
  //     );
  //   } catch (error) {
  //     this.logger.error(
  //       `Bulk invite to company ${companyId} failed for user ${user.sub}:`,
  //       error,
  //     );
  //     throw error;
  //   }
  // }

  // @Get('companies/:companyId/team-members')
  // @ApiOperation({
  //   summary: 'Get company team members',
  //   description: 'Get all team members for a company',
  // })
  // @ApiResponse({
  //   status: 200,
  //   description: 'Team members retrieved successfully',
  //   type: [TeamMemberResponseDto],
  // })
  // @ApiForbiddenResponse({ description: 'Access denied to this company' })
  // @ApiQuery({ name: 'role', required: false, enum: TeamMemberRoleEnum })
  // @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  // @ApiQuery({ name: 'search', required: false, type: String })
  // async getCompanyTeamMembers(
  //   @Param('companyId', ParseIntPipe) companyId: number,
  //   @CurrentUser() user: JwtPayload,
  //   @Query() filters: TeamMemberSearchQueryDto,
  // ): Promise<TeamMemberResponseDto[]> {
  //   try {
  //     const teamMembers = await this.teamMemberService.getCompanyTeamMembers(
  //       companyId,
  //       user.sub,
  //       filters,
  //     );
  //     return teamMembers as TeamMemberResponseDto[];
  //   } catch (error) {
  //     this.logger.error(
  //       `Get team members for company ${companyId} failed for user ${user.sub}:`,
  //       error,
  //     );
  //     throw error;
  //   }
  // }

  // @Get('companies/:companyId/team-members/stats')
  // @ApiOperation({
  //   summary: 'Get team statistics',
  //   description: 'Get team member statistics for a company',
  // })
  // @ApiResponse({
  //   status: 200,
  //   description: 'Team statistics retrieved successfully',
  //   type: TeamMemberStatsResponseDto,
  // })
  // @ApiForbiddenResponse({ description: 'Access denied to this company' })
  // async getTeamStats(
  //   @Param('companyId', ParseIntPipe) companyId: number,
  //   @CurrentUser() user: JwtPayload,
  // ): Promise<TeamMemberStatsResponseDto> {
  //   try {
  //     return await this.teamMemberService.getTeamStats(companyId, user.sub);
  //   } catch (error) {
  //     this.logger.error(
  //       `Get team stats for company ${companyId} failed for user ${user.sub}:`,
  //       error,
  //     );
  //     throw error;
  //   }
  // }

  // @Get('team-members/:id')
  // @ApiOperation({
  //   summary: 'Get team member by ID',
  //   description: 'Get detailed team member information',
  // })
  // @ApiResponse({
  //   status: 200,
  //   description: 'Team member retrieved successfully',
  //   type: TeamMemberWithRelationsResponseDto,
  // })
  // @ApiNotFoundResponse({ description: 'Team member not found' })
  // @ApiForbiddenResponse({ description: 'Access denied' })
  // async getTeamMemberById(
  //   @Param('id', ParseIntPipe) teamMemberId: number,
  //   @CurrentUser() user: JwtPayload,
  // ): Promise<TeamMemberWithRelationsResponseDto> {
  //   try {
  //     const teamMember = await this.teamMemberService.getTeamMemberById(
  //       teamMemberId,
  //       user.sub,
  //     );
  //     return teamMember as TeamMemberWithRelationsResponseDto;
  //   } catch (error) {
  //     this.logger.error(
  //       `Get team member ${teamMemberId} failed for user ${user.sub}:`,
  //       error,
  //     );
  //     throw error;
  //   }
  // }

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

  // @Put('team-members/:id/role')
  // @ApiOperation({
  //   summary: 'Update team member role',
  //   description: 'Update team member role (Owner/Admin only)',
  // })
  // @ApiResponse({
  //   status: 200,
  //   description: 'Team member role updated successfully',
  //   type: TeamMemberResponseDto,
  // })
  // @ApiNotFoundResponse({ description: 'Team member not found' })
  // @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  // async updateTeamMemberRole(
  //   @Param('id', ParseIntPipe) teamMemberId: number,
  //   @CurrentUser() user: JwtPayload,
  //   @Body() updateRoleDto: UpdateTeamMemberRoleDto,
  // ): Promise<TeamMemberResponseDto> {
  //   try {
  //     const teamMember = await this.teamMemberService.updateTeamMemberRole(
  //       teamMemberId,
  //       user.sub,
  //       updateRoleDto.role,
  //     );
  //     return teamMember as TeamMemberResponseDto;
  //   } catch (error) {
  //     this.logger.error(
  //       `Update team member role ${teamMemberId} failed for user ${user.sub}:`,
  //       error,
  //     );
  //     throw error;
  //   }
  // }

  // @Delete('team-members/:id')
  // @HttpCode(HttpStatus.NO_CONTENT)
  // @ApiOperation({
  //   summary: 'Remove team member',
  //   description: 'Remove team member from company (Owner/Admin only)',
  // })
  // @ApiResponse({
  //   status: 204,
  //   description: 'Team member removed successfully',
  // })
  // @ApiNotFoundResponse({ description: 'Team member not found' })
  // @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  // async removeTeamMember(
  //   @Param('id', ParseIntPipe) teamMemberId: number,
  //   @CurrentUser() user: JwtPayload,
  // ): Promise<void> {
  //   try {
  //     await this.teamMemberService.removeTeamMember(teamMemberId, user.sub);
  //   } catch (error) {
  //     this.logger.error(
  //       `Remove team member ${teamMemberId} failed for user ${user.sub}:`,
  //       error,
  //     );
  //     throw error;
  //   }
  // }

  // // *************************************************
  // // ************** INVITATION MANAGEMENT ***********
  // // *************************************************

  // @Get('invitations/pending')
  // @ApiOperation({
  //   summary: 'Get pending invitations',
  //   description: 'Get pending team invitations for current user email',
  // })
  // @ApiResponse({
  //   status: 200,
  //   description: 'Pending invitations retrieved successfully',
  //   type: [TeamMemberWithRelationsResponseDto],
  // })
  // async getPendingInvitations(@CurrentUser() user: JwtPayload) {
  //   try {
  //     return await this.teamMemberService.getPendingInvitations(user.email);
  //   } catch (error) {
  //     this.logger.error(
  //       `Get pending invitations failed for user ${user.sub}:`,
  //       error,
  //     );
  //     throw error;
  //   }
  // }

  // @Post('invitations/:id/accept')
  // @HttpCode(HttpStatus.OK)
  // @ApiOperation({
  //   summary: 'Accept team invitation',
  //   description: 'Accept a pending team invitation',
  // })
  // @ApiResponse({
  //   status: 200,
  //   description: 'Invitation accepted successfully',
  //   type: TeamMemberResponseDto,
  // })
  // @ApiNotFoundResponse({ description: 'Invitation not found' })
  // @ApiBadRequestResponse({
  //   description: 'Invitation already accepted or inactive',
  // })
  // async acceptInvitation(
  //   @Param('id', ParseIntPipe) teamMemberId: number,
  //   @CurrentUser() user: JwtPayload,
  //   @Body() acceptDto?: AcceptInvitationDto,
  // ): Promise<TeamMemberResponseDto> {
  //   try {
  //     const teamMember = await this.teamMemberService.acceptInvitation(
  //       teamMemberId,
  //       user.sub,
  //       acceptDto,
  //     );
  //     return teamMember as TeamMemberResponseDto;
  //   } catch (error) {
  //     this.logger.error(
  //       `Accept invitation ${teamMemberId} failed for user ${user.sub}:`,
  //       error,
  //     );
  //     throw error;
  //   }
  // }

  // // *************************************************
  // // ************** USER TEAM MEMBERSHIPS ***********
  // // *************************************************

  // @Get('my-memberships')
  // @ApiOperation({
  //   summary: 'Get user team memberships',
  //   description: 'Get all companies where user is a team member',
  // })
  // @ApiResponse({
  //   status: 200,
  //   description: 'Team memberships retrieved successfully',
  //   type: [TeamMemberWithRelationsResponseDto],
  // })
  // async getUserMemberships(@CurrentUser() user: JwtPayload) {
  //   try {
  //     // We need to create a method in the service for this
  //     return await this.teamMemberService.getUserMemberships(user.sub);
  //   } catch (error) {
  //     this.logger.error(
  //       `Get user memberships failed for user ${user.sub}:`,
  //       error,
  //     );
  //     throw error;
  //   }
  // }

  // // *************************************************
  // // ************** UTILITY ENDPOINTS ***************
  // // *************************************************

  // @Post('team-members')
  // @HttpCode(HttpStatus.CREATED)
  // @ApiOperation({
  //   summary: 'Create team member directly',
  //   description:
  //     'Create team member directly without invitation (Owner/Admin only)',
  // })
  // @ApiResponse({
  //   status: 201,
  //   description: 'Team member created successfully',
  //   type: TeamMemberResponseDto,
  // })
  // @ApiBadRequestResponse({
  //   description: 'Invalid data or email already exists',
  // })
  // @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  // async createTeamMember(
  //   @CurrentUser() user: JwtPayload,
  //   @Body() createDto: CreateTeamMemberDto,
  // ): Promise<TeamMemberResponseDto> {
  //   try {
  //     const teamMember = await this.teamMemberService.createTeamMember(
  //       user.sub,
  //       createDto,
  //     );
  //     return teamMember as TeamMemberResponseDto;
  //   } catch (error) {
  //     this.logger.error(
  //       `Create team member failed for user ${user.sub}:`,
  //       error,
  //     );
  //     throw error;
  //   }
  // }
}
