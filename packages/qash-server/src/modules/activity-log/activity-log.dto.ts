import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsDateString,
  IsPositive,
  Min,
  Max,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  TeamMemberRoleEnum,
  ActivityActionEnum,
  ActivityEntityTypeEnum,
} from '../../database/generated/client';

export class ActivityLogQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by team member ID',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  teamMemberId?: number;

  @ApiPropertyOptional({
    description: 'Filter by action type',
    enum: ActivityActionEnum,
    example: ActivityActionEnum.CREATE,
  })
  @IsOptional()
  @IsEnum(ActivityActionEnum)
  action?: ActivityActionEnum;

  @ApiPropertyOptional({
    description: 'Filter by entity type',
    enum: ActivityEntityTypeEnum,
    example: ActivityEntityTypeEnum.EMPLOYEE,
  })
  @IsOptional()
  @IsEnum(ActivityEntityTypeEnum)
  entityType?: ActivityEntityTypeEnum;

  @ApiPropertyOptional({
    description: 'Filter by entity ID',
    example: 123,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  entityId?: number;

  @ApiPropertyOptional({
    description: 'Filter by start date',
    example: '2024-01-01T00:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'Filter by end date',
    example: '2024-12-31T23:59:59Z',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Page number (1-based)',
    example: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    example: 20,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class TeamMemberSummaryDto {
  @ApiProperty({ description: 'Team member ID', example: 1 })
  id: number;

  @ApiProperty({ description: 'First name', example: 'John' })
  firstName: string;

  @ApiProperty({ description: 'Last name', example: 'Doe' })
  lastName: string;

  @ApiProperty({
    description: 'Role',
    enum: TeamMemberRoleEnum,
    example: TeamMemberRoleEnum.ADMIN,
  })
  role: TeamMemberRoleEnum;
}

export class ActivityLogResponseDto {
  @ApiProperty({ description: 'Activity log ID', example: 1 })
  id: number;

  @ApiProperty({ description: 'Company ID', example: 1 })
  companyId: number;

  @ApiProperty({ description: 'Team member ID', example: 1 })
  teamMemberId: number;

  @ApiProperty({
    description: 'Action performed',
    enum: ActivityActionEnum,
    example: ActivityActionEnum.CREATE,
  })
  action: ActivityActionEnum;

  @ApiProperty({
    description: 'Entity type affected',
    enum: ActivityEntityTypeEnum,
    example: ActivityEntityTypeEnum.EMPLOYEE,
  })
  entityType: ActivityEntityTypeEnum;

  @ApiProperty({ description: 'Entity ID', example: 123 })
  entityId: number;

  @ApiPropertyOptional({ description: 'Entity UUID', example: 'cuid123' })
  entityUuid?: string;

  @ApiPropertyOptional({ description: 'Description of the action' })
  description?: string;

  @ApiPropertyOptional({ description: 'Previous values before the change' })
  previousValues?: any;

  @ApiPropertyOptional({ description: 'New values after the change' })
  newValues?: any;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  metadata?: any;

  @ApiProperty({ description: 'Timestamp', example: '2024-01-15T10:30:00Z' })
  createdAt: Date;

  @ApiPropertyOptional({
    description: 'Team member who performed the action',
    type: TeamMemberSummaryDto,
  })
  teamMember?: TeamMemberSummaryDto;
}

export class ActivityLogPaginatedResponseDto {
  @ApiProperty({
    description: 'List of activity logs',
    type: [ActivityLogResponseDto],
  })
  data: ActivityLogResponseDto[];

  @ApiProperty({ description: 'Total number of items', example: 100 })
  total: number;

  @ApiProperty({ description: 'Current page', example: 1 })
  page: number;

  @ApiProperty({ description: 'Items per page', example: 20 })
  limit: number;

  @ApiProperty({ description: 'Total number of pages', example: 5 })
  totalPages: number;
}

export class ActivityLogFiltersResponseDto {
  @ApiProperty({
    description: 'List of distinct actions',
    enum: ActivityActionEnum,
    isArray: true,
    example: [ActivityActionEnum.CREATE, ActivityActionEnum.UPDATE, ActivityActionEnum.DELETE],
  })
  actions: ActivityActionEnum[];

  @ApiProperty({
    description: 'List of distinct entity types',
    enum: ActivityEntityTypeEnum,
    isArray: true,
    example: [ActivityEntityTypeEnum.EMPLOYEE, ActivityEntityTypeEnum.PAYROLL],
  })
  entityTypes: ActivityEntityTypeEnum[];
}

// Re-export enums for convenience
export { ActivityActionEnum, ActivityEntityTypeEnum } from '../../database/generated/client';
