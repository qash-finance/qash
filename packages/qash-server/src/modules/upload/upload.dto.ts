import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum UploadTypeEnum {
  AVATAR = 'avatar',
  COMPANY_LOGO = 'companyLogo',
  MULTISIG_LOGO = 'multisigLogo',
}

export class UploadFileDto {
  @ApiProperty({
    description: 'Upload type',
    enum: UploadTypeEnum,
    example: UploadTypeEnum.AVATAR,
  })
  @IsEnum(UploadTypeEnum)
  uploadType: UploadTypeEnum;

  @ApiProperty({
    description: 'Optional metadata',
    required: false,
  })
  @IsOptional()
  @IsString()
  metadata?: string;
}

export class UploadResponseDto {
  @ApiProperty({
    description: 'Public Supabase URL',
    example: 'https://cegivvttatgprtwskytq.supabase.co/storage/v1/object/public/user-avatars/avatar-123-1706520000.jpg',
  })
  url: string;

  @ApiProperty({
    description: 'Original filename',
    example: 'profile.jpg',
  })
  fileName: string;

  @ApiProperty({
    description: 'File size in bytes',
    example: 102400,
  })
  fileSize: number;

  @ApiProperty({
    description: 'MIME type',
    example: 'image/jpeg',
  })
  mimeType: string;

  @ApiProperty({
    description: 'Supabase storage path',
    example: 'avatar-123-1706520000.jpg',
  })
  storagePath: string;

  @ApiProperty({
    description: 'Upload timestamp',
    example: '2026-01-29T10:00:00Z',
  })
  uploadedAt: string;
}
