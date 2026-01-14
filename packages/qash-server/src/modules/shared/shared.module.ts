import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppConfigService } from './config/config.service';
import { AdminGuard } from './guards/admin.guard';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    ConfigModule,
    AuthModule, // Import AuthModule to get UserRepository
  ],
  providers: [AppConfigService, AdminGuard],
  exports: [AppConfigService, AdminGuard],
})
export class SharedModule {}
