import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import {
  CompanyVerificationStatusEnum,
  Prisma,
  PrismaClient,
} from '../../../database/generated/client';
import { CompanyModel } from '../../../database/generated/models';
import {
  BaseRepository,
  PrismaTransactionClient,
} from 'src/database/base.repository';

export interface AdminCompanyFilters {
  verificationStatus?: CompanyVerificationStatusEnum;
  country?: string;
  companyType?: string;
  search?: string;
}

export interface AdminCompanyStats {
  totalCompanies: number;
  pendingVerification: number;
  verifiedCompanies: number;
  rejectedCompanies: number;
  companiesByCountry: Record<string, number>;
  companiesByType: Record<string, number>;
}

@Injectable()
export class AdminCompanyRepository extends BaseRepository<
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
   * Update company verification status
   */
  async updateVerificationStatus(
    id: number,
    status: CompanyVerificationStatusEnum,
    adminNotes?: string,
    tx?: PrismaTransactionClient,
  ): Promise<CompanyModel> {
    const model = this.getModel(tx);
    return model.update({
      where: { id },
      data: {
        verificationStatus: status,
        ...(adminNotes && { metadata: { adminNotes } }),
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Get company by ID with full details for admin view
   */
  async findByIdWithFullDetails(
    id: number,
    tx?: PrismaTransactionClient,
  ): Promise<CompanyModel | null> {
    const model = this.getModel(tx);
    return model.findUnique({
      where: { id },
      include: {
        teamMembers: {
          include: {
            user: true,
            inviter: true,
          },
          orderBy: { createdAt: 'asc' },
        },
        contacts: {
          include: {
            group: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 10, // Latest 10 contacts
        },
        _count: {
          select: {
            teamMembers: true,
            contacts: true,
          },
        },
      },
    });
  }
}
