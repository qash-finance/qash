import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { CompanyModel } from 'src/database/generated/models';
import { AuthenticatedUser } from '../../../common/interfaces/para-jwt-payload';

/**
 * User with company information attached by CompanyAuthGuard
 */
export interface UserWithCompany extends AuthenticatedUser {
  company: CompanyModel;
}

/**
 * Decorator to extract current user from request
 *
 * @example
 * ```typescript
 * // Basic usage - returns AuthenticatedUser (Para JWT + internal user)
 * @Get('profile')
 * getProfile(@CurrentUser() user: AuthenticatedUser) {
 *   return {
 *     userId: user.internalUserId, // Our database user ID
 *     email: user.email,
 *     paraUserId: user.sub // Para's UUID
 *   };
 * }
 *
 * // With company info - returns UserWithCompany
 * @Get('contacts')
 * getContacts(@CurrentUser('withCompany') user: UserWithCompany) {
 *   const companyId = user.company.id; // Auto-attached!
 *   return this.contactService.getContacts(companyId);
 * }
 *
 * // Get specific field
 * @Get('user-id')
 * getUserId(@CurrentUser('internalUserId') userId: number) {
 *   return { userId };
 * }
 * ```
 */
export const CurrentUser = createParamDecorator(
  (
    data: string | undefined,
    ctx: ExecutionContext,
  ): AuthenticatedUser | UserWithCompany | any => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return null;
    }

    if (data === 'withCompany') {
      if (user.company) {
        return user as UserWithCompany;
      } else {
        console.warn(
          'Company not attached to user. Make sure to use @CompanyAuth() decorator.',
        );
        return user;
      }
    }

    if (data && data !== 'withCompany') {
      return user?.[data as keyof AuthenticatedUser];
    }

    return user;
  },
);
