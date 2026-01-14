import { ApiProperty } from '@nestjs/swagger';
import { CategoryShapeEnum } from 'src/database/generated/client';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  IsEmail,
  IsObject,
  IsArray,
  IsNumber,
  IsInt,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class TokenDto {
  @ApiProperty({
    description: 'The address of the token',
    example: 'mtst1qzxh4e7uwlu5xyrnms9d5tfm7v2y7u6a',
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
  @IsNotEmpty()
  decimals: number;

  @ApiProperty({
    description: 'The name of the token',
    example: 'USDC',
  })
  @IsString()
  @IsNotEmpty()
  name: string;
}

export class NetworkDto {
  @ApiProperty({
    description: 'The name of the network',
    example: 'Ethereum',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'The chain ID of the network',
    example: 1,
  })
  @IsNumber()
  @IsNotEmpty()
  chainId: number;
}

export class CreateCompanyGroupDto {
  @ApiProperty({
    description: 'The name of the category',
    example: 'Company',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100, { message: 'name cannot be longer than 100 characters' })
  @Matches(/^[a-zA-Z0-9\s\-_]+$/, {
    message:
      'name can only contain letters, numbers, spaces, hyphens, and underscores',
  })
  name: string;

  @ApiProperty({
    description: 'The shape of the category',
    example: 'CIRCLE',
  })
  @IsString()
  @IsNotEmpty()
  @IsEnum(CategoryShapeEnum)
  shape: CategoryShapeEnum;

  @ApiProperty({
    description: 'The color of the category',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50, { message: 'color cannot be longer than 50 characters' })
  @Matches(/^#([0-9a-fA-F]{6})$/, {
    message: 'color must be a valid hex color',
  })
  color: string;
}

export class CreateContactDto {
  @ApiProperty({
    description: 'The group information',
    example: 1,
  })
  @IsNotEmpty()
  @IsNumber()
  groupId: number;

  @ApiProperty({
    description: 'The name of new contact',
    example: 'John',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100, { message: 'name cannot be longer than 100 characters' })
  @Matches(/^[a-zA-Z0-9\s\-_]+$/, {
    message:
      'name can only contain letters, numbers, spaces, hyphens, and underscores',
  })
  name: string;

  @ApiProperty({
    description: 'The address of the address book entry',
    example: 'mtst1qzxh4e7uwlu5xyrnms9d5tfm7v2y7u6a',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3, { message: 'address is too short' })
  walletAddress: string;

  @ApiProperty({
    description: 'The email of the address book entry',
    example: 'user@example.com',
    required: false,
  })
  @IsEmail({}, { message: 'email must be a valid email address' })
  @MaxLength(255, { message: 'email cannot be longer than 255 characters' })
  email: string;

  @ApiProperty({
    description: 'The token information of the address book entry',
    example: {
      address: 'mtst1qzxh4e7uwlu5xyrnms9d5tfm7v2y7u6a',
      symbol: 'USDC',
    },
    required: false,
  })
  @IsObject()
  @IsNotEmpty()
  token: TokenDto;

  @ApiProperty({
    description: 'The network information of the address book entry',
    example: {
      name: 'Ethereum',
      chainId: 1,
    },
  })
  @IsObject()
  @IsNotEmpty()
  network: NetworkDto;
}

export class AddressBookNameDuplicateDto {
  @ApiProperty({
    description: 'The name of the address book entry',
    example: 'JuPENG',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100, { message: 'name cannot be longer than 100 characters' })
  @Matches(/^[a-zA-Z0-9\s\-_]+$/, {
    message:
      'name can only contain letters, numbers, spaces, hyphens, and underscores',
  })
  name: string;

  @ApiProperty({
    description: 'The category of the address book entry',
    example: 'Company',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50, { message: 'category cannot be longer than 50 characters' })
  @Matches(/^[a-zA-Z0-9\s\-]+$/, {
    message: 'category can only contain letters, numbers, spaces, and hyphens',
  })
  category: string;

  @ApiProperty({
    description: 'The address of the user',
    example: 'mtst1qzxh4e7uwlu5xyrnms9d5tfm7v2y7u6a',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3, { message: 'userAddress is too short' })
  userAddress: string;
}
export class UpdateAddressBookDto {
  @ApiProperty({
    description: 'The name of the address book entry',
    example: 'JuPENG',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'name cannot be longer than 100 characters' })
  @Matches(/^[a-zA-Z0-9\s\-_]+$/, {
    message:
      'name can only contain letters, numbers, spaces, hyphens, and underscores',
  })
  name?: string;

  // Preferred new property used by frontend
  @ApiProperty({
    description: 'The wallet address of the address book entry',
    example: 'mtst1apq3rg90yj9xgyq8s7fej0hgkgcnp8aj_qruqqypuyph',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MinLength(10, { message: 'address is too short' })
  @Matches(/^mtst1[a-z0-9_]+$/i, {
    message:
      "Address must start with 'mtst1' and contain only letters, numbers, and underscores",
  })
  walletAddress?: string;

  // Backwards-compatible alias (if existing clients send `address`)
  @ApiProperty({
    description: 'Legacy address property (alias for compatibility)',
    example: 'mtst1qzxh4e7uwlu5xyrnms9d5tfm7v2y7u6a',
    required: false,
  })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({
    description: 'The email of the address book entry',
    example: 'user@example.com',
    required: false,
  })
  @IsOptional()
  @IsEmail({}, { message: 'email must be a valid email address' })
  @MaxLength(255, { message: 'email cannot be longer than 255 characters' })
  email?: string;

  @ApiProperty({
    description: 'The token information of the address book entry',
    example: {
      address: 'mtst1ar600d6s8uwwjgznqtxqt085qs9a50ej_qruqqypuyph',
      symbol: 'QASH',
    },
    required: false,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => TokenDto)
  token?: TokenDto;

  // Preferred new property (frontend uses groupId)
  @ApiProperty({
    description: 'The group ID of the address book entry',
    example: 1,
    required: false,
  })
  @IsOptional()
  @IsInt()
  groupId?: number;

  @ApiProperty({
    description: 'Network details for the address book entry',
    example: { name: 'Miden Testnet', chainId: 0 },
    required: false,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => NetworkDto)
  network?: NetworkDto;
}

export class DeleteAddressBookDto {
  @ApiProperty({
    description: 'Array of address book entry IDs to delete',
    example: [1, 3, 2, 4],
    type: [Number],
  })
  @IsArray()
  @IsNotEmpty()
  @IsNumber({}, { each: true })
  ids: number[];
}

export class BulkDeleteEmployeesDto {
  @ApiProperty({
    description: 'Array of employee IDs to delete',
    example: [1, 3, 2, 4],
    type: [Number],
  })
  @IsArray()
  @IsNotEmpty()
  @IsNumber({}, { each: true })
  ids: number[];
}

export class AddressBookOrderDto {
  @ApiProperty({
    description: 'The address book entry ID',
    example: 1,
  })
  @IsNumber()
  @IsNotEmpty()
  id: number;

  @ApiProperty({
    description: 'The new order position',
    example: 1,
  })
  @IsNumber()
  @IsNotEmpty()
  order: number;
}

export class CategoryOrderDto {
  @ApiProperty({
    description: 'Array of category IDs in the desired order',
    example: [1, 3, 2, 4],
    type: [Number],
  })
  @IsArray()
  @IsNotEmpty()
  @IsNumber({}, { each: true })
  categoryIds: number[];
}

export class PaginationMetaDto {
  @ApiProperty({ description: 'Current page number', example: 1 })
  page: number;

  @ApiProperty({ description: 'Number of items per page', example: 20 })
  limit: number;

  @ApiProperty({ description: 'Total number of items', example: 150 })
  total: number;

  @ApiProperty({ description: 'Total number of pages', example: 8 })
  totalPages: number;

  @ApiProperty({ description: 'Whether there is a next page', example: true })
  hasNext: boolean;

  @ApiProperty({
    description: 'Whether there is a previous page',
    example: false,
  })
  hasPrev: boolean;
}

export class CompanyContactResponseDto {
  @ApiProperty({ description: 'Contact ID', example: 1 })
  id: number;

  @ApiProperty({ description: 'Contact name', example: 'John Doe' })
  name: string;

  @ApiProperty({ description: 'Contact address', example: '0x1234...abcd' })
  walletAddress: string;

  @ApiProperty({
    description: 'Contact description',
    example: 'Business partner',
  })
  description?: string;

  @ApiProperty({ description: 'Token information' })
  token: any;

  @ApiProperty({ description: 'Network information' })
  network: any;

  @ApiProperty({ description: 'Group ID', example: 1 })
  groupId: number;

  @ApiProperty({ description: 'Company ID', example: 1 })
  companyId: number;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;
}

export class PaginatedContactsResponseDto {
  @ApiProperty({
    description: 'Array of contacts',
    type: [CompanyContactResponseDto],
  })
  data: CompanyContactResponseDto[];

  @ApiProperty({
    description: 'Pagination metadata',
    type: PaginationMetaDto,
  })
  pagination: PaginationMetaDto;
}

export class CompanyGroupResponseDto {
  @ApiProperty({ description: 'Group ID', example: 1 })
  id: number;

  @ApiProperty({ description: 'Group name', example: 'Employees' })
  name: string;

  @ApiProperty({
    description: 'Group shape',
    enum: ['CIRCLE', 'DIAMOND', 'SQUARE', 'TRIANGLE'],
  })
  shape: string;

  @ApiProperty({ description: 'Group color', example: '#FF5733' })
  color: string;

  @ApiProperty({ description: 'Display order', example: 1 })
  order: number;

  @ApiProperty({ description: 'Company ID', example: 1 })
  companyId: number;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;
}

export class PaginatedGroupsResponseDto {
  @ApiProperty({
    description: 'Array of groups',
    type: [CompanyGroupResponseDto],
  })
  data: CompanyGroupResponseDto[];

  @ApiProperty({
    description: 'Pagination metadata',
    type: PaginationMetaDto,
  })
  pagination: PaginationMetaDto;
}
