import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ADMIN_KEY } from '../decorators/admin.decorator';
import { AppConfigService } from '../config/config.service';
import { UserRepository } from '../../auth/repositories/user.repository';

@Injectable()
export class AdminGuard implements CanActivate {
  private readonly logger = new Logger(AdminGuard.name);

  constructor(
    private reflector: Reflector,
    private appConfigService: AppConfigService,
    private userRepository: UserRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isAdminRequired = this.reflector.getAllAndOverride<boolean>(
      ADMIN_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!isAdminRequired) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user || !user.internalUserId) {
      throw new ForbiddenException('Authentication required');
    }

    try {
      // Get the full user details from database to check role
      const fullUser = await this.userRepository.findById(user.internalUserId);

      if (!fullUser) {
        throw new ForbiddenException('User not found');
      }

      // Check if user has ADMIN role
      const hasAdminRole = fullUser.role === 'ADMIN';

      // Check if user email matches admin email from environment
      const adminEmail = this.appConfigService.adminConfig.email;
      const isAdminEmail = fullUser.email === adminEmail;

      // User must have ADMIN role OR be the configured admin email
      if (!hasAdminRole && !isAdminEmail) {
        this.logger.warn(
          `Access denied for user ${fullUser.email}. Admin access required.`,
        );
        throw new ForbiddenException('Admin access required');
      }

      this.logger.log(`Admin access granted to user ${fullUser.email}`);

      // Enrich request with full user data including role
      request.user = {
        ...user,
        role: fullUser.role,
        email: fullUser.email,
      };

      return true;
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }

      this.logger.error('Error checking admin access:', error);
      throw new ForbiddenException('Unable to verify admin access');
    }
  }
}
