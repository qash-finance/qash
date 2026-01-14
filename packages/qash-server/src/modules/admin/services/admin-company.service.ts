import {
  Injectable,
  NotFoundException,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import {
  CompanyVerificationStatusEnum,
  UserRoleEnum,
} from '../../../database/generated/client';
import { AdminCompanyRepository } from '../repositories/admin-company.repository';
import { PrismaService } from 'src/database/prisma.service';
import {
  ErrorAdmin,
  ErrorCompany,
  ErrorUser,
} from 'src/common/constants/errors';
import { UserRepository } from 'src/modules/auth/repositories/user.repository';
import { handleError } from 'src/common/utils/errors';

@Injectable()
export class AdminCompanyService {
  private readonly logger = new Logger(AdminCompanyService.name);

  constructor(
    private readonly adminCompanyRepository: AdminCompanyRepository,
    private readonly userRepository: UserRepository,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Update company verification status
   */
  async updateVerificationStatus(
    userId: number,
    companyId: number,
    status: CompanyVerificationStatusEnum,
    adminNotes?: string,
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        // First need to check if user is an admin
        const user = await this.userRepository.findById(userId, tx);
        if (!user) {
          throw new NotFoundException(ErrorUser.NotFound);
        }

        // If user is not an admin, throw an error
        if (user.role !== UserRoleEnum.ADMIN) {
          throw new ForbiddenException(ErrorAdmin.NotAuthorized);
        }

        const company =
          await this.adminCompanyRepository.findByIdWithFullDetails(
            companyId,
            tx,
          );

        if (!company) {
          throw new NotFoundException(ErrorCompany.CompanyNotFound);
        }

        const updatedCompany =
          await this.adminCompanyRepository.updateVerificationStatus(
            companyId,
            status,
            adminNotes,
            tx,
          );

        return updatedCompany;
      });
    } catch (error) {
      this.logger.error('Failed to update company verification status:', error);
      handleError(error, this.logger);
    }
  }
}
