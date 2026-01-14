import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ParaJwtAuthGuard } from './para-jwt-auth.guard';
import { AuthService } from '../auth.service';
import { CompanyService } from '../../company/company.service';
import { ErrorAuth, ErrorCompany } from 'src/common/constants/errors';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class CompanyAuthGuard extends ParaJwtAuthGuard {
  private readonly companyAuthLogger = new Logger(CompanyAuthGuard.name);

  constructor(
    reflector: Reflector,
    authService: AuthService,
    private readonly companyService: CompanyService,
  ) {
    super(reflector, authService);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if route is public - if so, skip authentication
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    // First, run the Para JWT authentication (which syncs user)
    const canActivate = await super.canActivate(context);
    if (!canActivate) {
      return false;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Use email from Para JWT token (common identifier between Para and our DB)
    const userEmail = user?.email;

    if (!user || !userEmail) {
      throw new UnauthorizedException(ErrorAuth.NotAuthenticated);
    }

    try {
      const company =
        await this.companyService.getCompanyByUserEmail(userEmail);

      if (!company) {
        throw new UnauthorizedException(
          ErrorCompany.UserNotAssociatedWithCompany,
        );
      }

      request.user = {
        ...user,
        company,
      };

      return true;
    } catch (error) {
      this.companyAuthLogger.error(
        `Failed to fetch company for user email ${userEmail}:`,
        error,
      );
      throw new UnauthorizedException(ErrorCompany.FailedToFetchCompany);
    }
  }
}
