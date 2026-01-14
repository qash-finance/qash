import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { CompanyRepository } from './company.repository';
import { TeamMemberRepository } from '../team-member/team-member.repository';
import { EmployeeRepository } from '../employee/repositories/employee.repository';
import {
  CreateCompanyDto,
  UpdateCompanyDto,
  CompanySearchQueryDto,
} from './company.dto';
import { TeamMemberRoleEnum } from '../../database/generated/client';
import { CompanyModel } from 'src/database/generated/models';
import { PrismaService } from 'src/database/prisma.service';
import { ErrorCompany } from 'src/common/constants/errors';
import { handleError } from 'src/common/utils/errors';

@Injectable()
export class CompanyService {
  private readonly logger = new Logger(CompanyService.name);

  constructor(
    private readonly companyRepository: CompanyRepository,
    private readonly teamMemberRepository: TeamMemberRepository,
    private readonly employeeRepository: EmployeeRepository,
    private readonly prisma: PrismaService,
  ) {}

  //#region GET METHODS
  // *************************************************
  // **************** GET METHODS ********************
  // *************************************************
  async getMyCompany(companyId: number): Promise<CompanyModel | null> {
    // find company details, its team members and creator
    return this.companyRepository.findByIdWithTeamMembers(companyId);
  }

  async getCompanyByUserId(userId: number): Promise<CompanyModel | null> {
    const teamMember = await this.teamMemberRepository.findByUserId(userId);
    return teamMember?.company || null;
  }

  /**
   * Get company by user email
   * This is used with Para authentication where we identify users by email
   */
  async getCompanyByUserEmail(userEmail: string): Promise<CompanyModel | null> {
    const teamMember = await this.teamMemberRepository.findByUserEmail(
      userEmail,
    );
    return teamMember?.company || null;
  }

  /**
   * Get company statistics
   */
  async getCompanyStats(userId?: number) {
    return this.companyRepository.getStats(userId);
  }

  /**
   * Search companies (admin function)
   */
  async searchCompanies(
    filters: CompanySearchQueryDto & { skip?: number; take?: number },
  ) {
    return this.companyRepository.searchCompanies(filters);
  }

  /**
   * Get user's role in company
   */
  async getUserRoleInCompany(companyId: number, userId: number) {
    return this.teamMemberRepository.getUserRoleInCompany(companyId, userId);
  }

  /**
   * Get company where user is a team member (single company since 1:1 relationship)
   */
  async getUserMemberCompanies(userId: number) {
    const teamMember = await this.teamMemberRepository.findByUserId(userId);
    return teamMember ? [teamMember] : []; // Return as array for backward compatibility
  }

  /**
   * Check if logged-in user is an employee
   * An employee is someone whose email exists in the Employee table
   */
  async isUserEmployee(userEmail: string): Promise<boolean> {
    try {
      const employee = await this.employeeRepository.findOne({
        email: userEmail,
      });
      return !!employee;
    } catch (error) {
      this.logger.error('Error checking if user is employee:', error);
      handleError(error, this.logger);
    }
  }
  //#endregion GET METHODS

  //#region POST METHODS
  // *************************************************
  // **************** POST METHODS *******************
  // *************************************************
  /**
   * Create new company
   */
  async createCompany(
    userId: number,
    dto: CreateCompanyDto,
  ): Promise<CompanyModel> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existingCompany =
          await this.companyRepository.findByRegistrationNumber(
            dto.registrationNumber,
            tx,
          );

        if (existingCompany) {
          throw new ConflictException(
            ErrorCompany.RegistrationNumberAlreadyExists,
          );
        }

        // Find if the user is already a team member of any company
        const existingTeamMember = await this.teamMemberRepository.findByUserId(
          userId,
          tx,
        );

        if (existingTeamMember) {
          throw new ConflictException(ErrorCompany.UserAlreadyTeamMember);
        }

        const company = await this.companyRepository.create(
          {
            ...(({ companyOwnerFirstName, companyOwnerLastName, ...rest }) =>
              rest)(dto),
          },
          tx,
        );

        await this.teamMemberRepository.create(
          {
            firstName: dto.companyOwnerFirstName,
            lastName: dto.companyOwnerLastName,
            role: TeamMemberRoleEnum.OWNER,
            company: {
              connect: {
                id: company.id,
              },
            },
            user: {
              connect: {
                id: userId,
              },
            },
          },
          tx,
        );

        return company;
      });
    } catch (error) {
      this.logger.error('Failed to create company:', error);
      handleError(error, this.logger);
    }
  }
  //#endregion POST METHODS

  //#region PUT METHODS
  // *************************************************
  // **************** PUT METHODS ********************
  // *************************************************
  /**
   * Update company
   */
  async updateCompany(
    companyId: number,
    userId: number,
    updateCompanyDto: UpdateCompanyDto,
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        // Check if user is owner or admin
        const hasPermission = await this.teamMemberRepository.hasPermission(
          companyId,
          userId,
          [TeamMemberRoleEnum.OWNER, TeamMemberRoleEnum.ADMIN],
          tx,
        );

        if (!hasPermission) {
          throw new ForbiddenException(ErrorCompany.InsufficientPermissions);
        }

        const company = await this.companyRepository.findById(companyId, tx);
        if (!company) {
          throw new NotFoundException(ErrorCompany.CompanyNotFound);
        }

        return this.companyRepository.updateById(companyId, updateCompanyDto);
      });
    } catch (error) {
      this.logger.error('Failed to update company:', error);
      handleError(error, this.logger);
    }
  }

  /**
   * Deactivate company
   */
  async deactivateCompany(companyId: number, userId: number) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        // Only company owner can deactivate
        const isOwner = await this.companyRepository.isCompanyOwner(
          companyId,
          userId,
          tx,
        );
        if (!isOwner) {
          throw new ForbiddenException(
            ErrorCompany.OnlyCompanyOwnerCanDeactivate,
          );
        }

        return this.companyRepository.deactivate(companyId, tx);
      });
    } catch (error) {
      this.logger.error('Failed to deactivate company:', error);
      handleError(error, this.logger);
    }
  }

  /**
   * Activate company
   */
  async activateCompany(companyId: number, userId: number) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        // Only company owner can activate
        const isOwner = await this.companyRepository.isCompanyOwner(
          companyId,
          userId,
          tx,
        );
        if (!isOwner) {
          throw new ForbiddenException(
            ErrorCompany.OnlyCompanyOwnerCanActivate,
          );
        }

        return this.companyRepository.activate(companyId, tx);
      });
    } catch (error) {
      this.logger.error('Failed to activate company:', error);
      handleError(error, this.logger);
    }
  }

  //#endregion PUT METHODS

  //#region Checker Methods
  // *************************************************
  // **************** CHECKER METHODS ***************
  // *************************************************
  /**
   * Check if user has access to company
   */
  async hasCompanyAccess(companyId: number, userId: number): Promise<boolean> {
    // Check if user is company creator
    const isOwner = await this.companyRepository.isCompanyOwner(
      companyId,
      userId,
    );

    if (isOwner) {
      return true;
    }

    // Check if user has any role in the company
    const hasRole = await this.teamMemberRepository.hasPermission(
      companyId,
      userId,
      [
        TeamMemberRoleEnum.OWNER,
        TeamMemberRoleEnum.ADMIN,
        TeamMemberRoleEnum.VIEWER,
      ],
    );

    return hasRole;
  }

  /**
   * Check if user can manage team (owner or admin)
   */
  async canManageTeam(companyId: number, userId: number): Promise<boolean> {
    return this.teamMemberRepository.hasPermission(companyId, userId, [
      TeamMemberRoleEnum.OWNER,
      TeamMemberRoleEnum.ADMIN,
    ]);
  }

  /**
   * Check if user is company owner
   */
  async isCompanyOwner(companyId: number, userId: number): Promise<boolean> {
    return this.companyRepository.isCompanyOwner(companyId, userId);
  }

  /**
   * Validate company exists and user has access
   */
  async validateCompanyAccess(companyId: number, userId: number) {
    const company = await this.companyRepository.findById(companyId);
    if (!company) {
      throw new NotFoundException(ErrorCompany.CompanyNotFound);
    }

    if (!company.isActive) {
      throw new BadRequestException(ErrorCompany.CompanyDeactivated);
    }

    const hasAccess = await this.hasCompanyAccess(companyId, userId);
    if (!hasAccess) {
      throw new ForbiddenException(ErrorCompany.AccessDeniedToCompany);
    }

    return company;
  }

  //#endregion Checker Methods

  //#region Transform Methods
  // *************************************************
  // **************** TRANSFORM METHODS **************
  // *************************************************
  /**
   * Transform company to public-safe format (only companyName and metadata)
   * Used for public endpoints where full company details are not needed
   */
  transformToPublicFormat(company: CompanyModel | null): {
    companyName: string;
    metadata: any;
  } | null {
    if (!company) {
      return null;
    }

    return {
      companyName: company.companyName,
      metadata: company.metadata,
    };
  }
  //#endregion Transform Methods
}
