import { Controller, Get, Redirect } from '@nestjs/common';

import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';
import { APP } from './common/constants';
import { Public } from './modules/shared/decorators';
@ApiBearerAuth()
@ApiTags(APP)
@Controller(`/${APP.toLowerCase()}`)
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @Get('/')
  @Redirect('/api-v1', 301)
  public redirect(): void {}
}
