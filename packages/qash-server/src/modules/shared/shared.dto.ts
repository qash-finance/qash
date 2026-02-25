import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsOptional,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import type * as SharedTypesToken from '@qash/types/dto/token';
import type * as SharedTypesNetwork from '@qash/types/dto/network';

export class TokenDto implements SharedTypesToken.TokenDto {
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

  @ApiProperty({
    description: 'The amount of the token in raw/wei format',
    example: '1000000000000000000',
    required: false,
  })
  @IsOptional()
  @IsString()
  amount?: string;
}

export class NetworkDto implements SharedTypesNetwork.NetworkDto {
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