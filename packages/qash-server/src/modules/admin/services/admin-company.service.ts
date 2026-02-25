import {
  Injectable,
  NotFoundException,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import {
  CompanyVerificationStatusEnum,
  NotificationsTypeEnum,
  TeamMemberStatusEnum,
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
import { NotificationService } from 'src/modules/notification/notification.service';
import { handleError } from 'src/common/utils/errors';

@Injectable()
export class AdminCompanyService {
  private readonly logger = new Logger(AdminCompanyService.name);

  constructor(
    private readonly adminCompanyRepository: AdminCompanyRepository,
    private readonly userRepository: UserRepository,
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
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
      const updatedCompany = await this.prisma.$transaction(async (tx) => {
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

      if (
        status === CompanyVerificationStatusEnum.VERIFIED ||
        status === CompanyVerificationStatusEnum.REJECTED
      ) {
        setTimeout(async () => {
          await this.notifyCompanyVerificationStatusChanged(
            companyId,
            status,
            adminNotes,
          );
        }, 0);
      }

      return updatedCompany;
    } catch (error) {
      this.logger.error('Failed to update company verification status:', error);
      handleError(error, this.logger);
    }
  }

  private async notifyCompanyVerificationStatusChanged(
    companyId: number,
    status: CompanyVerificationStatusEnum,
    adminNotes?: string,
  ): Promise<void> {
    try {
      const type =
        status === CompanyVerificationStatusEnum.VERIFIED
          ? NotificationsTypeEnum.COMPANY_VERIFIED
          : NotificationsTypeEnum.COMPANY_VERIFICATION_REJECTED;

      const title =
        status === CompanyVerificationStatusEnum.VERIFIED
          ? 'Company Verified'
          : 'Company Verification Rejected';

      const message =
        status === CompanyVerificationStatusEnum.VERIFIED
          ? 'Your company verification has been approved.'
          : 'Your company verification was rejected. Please review the notes and resubmit.';

      const teamMembers = await this.prisma.teamMember.findMany({
        where: {
          companyId,
          status: TeamMemberStatusEnum.ACTIVE,
        },
        include: { user: true },
      });

      const userIds = new Set<number>();
      for (const member of teamMembers) {
        if (member.user?.id) {
          userIds.add(member.user.id);
        }
      }

      for (const recipientUserId of userIds) {
        await this.notificationService.createNotification({
          title,
          message,
          type,
          userId: recipientUserId,
          metadata: {
            companyId,
            verificationStatus: status,
            adminNotes: adminNotes || null,
          },
        });
      }
    } catch (error) {
      this.logger.error(
        'Failed to send company verification notifications:',
        error,
      );
    }
  }
}
