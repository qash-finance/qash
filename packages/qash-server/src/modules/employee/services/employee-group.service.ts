import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { CreateCompanyGroupDto } from '../employee.dto';
import { PrismaService } from '../../../database/prisma.service';
import { sanitizeInput } from 'src/common/utils/sanitize';
import { EmployeeGroupRepository } from '../repositories/employee-group.repository';
import { CompanyModel } from 'src/database/generated/models';
import { handleError } from 'src/common/utils/errors';
import { ErrorEmployeeGroup } from 'src/common/constants/errors';

@Injectable()
export class EmployeeGroupService {
  private readonly logger = new Logger(EmployeeGroupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly employeeGroupRepository: EmployeeGroupRepository,
  ) {}

  /**
   * Get all groups for a company
   */
  async getAllEmployeeGroups(companyId: number) {
    try {
      return this.employeeGroupRepository.findMany(
        { companyId },
        { orderBy: { order: 'asc' } },
      );
    } catch (error) {
      this.logger.error('Failed to get all employee groups:', error);
      handleError(error, this.logger);
    }
  }

  /**
   * Create a new group
   */
  async createNewEmployeeGroup(
    dto: CreateCompanyGroupDto,
    company: CompanyModel,
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        dto = sanitizeInput(dto);
        // Check if group already exists
        const existingCompanyGroup = await this.employeeGroupRepository.findOne(
          {
            name: dto.name,
            shape: dto.shape,
            color: dto.color,
            companyId: company.id,
          },
          tx,
        );
        if (existingCompanyGroup) {
          throw new BadRequestException(ErrorEmployeeGroup.GroupAlreadyExists);
        }
        // Get next order
        const order = await this.employeeGroupRepository.getNextOrder(
          company.id,
          tx,
        );
        const newCompanyGroup = await this.employeeGroupRepository.create(
          {
            name: dto.name,
            shape: dto.shape,
            color: dto.color,
            order,
            company: { connect: { id: company.id } },
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          tx,
        );
        return newCompanyGroup;
      });
    } catch (error) {
      this.logger.error('Failed to create new employee group:', error);
      handleError(error, this.logger);
    }
  }
}
