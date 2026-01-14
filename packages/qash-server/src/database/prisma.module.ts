import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { AppConfigService } from 'src/modules/shared/config/config.service';

@Global()
@Module({
  providers: [PrismaService, AppConfigService],
  exports: [PrismaService, AppConfigService],
})
export class PrismaModule {}
