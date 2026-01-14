import { Module, forwardRef } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from '../../database/prisma.module';
import { CompanyModule } from '../company/company.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UserRepository } from './repositories/user.repository';
import { ParaJwtStrategy } from './strategies/para-jwt.strategy';
import { ParaJwtAuthGuard } from './guards/para-jwt-auth.guard';
import { CompanyAuthGuard } from './guards/company-auth.guard';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => CompanyModule), // Use forwardRef to avoid circular dependency
    PassportModule.register({ defaultStrategy: 'para-jwt' }),
  ],
  providers: [
    // Services
    AuthService,

    // Repositories
    UserRepository,

    // Auth Strategy & Guards
    ParaJwtStrategy, // Para JWT authentication strategy
    CompanyAuthGuard,
    {
      provide: APP_GUARD,
      useClass: ParaJwtAuthGuard, // Use Para JWT guard as default
    },
  ],
  controllers: [AuthController],
  exports: [
    // Services
    AuthService,

    // Repositories (in case other modules need them)
    UserRepository,

    // Passport
    PassportModule,
  ],
})
export class AuthModule {}
