import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsBoolean,
  IsObject,
  Length,
  IsEmail,
  IsUrl,
  IsNumber,
  IsPositive,
} from 'class-validator';
import { TeamMemberRoleEnum } from '../../database/generated/client';

export class CreateTeamMemberDto {
  @ApiProperty({
    description: 'First name',
    example: 'John',
  })
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  firstName: string;

  @ApiProperty({
    description: 'Last name',
    example: 'Doe',
  })
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  lastName: string;

  @ApiProperty({
    description: 'Email address',
    example: 'john.doe@acme.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiPropertyOptional({
    description: 'Job position/title',
    example: 'Chief Executive Officer',
  })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  position?: string;

  @ApiPropertyOptional({
    description: 'Profile picture URL',
    example: 'https://example.com/profile.jpg',
  })
  @IsOptional()
  @IsUrl()
  profilePicture?: string;

  @ApiProperty({
    description: 'Team member role',
    enum: TeamMemberRoleEnum,
    example: TeamMemberRoleEnum.ADMIN,
  })
  @IsEnum(TeamMemberRoleEnum)
  role: TeamMemberRoleEnum;

  @ApiProperty({
    description: 'Company ID',
    example: 1,
  })
  @IsNumber()
  @IsPositive()
  companyId: number;

  @ApiPropertyOptional({
    description: 'Additional metadata',
    example: { department: 'Engineering', startDate: '2024-01-01' },
  })
  @IsOptional()
  @IsObject()
  metadata?: any;
}

export class UpdateTeamMemberDto {
  @ApiPropertyOptional({
    description: 'First name',
    example: 'John',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  firstName?: string;

  @ApiPropertyOptional({
    description: 'Last name',
    example: 'Doe',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  lastName?: string;

  @ApiPropertyOptional({
    description: 'Email address',
    example: 'john.doe@acme.com',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    description: 'Job position/title',
    example: 'Chief Executive Officer',
  })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  position?: string;

  @ApiPropertyOptional({
    description: 'Profile picture URL',
    example: 'https://example.com/profile.jpg',
  })
  @IsOptional()
  @IsUrl()
  profilePicture?: string;

  @ApiPropertyOptional({
    description: 'Additional metadata',
    example: { department: 'Engineering', startDate: '2024-01-01' },
  })
  @IsOptional()
  @IsObject()
  metadata?: any;
}

export class UpdateTeamMemberRoleDto {
  @ApiProperty({
    description: 'New role for team member',
    enum: TeamMemberRoleEnum,
    example: TeamMemberRoleEnum.ADMIN,
  })
  @IsEnum(TeamMemberRoleEnum)
  role: TeamMemberRoleEnum;
}

export class InviteTeamMemberDto {
  @ApiProperty({
    description: 'First name',
    example: 'Jane',
  })
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  firstName: string;

  @ApiProperty({
    description: 'Last name',
    example: 'Smith',
  })
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  lastName: string;

  @ApiProperty({
    description: 'Email address to send invitation',
    example: 'jane.smith@acme.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiPropertyOptional({
    description: 'Job position/title',
    example: 'Chief Technology Officer',
  })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  position?: string;

  @ApiProperty({
    description: 'Role to assign',
    enum: TeamMemberRoleEnum,
    example: TeamMemberRoleEnum.ADMIN,
  })
  @IsEnum(TeamMemberRoleEnum)
  role: TeamMemberRoleEnum;

  @ApiPropertyOptional({
    description: 'Additional metadata',
    example: { department: 'Engineering' },
  })
  @IsOptional()
  @IsObject()
  metadata?: any;
}

export class TeamMemberResponseDto {
  @ApiProperty({ description: 'Team member ID', example: 1 })
  id: number;

  @ApiProperty({ description: 'First name', example: 'John' })
  firstName: string;

  @ApiProperty({ description: 'Last name', example: 'Doe' })
  lastName: string;

  @ApiProperty({ description: 'Email address', example: 'john.doe@acme.com' })
  email: string;

  @ApiPropertyOptional({ description: 'Position', example: 'CEO' })
  position?: string;

  @ApiPropertyOptional({
    description: 'Profile picture URL',
    example: 'https://example.com/profile.jpg',
  })
  profilePicture?: string;

  @ApiProperty({
    description: 'Role',
    enum: TeamMemberRoleEnum,
    example: TeamMemberRoleEnum.OWNER,
  })
  role: TeamMemberRoleEnum;

  @ApiProperty({ description: 'Is active', example: true })
  isActive: boolean;

  @ApiProperty({ description: 'Company ID', example: 1 })
  companyId: number;

  @ApiPropertyOptional({ description: 'User ID if linked', example: 1 })
  userId?: number;

  @ApiPropertyOptional({ description: 'Invited by user ID', example: 1 })
  invitedBy?: number;

  @ApiPropertyOptional({ description: 'Invitation timestamp' })
  invitedAt?: Date;

  @ApiPropertyOptional({ description: 'Join timestamp' })
  joinedAt?: Date;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  metadata?: any;
}

export class TeamMemberWithRelationsResponseDto extends TeamMemberResponseDto {
  @ApiPropertyOptional({
    description: 'Company information',
    type: 'object',
    properties: {
      id: { type: 'number', example: 1 },
      companyName: { type: 'string', example: 'Acme Corporation' },
      registrationNumber: { type: 'string', example: 'REG123456789' },
    },
  })
  company?: any;

  @ApiPropertyOptional({
    description: 'User account information',
    type: 'object',
    properties: {
      id: { type: 'number', example: 1 },
      email: { type: 'string', example: 'user@example.com' },
    },
  })
  user?: any;

  @ApiPropertyOptional({
    description: 'Inviter information',
    type: 'object',
    properties: {
      id: { type: 'number', example: 1 },
      email: { type: 'string', example: 'inviter@example.com' },
    },
  })
  inviter?: any;
}

export class TeamMemberStatsResponseDto {
  @ApiProperty({ description: 'Total team members', example: 10 })
  total: number;

  @ApiProperty({ description: 'Number of owners', example: 1 })
  owners: number;

  @ApiProperty({ description: 'Number of admins', example: 3 })
  admins: number;

  @ApiProperty({ description: 'Number of viewers', example: 6 })
  viewers: number;

  @ApiProperty({ description: 'Active members', example: 9 })
  active: number;

  @ApiProperty({ description: 'Pending invitations', example: 2 })
  pending: number;
}

export class TeamMemberSearchQueryDto {
  @ApiPropertyOptional({
    description: 'Role filter',
    enum: TeamMemberRoleEnum,
  })
  @IsOptional()
  @IsEnum(TeamMemberRoleEnum)
  role?: TeamMemberRoleEnum;

  @ApiPropertyOptional({
    description: 'Active status filter',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Filter by whether member has user account',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  hasUser?: boolean;

  @ApiPropertyOptional({
    description: 'Search in name, email, or position',
    example: 'John',
  })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  search?: string;
}

export class AcceptInvitationDto {
  @ApiPropertyOptional({
    description: 'Profile picture URL',
    example: 'https://example.com/profile.jpg',
  })
  @IsOptional()
  @IsUrl()
  profilePicture?: string;

  @ApiPropertyOptional({
    description: 'Additional metadata',
    example: { preferences: { notifications: true } },
  })
  @IsOptional()
  @IsObject()
  metadata?: any;
}

export class BulkInviteTeamMembersDto {
  @ApiProperty({
    description: 'List of team members to invite',
    type: [InviteTeamMemberDto],
  })
  members: InviteTeamMemberDto[];
}
