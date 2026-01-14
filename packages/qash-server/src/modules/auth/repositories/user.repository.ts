import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { UserModel } from '../../../database/generated/models/User';
import {
  BaseRepository,
  PrismaTransactionClient,
} from 'src/database/base.repository';
import { Prisma, PrismaClient } from 'src/database/generated/client';

export interface CreateUserData {
  email: string;
  isActive?: boolean;
}

export interface UpdateUserData {
  isActive?: boolean;
  lastLogin?: Date;
}

@Injectable()
export class UserRepository extends BaseRepository<
  UserModel,
  Prisma.UserWhereInput,
  Prisma.UserCreateInput,
  Prisma.UserUpdateInput
> {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  protected getModel(tx?: PrismaTransactionClient): PrismaClient['user'] {
    return tx ? tx.user : this.prisma.user;
  }

  protected getModelName(): string {
    return 'User';
  }

  /**
   * Find user by email
   */
  async findByEmail(
    email: string,
    tx?: PrismaTransactionClient,
  ): Promise<UserModel | null> {
    return this.findOne({ email }, tx);
  }

  /**
   * Find user by ID
   */
  async findById(
    id: number,
    tx?: PrismaTransactionClient,
  ): Promise<UserModel | null> {
    return this.findOne({ id }, tx);
  }

  /**
   * Create new user
   */
  async create(
    data: CreateUserData,
    tx?: PrismaTransactionClient,
  ): Promise<UserModel> {
    const model = this.getModel(tx);
    return model.create({
      data: {
        email: data.email,
        isActive: data.isActive ?? true,
      },
    });
  }

  /**
   * Update user by ID
   */
  async updateById(
    id: number,
    data: UpdateUserData,
    tx?: PrismaTransactionClient,
  ): Promise<UserModel> {
    const model = this.getModel(tx);
    return model.update({
      where: { id },
      data,
    });
  }

  /**
   * Get user profile (safe fields only)
   */
  async getProfile(id: number, tx?: PrismaTransactionClient) {
    const model = this.getModel(tx);
    return model.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        isActive: true,
        createdAt: true,
        lastLogin: true,
      },
    });
  }

  /**
   * Check if user exists and is active
   */
  async isActiveUser(
    id: number,
    tx?: PrismaTransactionClient,
  ): Promise<boolean> {
    const model = this.getModel(tx);
    const user = await model.findUnique({
      where: { id },
      select: { isActive: true },
    });
    return user?.isActive ?? false;
  }

  /**
   * Deactivate user
   */
  async deactivate(
    id: number,
    tx?: PrismaTransactionClient,
  ): Promise<UserModel> {
    const model = this.getModel(tx);
    return model.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /**
   * Activate user
   */
  async activate(id: number, tx?: PrismaTransactionClient): Promise<UserModel> {
    const model = this.getModel(tx);
    return model.update({
      where: { id },
      data: { isActive: true },
    });
  }

  /**
   * Update last login timestamp
   */
  async updateLastLogin(
    id: number,
    tx?: PrismaTransactionClient,
  ): Promise<UserModel> {
    const model = this.getModel(tx);
    return model.update({
      where: { id },
      data: { lastLogin: new Date() },
    });
  }

  /**
   * Get user with team member and company details
   */
  async findByIdWithCompany(id: number, tx?: PrismaTransactionClient) {
    const model = this.getModel(tx);
    return model.findUnique({
      where: { id },
      include: {
        teamMembership: {
          include: {
            company: true,
          },
        },
      },
    });
  }
}
