import { applyDecorators, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
} from '@nestjs/swagger';
import { ParaJwtAuthGuard } from '../../auth/guards/para-jwt-auth.guard';
import { AdminGuard } from '../guards/admin.guard';
import { Admin } from './admin.decorator';

export function AdminAuth() {
  return applyDecorators(
    UseGuards(ParaJwtAuthGuard, AdminGuard),
    Admin(),
    ApiBearerAuth(),
    ApiUnauthorizedResponse({
      description: 'Unauthorized - Invalid or missing token',
    }),
    ApiForbiddenResponse({
      description: 'Forbidden - Admin access required',
    }),
  );
}
