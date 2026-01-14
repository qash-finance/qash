import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { MailModule } from '../mail/mail.module';
import { CompanyModule } from '../company/company.module';
import { TeamMemberRepository } from './team-member.repository';
import { TeamMemberService } from './team-member.service';
import { TeamMemberController } from './team-member.controller';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    MailModule,
    forwardRef(() => CompanyModule),
  ],
  providers: [TeamMemberRepository, TeamMemberService],
  controllers: [TeamMemberController],
  exports: [TeamMemberService, TeamMemberRepository],
})
export class TeamMemberModule {}
