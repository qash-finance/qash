import { applyDecorators, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { CompanyAuthGuard } from '../guards/company-auth.guard';

/**
 * Composite decorator for routes that require authentication and company context.
 * This decorator:
 * 1. Validates JWT token
 * 2. Fetches user's company information
 * 3. Enriches the user object with company data
 *
 * Use with @CurrentUser('withCompany') to get UserWithCompany object
 *
 * @example
 * ```typescript
 * @CompanyAuth()
 * @Get('contacts')
 * getContacts(@CurrentUser('withCompany') user: UserWithCompany) {
 *   const companyId = user.company.id; // Company is auto-attached!
 *   return this.contactService.getContacts(companyId);
 * }
 * ```
 */
export function CompanyAuth() {
  return applyDecorators(
    UseGuards(CompanyAuthGuard),
    ApiBearerAuth(),
    ApiUnauthorizedResponse({
      description:
        'Unauthorized - Invalid token or user not associated with company',
    }),
  );
}
