import {
  Controller,
  Get,
  Query,
  Param,
  ParseIntPipe,
  Logger,
  ParseEnumPipe,
} from '@nestjs/common';
import { ActivityLogService } from './activity-log.service';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiForbiddenResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import {
  CurrentUser,
  UserWithCompany,
} from '../auth/decorators/current-user.decorator';
import {
  ActivityLogQueryDto,
  ActivityLogResponseDto,
  ActivityLogPaginatedResponseDto,
  ActivityLogFiltersResponseDto,
  ActivityEntityTypeEnum,
} from './activity-log.dto';
import { CompanyAuth } from '../auth/decorators/company-auth.decorator';

@ApiTags('Activity Logs')
@ApiBearerAuth()
@Controller('activity-logs')
@CompanyAuth()
export class ActivityLogController {
  private readonly logger = new Logger(ActivityLogController.name);

  constructor(private readonly activityLogService: ActivityLogService) {}

  @Get('companies/:companyId')
  @ApiOperation({
    summary: 'Get company activity logs',
    description: 'Get paginated activity logs for a company',
  })
  @ApiResponse({
    status: 200,
    description: 'Activity logs retrieved successfully',
    type: ActivityLogPaginatedResponseDto,
  })
  @ApiForbiddenResponse({ description: 'Access denied to this company' })
  async getCompanyActivityLogs(
    @Param('companyId', ParseIntPipe) companyId: number,
    @CurrentUser('withCompany') user: UserWithCompany,
    @Query() query: ActivityLogQueryDto,
  ): Promise<ActivityLogPaginatedResponseDto> {
    try {
      // Verify user has access to this company
      if (user.company?.id !== companyId) {
        this.logger.warn(
          `User ${user.sub} attempted to access activity logs for company ${companyId}`,
        );
      }
      return await this.activityLogService.getCompanyActivityLogs(
        companyId,
        query,
      );
    } catch (error) {
      this.logger.error(
        `Get activity logs for company ${companyId} failed:`,
        error,
      );
      throw error;
    }
  }

  @Get('companies/:companyId/recent')
  @ApiOperation({
    summary: 'Get recent activity',
    description: 'Get the most recent activity logs for a company',
  })
  @ApiResponse({
    status: 200,
    description: 'Recent activity retrieved successfully',
    type: [ActivityLogResponseDto],
  })
  @ApiForbiddenResponse({ description: 'Access denied to this company' })
  async getRecentActivity(
    @Param('companyId', ParseIntPipe) companyId: number,
    @CurrentUser('withCompany') user: UserWithCompany,
    @Query('limit') limit?: number,
  ): Promise<ActivityLogResponseDto[]> {
    try {
      const result = await this.activityLogService.getRecentActivity(
        companyId,
        limit || 10,
      );
      return result as unknown as ActivityLogResponseDto[];
    } catch (error) {
      this.logger.error(
        `Get recent activity for company ${companyId} failed:`,
        error,
      );
      throw error;
    }
  }

  @Get('companies/:companyId/entity/:entityType/:entityId')
  @ApiOperation({
    summary: 'Get entity activity',
    description: 'Get activity logs for a specific entity',
  })
  @ApiResponse({
    status: 200,
    description: 'Entity activity retrieved successfully',
    type: [ActivityLogResponseDto],
  })
  @ApiForbiddenResponse({ description: 'Access denied to this company' })
  async getEntityActivity(
    @Param('companyId', ParseIntPipe) companyId: number,
    @Param('entityType', new ParseEnumPipe(ActivityEntityTypeEnum))
    entityType: ActivityEntityTypeEnum,
    @Param('entityId', ParseIntPipe) entityId: number,
    @CurrentUser('withCompany') user: UserWithCompany,
  ): Promise<ActivityLogResponseDto[]> {
    try {
      const result = await this.activityLogService.getEntityActivity(
        companyId,
        entityType,
        entityId,
      );
      return result as unknown as ActivityLogResponseDto[];
    } catch (error) {
      this.logger.error(
        `Get entity activity for company ${companyId} failed:`,
        error,
      );
      throw error;
    }
  }

  @Get('companies/:companyId/team-member/:teamMemberId')
  @ApiOperation({
    summary: 'Get team member activity',
    description: 'Get activity logs for a specific team member',
  })
  @ApiResponse({
    status: 200,
    description: 'Team member activity retrieved successfully',
    type: ActivityLogPaginatedResponseDto,
  })
  @ApiForbiddenResponse({ description: 'Access denied to this company' })
  async getTeamMemberActivity(
    @Param('companyId', ParseIntPipe) companyId: number,
    @Param('teamMemberId', ParseIntPipe) teamMemberId: number,
    @CurrentUser('withCompany') user: UserWithCompany,
    @Query() query: ActivityLogQueryDto,
  ): Promise<ActivityLogPaginatedResponseDto> {
    try {
      return await this.activityLogService.getTeamMemberActivity(
        companyId,
        teamMemberId,
        query,
      );
    } catch (error) {
      this.logger.error(
        `Get team member activity for company ${companyId} failed:`,
        error,
      );
      throw error;
    }
  }

  @Get('companies/:companyId/filters')
  @ApiOperation({
    summary: 'Get activity log filters',
    description: 'Get available filter options for activity logs',
  })
  @ApiResponse({
    status: 200,
    description: 'Filters retrieved successfully',
    type: ActivityLogFiltersResponseDto,
  })
  @ApiForbiddenResponse({ description: 'Access denied to this company' })
  async getFilters(
    @Param('companyId', ParseIntPipe) companyId: number,
    @CurrentUser('withCompany') user: UserWithCompany,
  ): Promise<ActivityLogFiltersResponseDto> {
    try {
      return await this.activityLogService.getFilters(companyId);
    } catch (error) {
      this.logger.error(
        `Get activity log filters for company ${companyId} failed:`,
        error,
      );
      throw error;
    }
  }
}
