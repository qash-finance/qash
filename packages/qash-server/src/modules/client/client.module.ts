import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { CompanyModule } from '../company/company.module';
import { TeamMemberModule } from '../team-member/team-member.module';
import { ClientController } from './client.controller';
import { ClientService } from './services/client.service';
import { ClientRepository } from './repositories/client.repository';

@Module({
  imports: [PrismaModule, forwardRef(() => AuthModule), CompanyModule, TeamMemberModule],
  controllers: [ClientController],
  providers: [ClientService, ClientRepository],
  exports: [ClientService, ClientRepository],
})
export class ClientModule {}

