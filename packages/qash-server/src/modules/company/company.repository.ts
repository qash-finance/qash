import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CompanyModel } from '../../database/generated/models/Company';
import {
  CompanyTypeEnum,
  CompanyVerificationStatusEnum,
  Prisma,
  PrismaClient,
  TeamMemberRoleEnum,
} from '../../database/generated/client';
import {
  BaseRepository,
  PrismaTransactionClient,
} from 'src/database/base.repository';

export interface CreateCompanyData {
  companyName: string;
  registrationNumber: string;
  companyType: CompanyTypeEnum;
  country: string;
  address1: string;
  address2?: string;
  city: string;
  postalCode: string;
  metadata?: any;
}

export interface UpdateCompanyData {
  companyName?: string;
  companyType?: CompanyTypeEnum;
  country?: string;
  address1?: string;
  address2?: string;
  city?: string;
  postalCode?: string;
  verificationStatus?: CompanyVerificationStatusEnum;
  isActive?: boolean;
  metadata?: any;
}

export interface CompanyWithRelations extends CompanyModel {
  teamMembers?: any[];
  creator?: any;
}

export interface CompanyFilters {
  verificationStatus?: CompanyVerificationStatusEnum;
  companyType?: CompanyTypeEnum;
  country?: string;
  isActive?: boolean;
  search?: string; // Search in company name or registration number
}

@Injectable()
export class CompanyRepository extends BaseRepository<
  CompanyModel,
  Prisma.CompanyWhereInput,
  Prisma.CompanyCreateInput,
  Prisma.CompanyUpdateInput
> {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  protected getModel(tx?: PrismaTransactionClient): PrismaClient['company'] {
    return tx ? tx.company : this.prisma.company;
  }

  protected getModelName(): string {
    return 'Company';
  }

  /**
   * Create new company
   */
  async create(
    data: CreateCompanyData,
    tx?: PrismaTransactionClient,
  ): Promise<CompanyModel> {
    const client = tx || this.prisma;
    return client.company.create({
      data: data as Prisma.CompanyCreateInput,
    });
  }

  /**
   * Find company by ID
   */
  async findById(
    id: number,
    tx?: PrismaTransactionClient,
  ): Promise<CompanyModel | null> {
    return this.findOne({ id }, tx);
  }

  /**
   * Find company by registration number
   */
  async findByRegistrationNumber(
    registrationNumber: string,
    tx?: PrismaTransactionClient,
  ): Promise<CompanyModel | null> {
    return this.findOne({ registrationNumber }, tx);
  }

  /**
   * Find company with team members
   */
  async findByIdWithTeamMembers(
    id: number,
    tx?: PrismaTransactionClient,
  ): Promise<CompanyWithRelations | null> {
    const model = this.getModel(tx);
    return model.findUnique({
      where: { id },
      include: {
        teamMembers: {
          where: { isActive: true },
          orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
          select: {
            id: true,
            firstName: true,
            lastName: true,
            position: true,
            profilePicture: true,
            role: true,
            isActive: true,
            joinedAt: true,
            createdAt: true,
          },
        },
      },
    });
  }

  /**
   * Find companies by user (created by user)
   */
  async findByOwner(
    userId: number,
    filters?: CompanyFilters,
    tx?: PrismaTransactionClient,
  ): Promise<CompanyModel[]> {
    const whereClause: any = {
      teamMembers: {
        some: {
          userId,
          role: TeamMemberRoleEnum.OWNER,
          isActive: true,
        },
      },
    };

    if (filters) {
      if (filters.verificationStatus) {
        whereClause.verificationStatus = filters.verificationStatus;
      }
      if (filters.companyType) {
        whereClause.companyType = filters.companyType;
      }
      if (filters.country) {
        whereClause.country = filters.country;
      }
      if (typeof filters.isActive === 'boolean') {
        whereClause.isActive = filters.isActive;
      }
      if (filters.search) {
        whereClause.OR = [
          { companyName: { contains: filters.search, mode: 'insensitive' } },
          {
            registrationNumber: {
              contains: filters.search,
              mode: 'insensitive',
            },
          },
        ];
      }
    }

    return this.findMany(whereClause, { orderBy: { createdAt: 'desc' } }, tx);
  }

  /**
   * Update company by ID
   */
  async updateById(
    id: number,
    data: UpdateCompanyData,
    tx?: PrismaTransactionClient,
  ): Promise<CompanyModel> {
    return this.update({ id }, data as Prisma.CompanyUpdateInput, tx);
  }

  /**
   * Check if user owns company (through TeamMember OWNER role)
   */
  async isCompanyOwner(
    companyId: number,
    userId: number,
    tx?: PrismaTransactionClient,
  ): Promise<boolean> {
    const client = tx || this.prisma;
    const teamMember = await client.teamMember.findFirst({
      where: {
        companyId,
        userId,
        role: TeamMemberRoleEnum.OWNER,
        isActive: true,
      },
    });
    return !!teamMember;
  }

  /**
   * Get company statistics
   */
  async getStats(userId?: number, tx?: PrismaTransactionClient) {
    const model = this.getModel(tx);
    // If userId is provided, filter by companies where user is OWNER
    const whereClause = userId
      ? {
          teamMembers: {
            some: {
              userId,
              role: TeamMemberRoleEnum.OWNER,
              isActive: true,
            },
          },
        }
      : {};

    const [total, verified, pending, underReview, rejected] = await Promise.all(
      [
        model.count({ where: whereClause }),
        model.count({
          where: { ...whereClause, verificationStatus: 'VERIFIED' },
        }),
        model.count({
          where: { ...whereClause, verificationStatus: 'PENDING' },
        }),
        model.count({
          where: { ...whereClause, verificationStatus: 'UNDER_REVIEW' },
        }),
        model.count({
          where: { ...whereClause, verificationStatus: 'REJECTED' },
        }),
      ],
    );

    return {
      total,
      verified,
      pending,
      underReview,
      rejected,
    };
  }

  /**
   * Search companies (admin function)
   */
  async searchCompanies(
    filters: CompanyFilters & { skip?: number; take?: number },
    tx?: PrismaTransactionClient,
  ) {
    const model = this.getModel(tx);
    const { skip = 0, take = 20, ...searchFilters } = filters;
    const whereClause: any = {};

    if (searchFilters.verificationStatus) {
      whereClause.verificationStatus = searchFilters.verificationStatus;
    }
    if (searchFilters.companyType) {
      whereClause.companyType = searchFilters.companyType;
    }
    if (searchFilters.country) {
      whereClause.country = searchFilters.country;
    }
    if (typeof searchFilters.isActive === 'boolean') {
      whereClause.isActive = searchFilters.isActive;
    }
    if (searchFilters.search) {
      whereClause.OR = [
        {
          companyName: { contains: searchFilters.search, mode: 'insensitive' },
        },
        {
          registrationNumber: {
            contains: searchFilters.search,
            mode: 'insensitive',
          },
        },
      ];
    }

    const [companies, total] = await Promise.all([
      model.findMany({
        where: whereClause,
        include: {
          _count: {
            select: { teamMembers: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      model.count({ where: whereClause }),
    ]);

    return {
      companies,
      total,
      hasMore: skip + take < total,
    };
  }

  /**
   * Delete company (soft delete by deactivating)
   */
  async deactivate(
    id: number,
    tx?: PrismaTransactionClient,
  ): Promise<CompanyModel> {
    return this.update({ id }, { isActive: false }, tx);
  }

  /**
   * Activate company
   */
  async activate(
    id: number,
    tx?: PrismaTransactionClient,
  ): Promise<CompanyModel> {
    return this.update({ id }, { isActive: true }, tx);
  }
}
