import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsNumber,
  IsArray,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BillStatusEnum } from 'src/database/generated/client';

export class BillQueryDto {
  @ApiPropertyOptional({
    description: 'Page number for pagination',
    example: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    example: 10,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiPropertyOptional({
    description: 'Filter by status',
    enum: BillStatusEnum,
  })
  @IsOptional()
  @IsEnum(BillStatusEnum)
  status?: BillStatusEnum;

  @ApiPropertyOptional({
    description: 'Filter by group ID',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  groupId?: number;

  @ApiPropertyOptional({
    description: 'Search by invoice number or employee name',
  })
  @IsOptional()
  @IsString()
  search?: string;
}

export class BillStatsDto {
  @ApiProperty({
    description: 'Total number of bills',
    example: 50,
  })
  totalBills: number;

  @ApiProperty({
    description: 'Total number of pending bills',
    example: 15,
  })
  totalPending: number;

  @ApiProperty({
    description: 'Total number of paid bills',
    example: 30,
  })
  totalPaid: number;

  @ApiProperty({
    description: 'Total number of overdue bills',
    example: 5,
  })
  totalOverdue: number;

  @ApiProperty({
    description: 'Total amount of all bills',
    example: '125000.00',
  })
  totalAmount: string;

  @ApiProperty({
    description: 'Total amount of pending bills',
    example: '45000.00',
  })
  pendingAmount: string;

  @ApiProperty({
    description: 'Total amount of paid bills',
    example: '75000.00',
  })
  paidAmount: string;

  @ApiProperty({
    description: 'Total amount of overdue bills',
    example: '5000.00',
  })
  overdueAmount: string;
}

export class PayBillsDto {
  @ApiProperty({
    description: 'Array of bill IDs to pay',
    example: [
      'cmj5it8cc0000atybhs4icpbt',
      'def5it8cc0000atybhs4icpbt',
      'abc5it8cc0000atybhs4icpbt',
    ],
  })
  @IsArray()
  @IsString({ each: true })
  billUUIDs: string[];

  @ApiProperty({
    description: 'Transaction hash from the blockchain payment',
    example: '0x1234567890abcdef (Optional)',
  })
  @IsString()
  @IsOptional()
  transactionHash?: string;
}

export class BillTimelineDto {
  @ApiProperty({
    description: 'Timeline event type',
    example: 'created',
  })
  event: string;

  @ApiProperty({
    description: 'Event timestamp',
    example: '2024-01-15T10:30:00Z',
  })
  timestamp: Date;

  @ApiPropertyOptional({
    description: 'Additional event metadata',
  })
  metadata?: Record<string, any>;
}

export class BatchPaymentResultDto {
  @ApiProperty({
    description: 'Total amount paid',
    example: '15000.00',
  })
  totalAmount: string;
}
