import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { passportJwtSecret } from 'jwks-rsa';
import { Request } from 'express';
import { AppConfigService } from '../../shared/config/config.service';
import { ParaJwtPayload } from '../../../common/interfaces/para-jwt-payload';
import { ErrorAuth } from 'src/common/constants/errors';

@Injectable()
export class ParaJwtStrategy extends PassportStrategy(Strategy, 'para-jwt') {
  private readonly logger = new Logger(ParaJwtStrategy.name);

  constructor(private readonly appConfigService: AppConfigService) {
    const paraConfig = appConfigService.authConfig.para;

    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        // First, try to extract from HTTP-only cookie
        (request: Request) => {
          const token = request?.cookies?.['para-jwt'];
          return token || null;
        },
        // Fallback to Authorization header (for initial token exchange)
        (request: Request) => {
          const token = ExtractJwt.fromAuthHeaderAsBearerToken()(request);
          return token || null;
        },
      ]),
      ignoreExpiration: false,
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: paraConfig.jwksUrl,
      }),
      algorithms: ['RS256'],
    });
  }

  async validate(payload: ParaJwtPayload): Promise<ParaJwtPayload> {
    try {
      // Validate that the token has the required Para structure
      if (!payload.data || !payload.sub) {
        this.logger.error(
          'Invalid token payload structure - missing data or sub',
        );
        throw new UnauthorizedException(ErrorAuth.InvalidToken);
      }

      // Extract email from the payload
      const email = payload.data.email || payload.data.identifier;
      if (!email) {
        this.logger.error(
          'Invalid token payload - missing email or identifier',
        );
        throw new UnauthorizedException(ErrorAuth.InvalidToken);
      }
      // Return the validated payload with normalized structure
      return {
        ...payload,
        email,
        userId: payload.data.userId || payload.sub,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.error(`JWT validation error: ${error.message}`);
      throw new UnauthorizedException(ErrorAuth.InvalidToken);
    }
  }
}
