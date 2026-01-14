import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AuthService } from '../auth.service';
import { ErrorAuth } from 'src/common/constants/errors';
import {
  ParaJwtPayload,
  AuthenticatedUser,
} from '../../../common/interfaces/para-jwt-payload';

@Injectable()
export class ParaJwtAuthGuard extends AuthGuard('para-jwt') {
  private readonly logger = new Logger(ParaJwtAuthGuard.name);

  constructor(
    protected reflector: Reflector,
    private authService: AuthService,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    // Use Passport's built-in authentication
    const canActivate = await super.canActivate(context);

    if (!canActivate) {
      this.logger.warn(
        'Passport authentication failed - no valid JWT token found',
      );
      return false;
    }

    const request = context.switchToHttp().getRequest();
    const paraPayload: ParaJwtPayload = request.user;

    if (!paraPayload || !paraPayload.email) {
      this.logger.error('No valid Para JWT payload found in request');
      throw new UnauthorizedException(ErrorAuth.InvalidToken);
    }

    try {
      // Sync user from Para token to our database
      const user = await this.authService.syncUserFromParaToken(paraPayload);

      // Attach our internal user to the request with proper typing
      request.user = {
        ...paraPayload,
        internalUserId: user.id,
        internalUser: user,
      } as AuthenticatedUser;

      return true;
    } catch (error) {
      this.logger.error('Failed to sync user from Para token:', error);
      throw new UnauthorizedException(ErrorAuth.InvalidToken);
    }
  }

  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    if (err || !user) {
      const request = context.switchToHttp().getRequest();
      const hasCookie = !!request?.cookies?.['para-jwt'];
      const hasAuthHeader = !!request?.headers?.authorization;
      const method = request?.method;
      const path = request?.path || request?.url;

      const errorMessage = info?.message || err?.message || 'No auth token';

      this.logger.error(
        `Para JWT authentication failed: ${errorMessage} | ` +
          `Route: ${method} ${path} | ` +
          `Cookie present: ${hasCookie} | ` +
          `Auth header present: ${hasAuthHeader}`,
      );

      throw new UnauthorizedException(errorMessage);
    }
    return user;
  }
}
