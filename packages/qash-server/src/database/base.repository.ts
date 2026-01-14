import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { PrismaClient } from './generated/client';

// Transaction client type for Prisma
// This is the type of the client passed to $transaction callbacks
export type PrismaTransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

// Helper type to extract model delegate type from PrismaClient or PrismaTransactionClient
export type PrismaModelDelegate<
  TClient extends PrismaClient | PrismaTransactionClient,
  TModelName extends keyof TClient,
> = TClient[TModelName];

// Common interface for Prisma model delegates
// This represents the methods available on all Prisma model delegates
export interface PrismaDelegateBase {
  findFirst: (args?: any) => Promise<any>;
  findMany: (args?: any) => Promise<any[]>;
  findUnique: (args: any) => Promise<any>;
  create: (args: any) => Promise<any>;
  createMany: (args: any) => Promise<{ count: number }>;
  update: (args: any) => Promise<any>;
  updateMany: (args: any) => Promise<{ count: number }>;
  upsert: (args: any) => Promise<any>;
  delete: (args: any) => Promise<any>;
  deleteMany: (args: any) => Promise<{ count: number }>;
  count: (args?: any) => Promise<number>;
  aggregate: (args?: any) => Promise<any>;
  groupBy: (args?: any) => Promise<any>;
}

// Pagination options interface
export interface PaginationOptions {
  page?: number;
  limit?: number;
  orderBy?: Record<string, 'asc' | 'desc'>;
}

// Paginated result interface
export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

@Injectable()
export abstract class BaseRepository<
  TModel,
  TWhereInput,
  TCreateInput,
  TUpdateInput,
  TDelegate extends PrismaDelegateBase = any,
> {
  protected readonly logger = new Logger(this.constructor.name);

  constructor(protected readonly prisma: PrismaService) {}

  /**
   * Get the Prisma model - must be implemented by child classes
   */
  protected abstract getModel(tx?: PrismaTransactionClient): TDelegate;

  /**
   * Get the model name for logging and error messages
   */
  protected abstract getModelName(): string;

  /**
   * Find a single record by where condition
   */
  async findOne(
    where: TWhereInput,
    tx?: PrismaTransactionClient,
  ): Promise<TModel | null> {
    try {
      const model = this.getModel(tx);
      const result = await model.findFirst({ where });

      return result;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Find multiple records with enhanced options
   */
  async findMany(
    where: TWhereInput,
    options?: {
      skip?: number;
      take?: number;
      orderBy?: any;
      include?: any;
      select?: any;
    },
    tx?: PrismaTransactionClient,
  ): Promise<TModel[]> {
    try {
      const model = this.getModel(tx);
      const result = await model.findMany({
        where,
        ...options,
      });

      return result;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Find records with pagination
   */
  async findManyPaginated(
    where: TWhereInput,
    pagination: PaginationOptions,
    options?: {
      include?: any;
      select?: any;
    },
    tx?: PrismaTransactionClient,
  ): Promise<PaginatedResult<TModel>> {
    const page = Math.max(1, pagination.page || 1);
    const limit = Math.min(100, Math.max(1, pagination.limit || 10));
    const skip = (page - 1) * limit;

    try {
      const model = this.getModel(tx);

      const [data, total] = await Promise.all([
        model.findMany({
          where,
          skip,
          take: limit,
          orderBy: pagination.orderBy || { id: 'desc' },
          ...options,
        }),
        model.count({ where }),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        data,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Create a new record with automatic timestamps
   */
  async create(
    data: TCreateInput,
    tx?: PrismaTransactionClient,
  ): Promise<TModel> {
    try {
      const model = this.getModel(tx);
      const now = new Date();

      const result = await model.create({
        data: {
          createdAt: now,
          updatedAt: now,
          ...data,
        },
      });

      return result;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Create multiple records in batch
   */
  async createMany(
    data: TCreateInput[],
    tx?: PrismaTransactionClient,
  ): Promise<{ count: number }> {
    try {
      const model = this.getModel(tx);
      const now = new Date();

      const dataWithTimestamps = data.map((item) => ({
        createdAt: now,
        updatedAt: now,
        ...item,
      }));

      const result = await model.createMany({
        data: dataWithTimestamps,
        skipDuplicates: false,
      });

      return result;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update a single record
   */
  async update(
    where: TWhereInput,
    data: TUpdateInput,
    tx?: PrismaTransactionClient,
  ): Promise<TModel> {
    try {
      const model = this.getModel(tx);

      // First check if record exists
      const existing = await this.findOne(where, tx);
      if (!existing) {
        throw new NotFoundException(
          `${this.getModelName()} record not found for update`,
        );
      }

      const result = await model.update({
        where: { id: (existing as any).id },
        data: {
          ...data,
          updatedAt: new Date(),
        },
      });

      return result;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update multiple records
   */
  async updateMany(
    where: TWhereInput,
    data: TUpdateInput,
    tx?: PrismaTransactionClient,
  ): Promise<{ count: number }> {
    try {
      const model = this.getModel(tx);

      const result = await model.updateMany({
        where,
        data: {
          ...data,
          updatedAt: new Date(),
        },
      });
      return result;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Upsert (create or update) a record
   */
  async upsert(
    where: TWhereInput,
    create: TCreateInput,
    update: TUpdateInput,
    tx?: PrismaTransactionClient,
  ): Promise<TModel> {
    try {
      const model = this.getModel(tx);
      const now = new Date();

      const result = await model.upsert({
        where,
        create: {
          createdAt: now,
          updatedAt: now,
          ...create,
        },
        update: {
          ...update,
          updatedAt: now,
        },
      });

      return result;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Delete a single record
   */
  async delete(
    where: TWhereInput,
    tx?: PrismaTransactionClient,
  ): Promise<TModel> {
    try {
      const model = this.getModel(tx);

      // First check if record exists
      const existing = await this.findOne(where, tx);
      if (!existing) {
        throw new NotFoundException(
          `${this.getModelName()} record not found for deletion`,
        );
      }

      const result = await model.delete({
        where: { id: (existing as any).id },
      });

      return result;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Delete multiple records
   */
  async deleteMany(
    where: TWhereInput,
    tx?: PrismaTransactionClient,
  ): Promise<{ count: number }> {
    try {
      const model = this.getModel(tx);
      const result = await model.deleteMany({ where });

      return result;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Count records matching criteria
   */
  async count(
    where: TWhereInput,
    tx?: PrismaTransactionClient,
  ): Promise<number> {
    try {
      const model = this.getModel(tx);
      const result = await model.count({ where });

      return result;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Check if any records exist matching criteria
   */
  async exists(
    where: TWhereInput,
    tx?: PrismaTransactionClient,
  ): Promise<boolean> {
    try {
      const count = await this.count(where, tx);
      return count > 0;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Find first record or throw NotFoundException
   */
  async findOneOrFail(
    where: TWhereInput,
    tx?: PrismaTransactionClient,
  ): Promise<TModel> {
    const result = await this.findOne(where, tx);
    if (!result) {
      throw new NotFoundException(`${this.getModelName()} record not found`);
    }
    return result;
  }
}
