import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';

export const handleError = (error: any, logger: Logger) => {
  if (
    error instanceof BadRequestException ||
    error instanceof InternalServerErrorException ||
    error instanceof NotFoundException ||
    error instanceof ForbiddenException ||
    error instanceof ConflictException
  ) {
    throw error;
  }
  logger.error(error);
  throw new InternalServerErrorException(error.message);
};
