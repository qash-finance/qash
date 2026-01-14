import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsObject,
  IsNumber,
  IsDateString,
  Matches,
  Min,
  Max,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ContractTermEnum } from 'src/database/generated/client';

export class NetworkDto {
  @ApiProperty({
    description: 'The name of the network',
    example: 'Ethereum',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'The description of the network',
    example: 'Ethereum Mainnet',
  })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({
    description: 'The chain ID of the network',
    example: 1,
  })
  @IsNumber()
  @IsNotEmpty()
  chainId: number;

  @ApiPropertyOptional({
    description: 'Additional network metadata',
    example: {
      rpcUrl: 'https://mainnet.infura.io/v3/...',
      explorer: 'https://etherscan.io',
    },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class TokenDto {
  @ApiProperty({
    description: 'The address of the token contract',
    example: '0xA0b86a33E6441c8C06DD2F23c9C5C5c8C5C5C5C5',
  })
  @IsString()
  @IsNotEmpty()
  address: string;

  @ApiProperty({
    description: 'The symbol of the token',
    example: 'USDC',
  })
  @IsString()
  @IsNotEmpty()
  symbol: string;

  @ApiProperty({
    description: 'The decimals of the token',
    example: 18,
  })
  @IsNumber()
  @Min(0)
  @Max(18)
  decimals: number;

  @ApiProperty({
    description: 'The name of the token',
    example: 'USD Coin',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    description: 'Additional token metadata',
    example: { logoUrl: 'https://...', coingeckoId: 'usd-coin' },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class CreatePayrollDto {
  @ApiProperty({
    description: 'The ID of the employee (company contact)',
    example: 1,
  })
  @IsNumber()
  @IsNotEmpty()
  employeeId: number;

  @ApiProperty({
    description: 'Payment network details',
    type: NetworkDto,
  })
  @ValidateNested()
  @Type(() => NetworkDto)
  network: NetworkDto;

  @ApiProperty({
    description: 'Payment token details',
    type: TokenDto,
  })
  @ValidateNested()
  @Type(() => TokenDto)
  token: TokenDto;

  @ApiProperty({
    description: 'Contract term type',
    enum: ContractTermEnum,
    example: ContractTermEnum.PERMANENT,
  })
  @IsEnum(ContractTermEnum)
  contractTerm: ContractTermEnum;

  @ApiProperty({
    description: 'Payroll cycle in months',
    example: 12,
    minimum: 1,
    maximum: 120,
  })
  @IsNumber()
  @Min(1)
  @Max(120)
  payrollCycle: number;

  @ApiProperty({
    description: 'Salary amount (as string for precision)',
    example: '5000.00',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d+(\.\d{1,8})?$/, {
    message:
      'Amount must be a valid positive number with up to 8 decimal places',
  })
  amount: string;

  @ApiProperty({
    description:
      'Payday day-of-month (1-31). First pay starts next month on this day',
    example: 5,
    minimum: 1,
    maximum: 31,
  })
  @IsNumber()
  @Min(1)
  @Max(31)
  payday: number;

  @ApiProperty({
    description: 'Joining date',
    example: '2024-01-01T00:00:00Z',
  })
  @IsDateString()
  joiningDate: string;

  @ApiPropertyOptional({
    description: 'Item description of the payroll',
    example: 'Consultant service',
  })
  @IsString()
  description: string;

  @ApiPropertyOptional({
    description: 'Additional notes about the payroll',
    example: 'Monthly salary for software engineer position',
  })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({
    description: 'Additional metadata',
    example: { department: 'Engineering', level: 'Senior' },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @ApiPropertyOptional({
    description:
      'Number of days before pay date to generate invoice (default: 5)',
    example: 5,
    minimum: 0,
    maximum: 30,
    default: 5,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(30)
  generateDaysBefore?: number;
}

export class CreatePayroll {
  @ApiProperty({
    description: 'The ID of the employee (company contact)',
    example: 1,
  })
  @IsNumber()
  @IsNotEmpty()
  employeeId: number;

  @ApiProperty({
    description: 'Payment network details',
    type: NetworkDto,
  })
  @ValidateNested()
  @Type(() => NetworkDto)
  network: NetworkDto;

  @ApiProperty({
    description: 'Payment token details',
    type: TokenDto,
  })
  @ValidateNested()
  @Type(() => TokenDto)
  token: TokenDto;

  @ApiProperty({
    description: 'Contract term type',
    enum: ContractTermEnum,
    example: ContractTermEnum.PERMANENT,
  })
  @IsEnum(ContractTermEnum)
  contractTerm: ContractTermEnum;

  @ApiProperty({
    description: 'Payroll cycle in months',
    example: 12,
    minimum: 1,
    maximum: 120,
  })
  @IsNumber()
  @Min(1)
  @Max(120)
  payrollCycle: number;

  @ApiProperty({
    description: 'Salary amount (as string for precision)',
    example: '5000.00',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d+(\.\d{1,8})?$/, {
    message:
      'Amount must be a valid positive number with up to 8 decimal places',
  })
  amount: string;

  @ApiProperty({
    description:
      'Payday day-of-month (1-31). First pay starts next month on this day',
    example: 5,
    minimum: 1,
    maximum: 31,
  })
  @IsNumber()
  @Min(1)
  @Max(31)
  payday: number;

  @ApiProperty({
    description: 'Joining date',
    example: '2024-01-01T00:00:00Z',
  })
  @IsDateString()
  joiningDate: string;

  @ApiProperty({
    description: 'Payment end date (will be set to next month)',
    example: '2024-01-01T00:00:00Z',
  })
  @IsDateString()
  payEndDate: string;

  @ApiPropertyOptional({
    description: 'Item description of the payroll',
    example: 'Consultant service',
  })
  @IsString()
  description: string;

  @ApiPropertyOptional({
    description: 'Additional notes about the payroll',
    example: 'Monthly salary for software engineer position',
  })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({
    description: 'Additional metadata',
    example: { department: 'Engineering', level: 'Senior' },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @ApiPropertyOptional({
    description:
      'Number of days before pay date to generate invoice (default: 5)',
    example: 5,
    minimum: 0,
    maximum: 30,
    default: 5,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(30)
  generateDaysBefore?: number;
}

export class UpdatePayrollDto {
  @ApiPropertyOptional({
    description: 'Payment network details',
    type: NetworkDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => NetworkDto)
  network?: NetworkDto;

  @ApiPropertyOptional({
    description: 'Payment token details',
    type: TokenDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => TokenDto)
  token?: TokenDto;

  @ApiPropertyOptional({
    description: 'Contract term type',
    enum: ContractTermEnum,
  })
  @IsOptional()
  @IsEnum(ContractTermEnum)
  contractTerm?: ContractTermEnum;

  @ApiPropertyOptional({
    description: 'Contract duration in months',
    minimum: 1,
    maximum: 120,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(120)
  payrollCycle?: number;

  @ApiPropertyOptional({
    description: 'Salary amount (as string for precision)',
    example: '5500.00',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d{1,8})?$/, {
    message:
      'Amount must be a valid positive number with up to 8 decimal places',
  })
  amount?: string;

  @ApiPropertyOptional({
    description: 'Item description of the payroll',
    example: 'Consultant service',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description:
      'Payday day-of-month (1-31). If provided, next pay starts next month on this day',
    example: 10,
    minimum: 1,
    maximum: 31,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(31)
  paydayDay?: number;

  @ApiPropertyOptional({
    description: 'Additional notes about the payroll',
    example: 'Monthly salary for software engineer position',
  })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({
    description: 'Additional metadata',
    example: { department: 'Engineering', level: 'Senior' },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class PayrollQueryDto {
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
    description: 'Filter by employee ID',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  employeeId?: number;

  @ApiPropertyOptional({
    description: 'Filter by contract term',
    enum: ContractTermEnum,
  })
  @IsOptional()
  @IsEnum(ContractTermEnum)
  contractTerm?: ContractTermEnum;

  @ApiPropertyOptional({
    description: 'Search by employee name or email',
  })
  @IsOptional()
  @IsString()
  search?: string;
}

export class PayrollStatsDto {
  @ApiProperty({
    description: 'Total number of active payrolls',
    example: 25,
  })
  totalActive: number;

  @ApiProperty({
    description: 'Total number of paused payrolls',
    example: 3,
  })
  totalPaused: number;

  @ApiProperty({
    description: 'Total number of completed payrolls',
    example: 12,
  })
  totalCompleted: number;

  @ApiProperty({
    description: 'Total monthly payout amount',
    example: '125000.00',
  })
  totalMonthlyAmount: string;

  @ApiProperty({
    description: 'Number of payrolls due this month',
    example: 20,
  })
  dueThisMonth: number;
}

export class PendingInvoiceReviewsDto {
  @ApiProperty({
    description: 'Whether the payroll has pending invoice reviews',
    example: true,
  })
  hasPendingReviews: boolean;

  @ApiProperty({
    description: 'Number of invoices pending review (status: SENT)',
    example: 3,
  })
  pendingCount: number;

  @ApiProperty({
    description: 'List of invoice UUIDs pending review',
    example: ['clx123abc', 'clx456def'],
    type: [String],
  })
  pendingInvoiceUuids: string[];
}
