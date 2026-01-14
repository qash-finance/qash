import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { handleError } from '../../../common/utils/errors';
import { ErrorClient } from '../../../common/constants/errors';
import {
  PaginatedResult,
  PrismaTransactionClient,
} from '../../../database/base.repository';
import { Client, Prisma } from 'src/database/generated/client';
import { PrismaService } from '../../../database/prisma.service';
import { ClientRepository } from '../repositories/client.repository';
import { CreateClientDto, UpdateClientDto } from '../client.dto';

@Injectable()
export class ClientService {
  private readonly logger = new Logger(ClientService.name);

  constructor(
    private readonly clientRepository: ClientRepository,
    private readonly prisma: PrismaService,
  ) {}

  async getClients(
    companyId: number,
    options: { page?: number; limit?: number; search?: string } = {},
  ): Promise<PaginatedResult<Client>> {
    try {
      const { page = 1, limit = 10, search } = options;

      const where: Prisma.ClientWhereInput = {
        companyId,
      };

      if (search) {
        where.OR = [
          { email: { contains: search, mode: 'insensitive' } },
          { companyName: { contains: search, mode: 'insensitive' } },
          { country: { contains: search, mode: 'insensitive' } },
          { city: { contains: search, mode: 'insensitive' } },
        ];
      }

      return this.clientRepository.findManyPaginated(where, {
        page,
        limit,
        orderBy: { id: 'desc' },
      });
    } catch (error) {
      this.logger.error('Failed to get clients', error);
      handleError(error, this.logger);
    }
  }

  async getClientById(companyId: number, uuid: string): Promise<Client> {
    try {
      const client = await this.clientRepository.findOne({
        uuid,
        companyId,
      });

      if (!client) {
        throw new NotFoundException(ErrorClient.NotFound);
      }

      return client;
    } catch (error) {
      this.logger.error('Failed to get client by uuid', error);
      handleError(error, this.logger);
    }
  }

  async createClient(
    companyId: number,
    payload: CreateClientDto,
  ): Promise<Client> {
    try {
      return await this.prisma.$transaction(
        async (tx: PrismaTransactionClient) => {
          const exists = await this.clientRepository.exists(
            {
              companyId,
              email: payload.email,
            },
            tx,
          );

          if (exists) {
            throw new BadRequestException(ErrorClient.EmailAlreadyExists);
          }

          return this.clientRepository.create(
            {
              company: { connect: { id: companyId } },
              email: payload.email,
              companyName: payload.companyName,
              companyType: payload.companyType,
              country: payload.country,
              state: payload.state,
              city: payload.city,
              address1: payload.address1,
              address2: payload.address2,
              taxId: payload.taxId,
              postalCode: payload.postalCode,
              registrationNumber: payload.registrationNumber,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
            tx,
          );
        },
      );
    } catch (error) {
      this.logger.error('Failed to create client', error);
      handleError(error, this.logger);
    }
  }

  async updateClient(
    companyId: number,
    uuid: string,
    payload: UpdateClientDto,
  ): Promise<Client> {
    try {
      return await this.prisma.$transaction(
        async (tx: PrismaTransactionClient) => {
          const existing = await this.clientRepository.findOne(
            {
              uuid,
              companyId,
            },
            tx,
          );

          if (!existing) {
            throw new NotFoundException(ErrorClient.NotFound);
          }

          if (payload.email && payload.email !== existing.email) {
            const emailInUse = await this.clientRepository.findOne(
              {
                companyId,
                email: payload.email,
              },
              tx,
            );

            if (emailInUse && emailInUse.uuid !== uuid) {
              throw new BadRequestException(ErrorClient.EmailAlreadyExists);
            }
          }

          return this.clientRepository.update(
            { uuid, companyId },
            {
              email: payload.email,
              companyName: payload.companyName,
              companyType: payload.companyType,
              country: payload.country,
              state: payload.state,
              city: payload.city,
              address1: payload.address1,
              address2: payload.address2,
              taxId: payload.taxId,
              postalCode: payload.postalCode,
              registrationNumber: payload.registrationNumber,
            },
            tx,
          );
        },
      );
    } catch (error) {
      this.logger.error('Failed to update client', error);
      handleError(error, this.logger);
    }
  }

  async deleteClient(companyId: number, uuid: string): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx: PrismaTransactionClient) => {
        await this.clientRepository.delete(
          {
            uuid,
            companyId,
          },
          tx,
        );
      });
    } catch (error) {
      this.logger.error('Failed to delete client', error);
      handleError(error, this.logger);
    }
  }
}
