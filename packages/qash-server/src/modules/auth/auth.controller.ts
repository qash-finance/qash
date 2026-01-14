import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Get,
  Req,
  Res,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { Public } from './decorators/public.decorator';
import { Auth } from './decorators/auth.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/para-jwt-payload';
import {
  MessageResponseDto,
  UserMeResponseDto,
  SetJwtCookieDto,
  SetJwtCookieResponseDto,
} from './dto/auth.dto';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  //#region GET METHODS
  // *************************************************
  // **************** GET METHODS *******************
  // *************************************************

  @Auth()
  @Get('me')
  @ApiOperation({
    summary: 'Get current user details',
    description:
      'Returns the authenticated user details including team member and company information',
  })
  @ApiResponse({
    status: 200,
    description: 'User details retrieved successfully',
    type: UserMeResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized - Invalid or missing token',
  })
  async getCurrentUser(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<UserMeResponseDto> {
    return this.authService.getCurrentUserWithCompany(user.internalUserId);
  }

  //#endregion GET METHODS

  //#region POST METHODS
  // *************************************************
  // **************** POST METHODS *******************
  // *************************************************

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Logout from current session',
    description: 'Clears the HTTP-only JWT cookie and logs out the user',
  })
  @ApiResponse({
    status: 200,
    description: 'Logged out successfully',
    type: MessageResponseDto,
  })
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<MessageResponseDto> {
    try {
      // Use same logic as cookie setting: detect proxy
      const hasProxy = !!(
        request.get('x-forwarded-proto') || request.headers['x-forwarded-proto']
      );

      let isSecure = false;
      let sameSite: 'lax' | 'none' = 'lax';

      if (hasProxy) {
        // Production (GCP): Behind load balancer
        isSecure = request.protocol === 'https';
        sameSite = isSecure ? ('none' as const) : ('lax' as const);
      } else {
        // Development (localhost): No proxy
        isSecure = false;
        sameSite = 'lax';
      }

      // Clear the JWT cookie (must match the same options used when setting)
      response.clearCookie('para-jwt', {
        httpOnly: true,
        secure: isSecure,
        sameSite,
        path: '/',
      });

      return { message: 'Logged out successfully' };
    } catch (error) {
      this.logger.error('Logout failed:', error);
      return { message: 'Logged out successfully' };
    }
  }

  @Public()
  @Post('set-cookie')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Set Para JWT cookie',
    description:
      'Validates Para JWT token and sets it as an HTTP-only cookie. Client should call this after getting JWT from Para.',
  })
  @ApiResponse({
    status: 200,
    description: 'Cookie set successfully',
    type: SetJwtCookieResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid or missing JWT token',
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid or expired JWT token',
  })
  async setJwtCookie(
    @Body() setJwtCookieDto: SetJwtCookieDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SetJwtCookieResponseDto> {
    const originalAuth = request.headers.authorization;
    request.headers.authorization = `Bearer ${setJwtCookieDto.token}`;

    try {
      return await this.authService.validateAndSetJwtCookie(
        setJwtCookieDto.token,
        response,
        request,
      );
    } finally {
      // Restore original authorization header
      request.headers.authorization = originalAuth;
    }
  }

  //#endregion POST METHODS
}
