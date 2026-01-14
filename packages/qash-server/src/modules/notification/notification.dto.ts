import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsObject,
  IsUrl,
} from 'class-validator';
import { Transform } from 'class-transformer';
import {
  NotificationsStatusEnum,
  NotificationsTypeEnum,
} from 'src/database/generated/enums';

export class CreateNotificationDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  public title: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  public message: string;

  @ApiProperty({ enum: NotificationsTypeEnum })
  @IsEnum(NotificationsTypeEnum)
  public type: NotificationsTypeEnum;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  public metadata?: Record<string, any> | null;

  @ApiPropertyOptional()
  @IsUrl()
  @IsOptional()
  public actionUrl?: string | null;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  public walletAddress: string;
}

export class UpdateNotificationStatusDto {
  @ApiProperty({ enum: NotificationsStatusEnum })
  @IsEnum(NotificationsStatusEnum)
  public status: NotificationsStatusEnum;
}

export class NotificationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  public page?: number = 1;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  public limit?: number = 10;

  @ApiPropertyOptional({ enum: NotificationsTypeEnum })
  @IsEnum(NotificationsTypeEnum)
  @IsOptional()
  public type?: NotificationsTypeEnum;

  @ApiPropertyOptional({ enum: NotificationsStatusEnum })
  @IsEnum(NotificationsStatusEnum)
  @IsOptional()
  public status?: NotificationsStatusEnum;
}

export class NotificationResponseDto {
  @ApiProperty()
  public id: number;

  @ApiProperty()
  public title: string;

  @ApiProperty()
  public message: string;

  @ApiProperty({ enum: NotificationsTypeEnum })
  public type: NotificationsTypeEnum;

  @ApiProperty({ enum: NotificationsStatusEnum })
  public status: NotificationsStatusEnum;

  @ApiPropertyOptional()
  public metadata: Record<string, any> | null;

  @ApiPropertyOptional()
  public actionUrl: string | null;

  @ApiProperty()
  public walletAddress: string;

  @ApiProperty()
  public createdAt: Date;

  @ApiProperty()
  public updatedAt: Date;

  @ApiPropertyOptional()
  public readAt: Date | null;
}
