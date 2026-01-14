import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiForbiddenResponse,
} from '@nestjs/swagger';
import { Auth } from '../auth/decorators/auth.decorator';
import {
  CurrentUser,
  UserWithCompany,
} from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/para-jwt-payload';
import { CompanyService } from './company.service';
import {
  CreateCompanyDto,
  UpdateCompanyDto,
  CompanyResponseDto,
  IsEmployeeResponseDto,
} from './company.dto';
import { CompanyModel } from 'src/database/generated/models';
import { CompanyAuth } from '../auth/decorators/company-auth.decorator';

@ApiTags('Company')
@Controller('companies')
export class CompanyController {
  constructor(private readonly companyService: CompanyService) {}

  //#region GET METHODS
  // *************************************************
  // **************** GET METHODS ********************
  // *************************************************
  @Get()
  @CompanyAuth()
  @ApiOperation({
    summary: 'Get my company',
    description: 'Get my company information',
  })
  @ApiResponse({
    status: 200,
    description: 'Company retrieved successfully',
    type: CompanyResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Company not found' })
  @ApiForbiddenResponse({ description: 'Access denied to this company' })
  async getMyCompany(
    @CurrentUser('withCompany') user: UserWithCompany,
  ): Promise<CompanyModel> {
    return this.companyService.getMyCompany(user.company.id);
  }

  @Get('check-employee')
  @Auth()
  @ApiOperation({
    summary: 'Check if user is an employee',
    description:
      'Check if the logged-in user is an employee (has invoices to review)',
  })
  @ApiResponse({
    status: 200,
    description: 'Employee status retrieved successfully',
    type: IsEmployeeResponseDto,
  })
  async checkIfEmployee(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<IsEmployeeResponseDto> {
    const isEmployee = await this.companyService.isUserEmployee(user.email);
    return { isEmployee };
  }
  //#endregion GET METHODS

  //#region POST METHODS
  // *************************************************
  // **************** POST METHODS *******************
  // *************************************************

  @Post()
  @Auth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create new company',
    description: 'Register a new company for KYB verification',
  })
  @ApiResponse({
    status: 201,
    description: 'Company created successfully',
    type: CompanyResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid company data or registration number already exists',
  })
  async createCompany(
    @CurrentUser() user: AuthenticatedUser,
    @Body() createCompanyDto: CreateCompanyDto,
  ): Promise<CompanyModel> {
    return this.companyService.createCompany(
      user.internalUserId,
      createCompanyDto,
    );
  }

  @Put()
  @CompanyAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update company details',
    description: 'Update the current company information (owner/admin only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Company updated successfully',
    type: CompanyResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid company data' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @ApiNotFoundResponse({ description: 'Company not found' })
  async updateCompany(
    @CurrentUser('withCompany') user: UserWithCompany,
    @Body() updateCompanyDto: UpdateCompanyDto,
  ): Promise<CompanyModel> {
    return this.companyService.updateCompany(
      user.company.id,
      user.internalUserId,
      updateCompanyDto,
    );
  }
  //#endregion POST METHODS
}
