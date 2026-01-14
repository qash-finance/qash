import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  CurrentUser,
  UserWithCompany,
} from '../auth/decorators/current-user.decorator';
import { CompanyAuth } from '../auth/decorators/company-auth.decorator';
import {
  CreateClientDto,
  PaginatedClientsResponseDto,
  ClientResponseDto,
  UpdateClientDto,
} from './client.dto';
import { PaginationOptions } from '../../database/base.repository';
import { ClientService } from './services/client.service';

@ApiTags('Client')
@CompanyAuth()
@Controller('clients')
export class ClientController {
  constructor(private readonly clientService: ClientService) {}

  @Get()
  @ApiOperation({
    summary: 'List clients with pagination and optional search',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Search by company name, email, country, or city',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number (1-based)',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Items per page (max 100)',
    example: 10,
  })
  @ApiResponse({
    status: 200,
    description: 'Clients retrieved successfully',
    type: PaginatedClientsResponseDto,
  })
  async getClients(
    @CurrentUser('withCompany') user: UserWithCompany,
    @Query('search') search?: string,
    @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 10,
  ) {
    const pagination: PaginationOptions = { page, limit };
    return this.clientService.getClients(user.company.id, {
      ...pagination,
      search,
    });
  }

  @Get(':uuid')
  @ApiOperation({
    summary: 'Get a single client by uuid',
  })
  @ApiParam({
    name: 'uuid',
    type: 'string',
    description: 'Client UUID',
  })
  @ApiResponse({
    status: 200,
    description: 'Client retrieved successfully',
    type: ClientResponseDto,
  })
  async getClientById(
    @CurrentUser('withCompany') user: UserWithCompany,
    @Param('uuid') uuid: string,
  ) {
    return this.clientService.getClientById(user.company.id, uuid);
  }

  @Post()
  @ApiOperation({
    summary: 'Create a new client',
  })
  @ApiResponse({
    status: 201,
    description: 'Client created successfully',
    type: ClientResponseDto,
  })
  async createClient(
    @CurrentUser('withCompany') user: UserWithCompany,
    @Body() payload: CreateClientDto,
  ) {
    return this.clientService.createClient(user.company.id, payload);
  }

  @Put(':uuid')
  @ApiOperation({
    summary: 'Update a client',
  })
  @ApiParam({
    name: 'uuid',
    type: 'string',
    description: 'Client UUID',
  })
  @ApiResponse({
    status: 200,
    description: 'Client updated successfully',
    type: ClientResponseDto,
  })
  async updateClient(
    @CurrentUser('withCompany') user: UserWithCompany,
    @Param('uuid') uuid: string,
    @Body() payload: UpdateClientDto,
  ) {
    return this.clientService.updateClient(user.company.id, uuid, payload);
  }

  @Delete(':uuid')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a client',
  })
  @ApiParam({
    name: 'uuid',
    type: 'string',
    description: 'Client UUID',
  })
  @ApiResponse({
    status: 204,
    description: 'Client deleted successfully',
  })
  async deleteClient(
    @CurrentUser('withCompany') user: UserWithCompany,
    @Param('uuid') uuid: string,
  ) {
    await this.clientService.deleteClient(user.company.id, uuid);
  }
}
