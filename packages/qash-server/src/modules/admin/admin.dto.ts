import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { CompanyVerificationStatusEnum } from '../../database/generated/client';

export class UpdateVerificationStatusDto {
  @ApiProperty({
    enum: CompanyVerificationStatusEnum,
    description: 'New verification status for the company',
    example: 'VERIFIED',
  })
  @IsEnum(CompanyVerificationStatusEnum)
  status: CompanyVerificationStatusEnum;

  @ApiPropertyOptional({
    description: 'Admin notes for the verification decision',
    example: 'All documents verified successfully',
  })
  @IsOptional()
  @IsString()
  adminNotes?: string;
}
