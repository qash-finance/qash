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
} from 'class-validator';
import {
  CompanyTypeEnum,
  CompanyVerificationStatusEnum,
} from '../../database/generated/client';
import type * as SharedTypes from '@qash/types/dto/company';

export class CreateCompanyDto implements SharedTypes.CreateCompanyDto {
  @ApiProperty({
    description: 'First name of the company admin',
    example: 'John',
  })
  @IsString()
  @IsNotEmpty()
  @Length(2, 100)
  companyOwnerFirstName: string;
  @ApiProperty({
    description: 'Last name of the company admin',
    example: 'Doe',
  })
  @IsString()
  @IsNotEmpty()
  @Length(2, 100)
  companyOwnerLastName: string;

  @ApiProperty({
    description: 'Company name',
    example: 'Acme Corporation Ltd.',
  })
  @IsString()
  @IsNotEmpty()
  @Length(2, 255)
  companyName: string;

  @ApiPropertyOptional({
    description: 'Company registration number (min 5 characters)',
    example: 'REG123456789',
  })
  @IsOptional()
  @IsString()
  @Length(5, 100)
  registrationNumber?: string;

  @ApiPropertyOptional({
    description: 'Type of company',
    enum: CompanyTypeEnum,
    example: CompanyTypeEnum.CORPORATION,
  })
  @IsOptional()
  @IsEnum(CompanyTypeEnum)
  companyType?: CompanyTypeEnum;

  @ApiPropertyOptional({
    description: 'Country where company is registered',
    example: 'United States',
  })
  @IsOptional()
  @IsString()
  @Length(2, 100)
  country?: string;

  @ApiPropertyOptional({
    description: 'Primary address line (min 5 characters)',
    example: '123 Business Street',
  })
  @IsOptional()
  @IsString()
  @Length(5, 255)
  address1?: string;

  @ApiPropertyOptional({
    description: 'Secondary address line',
    example: 'Suite 456',
  })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  address2?: string;

  @ApiPropertyOptional({
    description: 'City',
    example: 'New York',
  })
  @IsOptional()
  @IsString()
  @Length(2, 100)
  city?: string;

  @ApiPropertyOptional({
    description: 'Postal/ZIP code (min 3 characters)',
    example: '10001',
  })
  @IsOptional()
  @IsString()
  @Length(3, 20)
  postalCode?: string;

  @ApiPropertyOptional({
    description: 'Additional metadata',
    example: { website: 'https://acme.com', industry: 'Technology' },
  })
  @IsOptional()
  @IsObject()
  metadata?: any;

  @ApiPropertyOptional({
    description: 'Company logo URL or base64 encoded image',
    example: 'https://example.com/logo.png',
  })
  @IsOptional()
  @IsString()
  logo?: string;
}

export class UpdateCompanyDto implements SharedTypes.UpdateCompanyDto {
  @ApiPropertyOptional({
    description: 'Company name',
    example: 'Acme Corporation Ltd.',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Length(2, 255)
  companyName?: string;

  @ApiPropertyOptional({
    description: 'Type of company',
    enum: CompanyTypeEnum,
    example: CompanyTypeEnum.CORPORATION,
  })
  @IsOptional()
  @IsEnum(CompanyTypeEnum)
  companyType?: CompanyTypeEnum;

  @ApiPropertyOptional({
    description: 'Notification email',
    example: 'notifications@company.com',
  })
  @IsOptional()
  @IsEmail({}, { message: 'email must be a valid email address' })
  @Length(5, 255)
  notificationEmail?: string;

  @ApiPropertyOptional({
    description: 'Country where company is registered',
    example: 'United States',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Length(2, 100)
  country?: string;

  @ApiPropertyOptional({
    description: 'Primary address line',
    example: '123 Business Street',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Length(5, 255)
  address1?: string;

  @ApiPropertyOptional({
    description: 'Secondary address line',
    example: 'Suite 456',
  })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  address2?: string;

  @ApiPropertyOptional({
    description: 'City',
    example: 'New York',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Length(2, 100)
  city?: string;

  @ApiPropertyOptional({
    description: 'Postal/ZIP code',
    example: '10001',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Length(3, 20)
  postalCode?: string;

  @ApiPropertyOptional({
    description: 'Additional metadata',
    example: { website: 'https://acme.com', industry: 'Technology' },
  })
  @IsOptional()
  @IsObject()
  metadata?: any;

  @ApiPropertyOptional({
    description: 'Company logo URL or base64 encoded image',
    example: 'https://example.com/logo.png',
  })
  @IsOptional()
  @IsString()
  logo?: string;
}

export class UpdateVerificationStatusDto implements SharedTypes.UpdateVerificationStatusDto {
  @ApiProperty({
    description: 'New verification status',
    enum: CompanyVerificationStatusEnum,
    example: CompanyVerificationStatusEnum.VERIFIED,
  })
  @IsEnum(CompanyVerificationStatusEnum)
  verificationStatus: CompanyVerificationStatusEnum;
}

export class CompanyResponseDto implements SharedTypes.CompanyResponseDto {
  @ApiProperty({
    description: 'Company UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  uuid: string;

  @ApiProperty({ description: 'Company ID', example: 1 })
  id: number;

  @ApiProperty({
    description: 'Company name',
    example: 'Acme Corporation Ltd.',
  })
  companyName: string;

  @ApiPropertyOptional({ description: 'Registration number', example: 'REG123456789', nullable: true })
  registrationNumber?: string | null;

  @ApiPropertyOptional({
    description: 'Company type',
    enum: CompanyTypeEnum,
    example: CompanyTypeEnum.CORPORATION,
    nullable: true,
  })
  companyType?: CompanyTypeEnum | null;

  @ApiPropertyOptional({ description: 'Country', example: 'United States', nullable: true })
  country?: string | null;

  @ApiPropertyOptional({
    description: 'Address line 1',
    example: '123 Business Street',
    nullable: true,
  })
  address1?: string | null;

  @ApiPropertyOptional({ description: 'Address line 2', example: 'Suite 456', nullable: true })
  address2?: string | null;

  @ApiPropertyOptional({ description: 'City', example: 'New York', nullable: true })
  city?: string | null;

  @ApiPropertyOptional({ description: 'Postal code', example: '10001', nullable: true })
  postalCode?: string | null;

  @ApiProperty({
    description: 'Verification status',
    enum: CompanyVerificationStatusEnum,
    example: CompanyVerificationStatusEnum.PENDING,
  })
  verificationStatus: CompanyVerificationStatusEnum;

  @ApiProperty({ description: 'Is company active', example: true })
  isActive: boolean;

  @ApiProperty({ description: 'Created by user ID', example: 1 })
  createdBy: number;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  metadata?: any;
}

export class CompanyWithTeamResponseDto extends CompanyResponseDto {
  @ApiProperty({
    description: 'Team members',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        id: { type: 'number', example: 1 },
        firstName: { type: 'string', example: 'John' },
        lastName: { type: 'string', example: 'Doe' },
        email: { type: 'string', example: 'john@acme.com' },
        position: { type: 'string', example: 'CEO' },
        role: { type: 'string', example: 'OWNER' },
        isActive: { type: 'boolean', example: true },
        joinedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  teamMembers: any[];

  @ApiProperty({
    description: 'Company creator information',
    type: 'object',
    properties: {
      id: { type: 'number', example: 1 },
      email: { type: 'string', example: 'creator@example.com' },
    },
  })
  creator: any;
}

export class CompanyStatsResponseDto implements SharedTypes.CompanyStatsResponseDto {
  @ApiProperty({ description: 'Total companies', example: 10 })
  total: number;

  @ApiProperty({ description: 'Verified companies', example: 5 })
  verified: number;

  @ApiProperty({ description: 'Pending verification', example: 3 })
  pending: number;

  @ApiProperty({ description: 'Under review', example: 1 })
  underReview: number;

  @ApiProperty({ description: 'Rejected companies', example: 1 })
  rejected: number;
}

export class CompanySearchQueryDto implements SharedTypes.CompanySearchQueryDto {
  @ApiPropertyOptional({
    description: 'Verification status filter',
    enum: CompanyVerificationStatusEnum,
  })
  @IsOptional()
  @IsEnum(CompanyVerificationStatusEnum)
  verificationStatus?: CompanyVerificationStatusEnum;

  @ApiPropertyOptional({
    description: 'Company type filter',
    enum: CompanyTypeEnum,
  })
  @IsOptional()
  @IsEnum(CompanyTypeEnum)
  companyType?: CompanyTypeEnum;

  @ApiPropertyOptional({
    description: 'Country filter',
    example: 'United States',
  })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({
    description: 'Active status filter',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Search in company name or registration number',
    example: 'Acme',
  })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  search?: string;
}

export class IsEmployeeResponseDto implements SharedTypes.IsEmployeeResponseDto {
  @ApiProperty({
    description: 'Whether the user is an employee',
    example: true,
  })
  isEmployee: boolean;
}
