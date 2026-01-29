import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes, ApiBadRequestResponse } from '@nestjs/swagger';
import { Auth } from '../auth/decorators/auth.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/para-jwt-payload';
import { UploadService } from './upload.service';
import { UploadResponseDto, UploadTypeEnum } from './upload.dto';

@ApiTags('Upload')
@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('avatar')
  @Auth()
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Upload user avatar',
    description: 'Upload a profile picture for the authenticated user',
  })
  @ApiResponse({
    status: 200,
    description: 'Avatar uploaded successfully',
    type: UploadResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid file format or size exceeds limit (max 5MB)',
  })
  @ApiConsumes('multipart/form-data')
  async uploadAvatar(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<UploadResponseDto> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }
    return this.uploadService.uploadFile(file, UploadTypeEnum.AVATAR, user.internalUserId);
  }

  @Post('company-logo')
  @Auth()
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Upload company logo',
    description: 'Upload a logo for the company',
  })
  @ApiResponse({
    status: 200,
    description: 'Company logo uploaded successfully',
    type: UploadResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid file format or size exceeds limit (max 10MB)',
  })
  @ApiConsumes('multipart/form-data')
  async uploadCompanyLogo(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<UploadResponseDto> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }
    return this.uploadService.uploadFile(file, UploadTypeEnum.COMPANY_LOGO, user.internalUserId);
  }

  @Post('multisig-logo')
  @Auth()
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Upload multisig account logo',
    description: 'Upload a logo for a multisig account',
  })
  @ApiResponse({
    status: 200,
    description: 'Multisig logo uploaded successfully',
    type: UploadResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid file format or size exceeds limit (max 10MB)',
  })
  @ApiConsumes('multipart/form-data')
  async uploadMultisigLogo(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<UploadResponseDto> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }
    return this.uploadService.uploadFile(file, UploadTypeEnum.MULTISIG_LOGO, user.internalUserId);
  }
}
