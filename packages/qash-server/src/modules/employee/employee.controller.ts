import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import {
  CreateContactDto,
  UpdateAddressBookDto,
  AddressBookOrderDto,
  CreateCompanyGroupDto,
  PaginatedContactsResponseDto,
  CompanyContactResponseDto,
  CompanyGroupResponseDto,
} from './employee.dto';
import { PaginationOptions } from '../../database/base.repository';
import {
  CurrentUser,
  UserWithCompany,
} from '../auth/decorators/current-user.decorator';
import { CompanyAuth } from '../auth/decorators/company-auth.decorator';
import { EmployeeGroupService } from './services/employee-group.service';
import { EmployeeService } from './services/employee.service';

@ApiTags('Employee')
@CompanyAuth()
@Controller('employees')
export class EmployeeController {
  constructor(
    private readonly employeeService: EmployeeService,
    private readonly employeeGroupService: EmployeeGroupService,
  ) {}

  //#region GET METHODS
  // *************************************************
  // **************** GET METHODS ********************
  // *************************************************

  @Get()
  @ApiOperation({
    summary: 'Get all employees',
    description:
      'Retrieve all employees for the authenticated user with optional pagination',
  })
  @ApiResponse({
    status: 200,
    description: 'Employees retrieved successfully',
    type: PaginatedContactsResponseDto,
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number (1-based)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Items per page (max 100)',
  })
  async getAllCompanyContacts(
    @CurrentUser('withCompany') user: UserWithCompany,
    @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 10,
  ) {
    const pagination: PaginationOptions = { page, limit };
    return this.employeeService.getAllEmployees(user.company, pagination);
  }

  @Get('groups')
  @ApiOperation({
    summary: 'Get all groups',
    description: "Retrieve all groups for the authenticated user's company",
  })
  @ApiResponse({
    status: 200,
    description: 'Groups retrieved successfully',
    type: [CompanyGroupResponseDto],
  })
  async getAllCompanyGroups(@CurrentUser('withCompany') user: UserWithCompany) {
    return this.employeeGroupService.getAllEmployeeGroups(user.company.id);
  }

  @Get('search')
  @ApiOperation({
    summary: 'Search company employees',
    description:
      'Search employees by name, address, or description within the company',
  })
  @ApiResponse({
    status: 200,
    description: 'Search results retrieved successfully',
    type: PaginatedContactsResponseDto,
  })
  @ApiQuery({
    name: 'search',
    required: true,
    description: 'Search term (min 2 characters)',
    example: 'john',
  })
  @ApiQuery({
    name: 'groupId',
    required: false,
    description: 'Filter by group ID',
    type: Number,
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number for pagination',
    type: Number,
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of results per page',
    type: Number,
    example: 20,
  })
  async searchCompanyContacts(
    @CurrentUser('withCompany') user: UserWithCompany,
    @Query('search') searchTerm: string,
    @Query('groupId', new ParseIntPipe({ optional: true }))
    groupId?: number,
    @Query('page', new ParseIntPipe({ optional: true }))
    page: number = 1,
    @Query('limit', new ParseIntPipe({ optional: true }))
    limit: number = 20,
  ) {
    return this.employeeService.searchEmployees(user.company.id, searchTerm, {
      groupId,
      page,
      limit,
    });
  }

  @Get('group/:groupId')
  @ApiOperation({
    summary: 'Get employees by group',
    description:
      'Retrieve all employees for a specific group within the company',
  })
  @ApiParam({
    name: 'groupId',
    description: 'Group ID',
    type: Number,
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Group employees retrieved successfully',
    type: PaginatedContactsResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Group not found or access denied',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number for pagination',
    type: Number,
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of employees per page',
    type: Number,
    example: 20,
  })
  async getContactsByCompanyGroup(
    @CurrentUser('withCompany') user: UserWithCompany,
    @Param('groupId', ParseIntPipe) groupId: number,
    @Query('page', new ParseIntPipe({ optional: true }))
    page: number = 1,
    @Query('limit', new ParseIntPipe({ optional: true }))
    limit: number = 20,
  ) {
    return this.employeeService.getEmployeesByEmployeeGroup(
      user.company.id,
      groupId,
      {
        page,
        limit,
      },
    );
  }

  @Get('stats')
  @ApiOperation({
    summary: 'Get employee statistics',
    description:
      "Get summary statistics for the company's employees and groups",
  })
  @ApiResponse({
    status: 200,
    description: 'Statistics retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        totalContacts: { type: 'number' },
        totalGroups: { type: 'number' },
        contactsByGroup: {
          type: 'object',
          additionalProperties: { type: 'number' },
        },
      },
    },
  })
  async getCompanyContactStatistics(
    @CurrentUser('withCompany') user: UserWithCompany,
  ) {
    return this.employeeService.getEmployeeStatistics(user.company.id);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get employee by ID',
    description: 'Retrieve a specific employee by its ID within the company',
  })
  @ApiParam({
    name: 'id',
    description: 'Employee ID',
    type: Number,
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Employee retrieved successfully',
    type: CompanyContactResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Employee not found or access denied',
  })
  async getCompanyContactById(
    @CurrentUser('withCompany') user: UserWithCompany,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.employeeService.getEmployeeById(user.company.id, id);
  }

  @Get('validate/name-duplicate')
  @ApiOperation({
    summary: 'Check if employee name is duplicate in group',
    description:
      'Validate if a employee name already exists in a specific group within the company',
  })
  @ApiResponse({
    status: 200,
    description: 'Validation result',
    schema: {
      type: 'object',
      properties: { isDuplicate: { type: 'boolean' } },
    },
  })
  @ApiQuery({
    name: 'name',
    required: true,
    description: 'Employee name to check',
    example: 'John Doe',
  })
  @ApiQuery({
    name: 'groupId',
    required: true,
    description: 'Group ID',
    type: Number,
    example: 1,
  })
  async checkCompanyContactNameDuplicate(
    @CurrentUser('withCompany') user: UserWithCompany,
    @Query('name') name: string,
    @Query('groupId', ParseIntPipe) groupId: number,
  ) {
    return this.employeeService.isEmployeeNameDuplicate(
      user.company.id,
      name,
      groupId,
    );
  }

  @Get('validate/address-duplicate')
  @ApiOperation({
    summary: 'Check if address is duplicate in group',
    description:
      'Validate if an address already exists in a specific group within the company',
  })
  @ApiResponse({
    status: 200,
    description: 'Validation result',
    schema: {
      type: 'object',
      properties: { isDuplicate: { type: 'boolean' } },
    },
  })
  @ApiQuery({
    name: 'address',
    required: true,
    description: 'Address to check',
    example: '0x1234567890abcdef...',
  })
  @ApiQuery({
    name: 'groupId',
    required: true,
    description: 'Group ID',
    type: Number,
    example: 1,
  })
  async checkCompanyContactAddressDuplicate(
    @CurrentUser('withCompany') user: UserWithCompany,
    @Query('address') address: string,
    @Query('groupId', ParseIntPipe) groupId: number,
  ) {
    return this.employeeService.isEmployeeAddressDuplicate(
      user.company.id,
      address,
      groupId,
    );
  }

  @Get('validate/group-exists')
  @ApiOperation({
    summary: 'Check if group exists',
    description: 'Validate if a group exists within the company',
  })
  @ApiResponse({
    status: 200,
    description: 'Validation result',
    schema: {
      type: 'object',
      properties: { exists: { type: 'boolean' } },
    },
  })
  @ApiQuery({
    name: 'groupName',
    required: true,
    description: 'Group name to check',
    example: 'Employees',
  })
  async checkCompanyGroupExists(
    @CurrentUser('withCompany') user: UserWithCompany,
    @Query('groupName') groupName: string,
  ) {
    return this.employeeService.isEmployeeGroupExists(
      user.company.id,
      groupName,
    );
  }
  //#endregion GET METHODS

  //#region POST METHODS
  // *************************************************
  // **************** POST METHODS *******************
  // *************************************************
  @Post('group')
  @ApiOperation({
    summary: 'Create new group',
    description: 'Create a new group for organizing address book entries',
  })
  @ApiResponse({
    status: 201,
    description: 'Group created successfully',
    type: CompanyGroupResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input data or duplicate category',
  })
  async createCompanyGroup(
    @CurrentUser('withCompany') user: UserWithCompany,
    @Body() dto: CreateCompanyGroupDto,
  ) {
    return this.employeeGroupService.createNewEmployeeGroup(dto, user.company);
  }

  @Post('employee')
  @ApiOperation({
    summary: 'Create new employee for a company',
    description:
      'Create a new employee for a company with validation and duplicate checking',
  })
  @ApiResponse({
    status: 201,
    description: 'Employee created successfully',
    type: CompanyContactResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input data or duplicate entry',
  })
  async createCompanyContact(
    @CurrentUser('withCompany') user: UserWithCompany,
    @Body() dto: CreateContactDto,
  ) {
    return this.employeeService.createNewEmployee(dto, user.company);
  }
  //#endregion POST METHODS

  //#region PUT METHODS
  // *************************************************
  // **************** PUT METHODS ********************
  // *************************************************

  @Put(':id')
  @ApiOperation({
    summary: 'Update employee',
    description: 'Update an existing employee within the company',
  })
  @ApiParam({
    name: 'id',
    description: 'Employee ID',
    type: Number,
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Employee updated successfully',
    type: CompanyContactResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Employee not found or access denied',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input data or duplicate employee',
  })
  async updateCompanyContact(
    @CurrentUser('withCompany') user: UserWithCompany,
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateAddressBookDto,
  ): Promise<CompanyContactResponseDto> {
    return this.employeeService.updateEmployee(user.company.id, id, updateDto);
  }

  @Put('order/bulk')
  @ApiOperation({
    summary: 'Update order of multiple employees',
    description:
      'Update the display order of multiple employees within the company',
  })
  @ApiResponse({
    status: 200,
    description: 'Employee order updated successfully',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Employee order updated successfully',
        },
        updatedCount: { type: 'number', example: 5 },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @HttpCode(HttpStatus.OK)
  async updateCompanyContactsOrder(
    @CurrentUser('withCompany') user: UserWithCompany,
    @Body() orderUpdates: AddressBookOrderDto[],
  ): Promise<{ message: string; updatedCount: number }> {
    return this.employeeService.updateEmployeesOrder(
      user.company.id,
      orderUpdates,
    );
  }
  //#endregion PUT METHODS

  //#region DELETE METHODS
  // *************************************************
  // **************** DELETE METHODS *****************
  // *************************************************
  @Delete('bulk')
  @ApiOperation({
    summary: 'Bulk delete employees',
    description: 'Delete multiple employees at once within the company',
  })
  @ApiResponse({
    status: 200,
    description: 'Employees deleted successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        deletedCount: { type: 'number' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @HttpCode(HttpStatus.OK)
  async bulkDeleteContacts(
    @CurrentUser('withCompany') user: UserWithCompany,
    @Body('ids') ids: number[],
  ) {
    return this.employeeService.bulkDeleteEmployees(user.company.id, ids);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete employee',
    description: 'Delete a employee by ID within the company',
  })
  @ApiParam({
    name: 'id',
    description: 'Employee ID',
    type: Number,
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Employee deleted successfully',
    schema: {
      type: 'object',
      properties: { message: { type: 'string' } },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Employee not found or access denied',
  })
  async deleteCompanyContact(
    @CurrentUser('withCompany') user: UserWithCompany,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.employeeService.deleteEmployee(user.company.id, id);
  }

  //#endregion DELETE METHODS
}
