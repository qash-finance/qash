import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  CreateContactDto,
  UpdateAddressBookDto,
  AddressBookOrderDto,
} from '../employee.dto';
import { handleError } from '../../../common/utils/errors';
import {
  validateAddress,
  validateName,
  sanitizeString,
} from '../../../common/utils/validation.util';
import {
  ErrorEmployee,
  ErrorEmployeeGroup,
  ErrorQuery,
} from '../../../common/constants/errors';
import { PrismaService } from '../../../database/prisma.service';
import { Employee } from 'src/database/generated/client';
import {
  PaginationOptions,
  PaginatedResult,
} from '../../../database/base.repository';
import { sanitizeInput } from 'src/common/utils/sanitize';
import { EmployeeGroupRepository } from '../repositories/employee-group.repository';
import { EmployeeRepository } from '../repositories/employee.repository';
import { CompanyModel } from 'src/database/generated/models';

@Injectable()
export class EmployeeService {
  private readonly logger = new Logger(EmployeeService.name);

  constructor(
    private readonly employeeRepository: EmployeeRepository,
    private readonly employeeGroupRepository: EmployeeGroupRepository,
    private readonly prisma: PrismaService,
  ) {}

  //# region GET METHODS service
  // *************************************************
  // **************** GET METHODS ********************
  // *************************************************

  /**
   * Get all address book entries for a user with pagination
   */
  async getAllEmployees(
    company: CompanyModel,
    pagination: PaginationOptions,
  ): Promise<PaginatedResult<Employee>> {
    try {
      return this.employeeRepository.findManyPaginated(
        { companyId: company.id },
        pagination,
        {
          include: {
            group: true,
          },
        },
      );
    } catch (error) {
      this.logger.error('Failed to get all employees:', error);
      handleError(error, this.logger);
    }
  }

  /**
   * Search company contacts
   */
  async searchEmployees(
    companyId: number,
    searchTerm: string,
    options: {
      groupId?: number;
      page?: number;
      limit?: number;
    } = {},
  ) {
    try {
      const { groupId, page = 1, limit = 20 } = options;

      if (!searchTerm || searchTerm.length < 2) {
        throw new BadRequestException(ErrorQuery.InvalidSearchTerm);
      }

      const whereConditions: any = {
        companyId,
        OR: [{ name: { contains: searchTerm, mode: 'insensitive' } }],
      };

      if (groupId) {
        whereConditions.groupId = groupId;
      }

      return this.employeeRepository.findManyPaginated(
        whereConditions,
        {
          page,
          limit,
          orderBy: { name: 'asc' },
        },
        {
          include: {
            group: true,
          },
        },
      );
    } catch (error) {
      this.logger.error('Failed to search employees:', error);
      handleError(error, this.logger);
    }
  }

  /**
   * Get contacts by group
   */
  async getEmployeesByEmployeeGroup(
    companyId: number,
    groupId: number,
    options: {
      page?: number;
      limit?: number;
    } = {},
  ) {
    try {
      const { page = 1, limit = 20 } = options;

      const group = await this.employeeGroupRepository.findOne({
        id: groupId,
        companyId,
      });

      if (!group) {
        throw new NotFoundException(ErrorEmployeeGroup.NotFound);
      }

      return this.employeeRepository.findManyPaginated(
        { companyId, groupId },
        {
          page,
          limit,
          orderBy: { name: 'asc' },
        },
        {
          include: {
            group: true,
          },
        },
      );
    } catch (error) {
      this.logger.error('Failed to get employees by group:', error);
      handleError(error, this.logger);
    }
  }

  /**
   * Get contact by ID
   */
  async getEmployeeById(companyId: number, contactId: number) {
    try {
      const contact = await this.employeeRepository.findOne({
        id: contactId,
        companyId,
      });

      if (!contact) {
        throw new NotFoundException(ErrorEmployee.ContactNotFound);
      }

      const group = await this.employeeGroupRepository.findOne({
        id: contact.groupId,
      });

      return {
        ...contact,
        group,
      };
    } catch (error) {
      this.logger.error('Failed to get employee by ID:', error);
      handleError(error, this.logger);
    }
  }

  /**
   * Get company contact statistics
   */
  async getEmployeeStatistics(companyId: number) {
    try {
      const [totalContacts, groups] = await Promise.all([
        this.employeeRepository.count({ companyId }),
        this.employeeGroupRepository.findMany({ companyId }),
      ]);

      const contactsByGroup: Record<string, number> = {};
      for (const group of groups) {
        const count = await this.employeeRepository.count({
          companyId,
          groupId: group.id,
        });
        contactsByGroup[group.name] = count;
      }

      return {
        totalContacts,
        totalGroups: groups.length,
        contactsByGroup,
      };
    } catch (error) {
      this.logger.error('Failed to get employee statistics:', error);
      handleError(error, this.logger);
    }
  }

  /**
   * Check if contact name is duplicate in group
   */
  async isEmployeeNameDuplicate(
    companyId: number,
    name: string,
    groupId: number,
  ): Promise<{ isDuplicate: boolean }> {
    try {
      const existing = await this.employeeRepository.findOne({
        companyId,
        groupId,
        name,
      });

      return {
        isDuplicate: !!existing,
      };
    } catch (error) {
      this.logger.error(
        'Failed to check if employee name is duplicate:',
        error,
      );
      handleError(error, this.logger);
    }
  }

  /**
   * Check if contact address is duplicate in group
   * @param excludeEmployeeId - Optional employee ID to exclude from duplicate check (useful when updating)
   */
  async isEmployeeAddressDuplicate(
    companyId: number,
    address: string,
    groupId: number,
    excludeEmployeeId?: number,
  ): Promise<{ isDuplicate: boolean }> {
    try {
      const whereClause: any = {
        companyId,
        groupId,
        walletAddress: address,
      };

      // Exclude current employee from duplicate check when updating
      if (excludeEmployeeId !== undefined) {
        whereClause.id = { not: excludeEmployeeId };
      }

      const existing = await this.employeeRepository.findOne(whereClause);

      return {
        isDuplicate: !!existing,
      };
    } catch (error) {
      this.logger.error(
        'Failed to check if employee address is duplicate:',
        error,
      );
      handleError(error, this.logger);
    }
  }

  /**
   * Check if group exists in company
   */
  async isEmployeeGroupExists(
    companyId: number,
    groupName: string,
  ): Promise<{ exists: boolean }> {
    try {
      const existing = await this.employeeGroupRepository.findOne({
        companyId,
        name: groupName,
      });

      return {
        exists: !!existing,
      };
    } catch (error) {
      this.logger.error('Failed to check if employee group exists:', error);
      handleError(error, this.logger);
    }
  }
  //# endregion GET METHODS service

  //# region POST METHODS service
  /**
   * Create a new address book entry with proper validation and transaction handling
   */
  async createNewEmployee(
    dto: CreateContactDto,
    company: CompanyModel,
  ): Promise<Employee> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        dto = sanitizeInput(dto);

        // Find if the group exists for this company
        let group = await this.employeeGroupRepository.findOne(
          {
            id: dto.groupId,
            companyId: company.id,
          },
          tx,
        );
        if (!group) {
          throw new BadRequestException(ErrorQuery.NotExists);
        }

        // Validate and sanitize name and address before checks
        validateName(dto.name, 'name');
        const sanitizedName = sanitizeString(dto.name);

        validateAddress(dto.walletAddress, 'walletAddress');

        const { isDuplicate } = await this.isEmployeeNameDuplicate(
          company.id,
          sanitizedName,
          group.id,
        );

        if (isDuplicate) {
          throw new BadRequestException(ErrorEmployee.NameAlreadyExists);
        }

        const order = await this.employeeRepository.getNextOrderForGroup(
          company.id,
          group.id,
          tx,
        );

        const newEntry = await this.employeeRepository.create(
          {
            company: { connect: { id: company.id } },
            group: { connect: { id: group.id } },
            name: sanitizedName,
            walletAddress: dto.walletAddress,
            email: dto.email || null,
            token: dto.token ? JSON.parse(JSON.stringify(dto.token)) : null,
            network: dto.network
              ? JSON.parse(JSON.stringify(dto.network))
              : null,
            order,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          tx,
        );

        return newEntry;
      });
    } catch (error) {
      this.logger.error('Failed to create new employee:', error);
      handleError(error, this.logger);
    }
  }
  //#endregion POST METHODS service

  //# region PUT METHODS service
  /**
   * Update an existing contact
   */
  async updateEmployee(
    companyId: number,
    contactId: number,
    dto: UpdateAddressBookDto,
  ): Promise<Employee> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existingContact = await this.employeeRepository.findOne(
          {
            id: contactId,
            companyId,
          },
          tx,
        );

        if (!existingContact) {
          throw new NotFoundException(ErrorEmployee.ContactNotFound);
        }

        const updateData: any = {};
        if (dto.name !== undefined) {
          validateName(dto.name, 'name');
          updateData.name = sanitizeString(dto.name);

          // Check name duplicate if name is being changed
          if (updateData.name !== existingContact.name) {
            const { isDuplicate } = await this.isEmployeeNameDuplicate(
              companyId,
              updateData.name,
              existingContact.groupId,
            );

            if (isDuplicate) {
              throw new BadRequestException(ErrorEmployee.NameAlreadyExists);
            }
          }
        }

        // Handle walletAddress (preferred) or address (backwards compatibility)
        const walletAddress = dto.walletAddress ?? dto.address;
        if (walletAddress !== undefined) {
          validateAddress(walletAddress, 'address');
          updateData.walletAddress = walletAddress;

          // Check address duplicate if address is being changed
          // Exclude current employee from duplicate check
          if (updateData.walletAddress !== existingContact.walletAddress) {
            const { isDuplicate } = await this.isEmployeeAddressDuplicate(
              companyId,
              updateData.walletAddress,
              existingContact.groupId,
              contactId, // Exclude current employee from duplicate check
            );

            if (isDuplicate) {
              throw new BadRequestException(ErrorEmployee.AddressAlreadyExists);
            }
          }
        }

        if (dto.email !== undefined) {
          updateData.email = dto.email;
        }

        if (dto.token !== undefined) {
          updateData.token = JSON.parse(JSON.stringify(dto.token));
        }

        if (dto.network !== undefined) {
          updateData.network = JSON.parse(JSON.stringify(dto.network));
        }

        if (dto.groupId !== undefined) {
          // Verify the group exists and belongs to the company
          const group = await this.employeeGroupRepository.findOne(
            {
              id: dto.groupId,
              companyId,
            },
            tx,
          );

          if (!group) {
            throw new BadRequestException(ErrorEmployeeGroup.NotFound);
          }

          updateData.groupId = dto.groupId;
        }

        // Update the contact
        const updatedContact = await this.employeeRepository.update(
          { id: contactId, companyId },
          updateData,
          tx,
        );

        return updatedContact;
      });
    } catch (error) {
      this.logger.error('Failed to update employee:', error);
      handleError(error, this.logger);
    }
  }

  /**
   * Update order of multiple contacts
   */
  async updateEmployeesOrder(
    companyId: number,
    orderUpdates: AddressBookOrderDto[],
  ): Promise<{ message: string; updatedCount: number }> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        if (orderUpdates.length === 0) {
          return {
            message: 'No employees to update',
            updatedCount: 0,
          };
        }

        let updatedCount = 0;

        for (const update of orderUpdates) {
          const contact = await this.employeeRepository.findOne(
            {
              id: update.id,
              companyId,
            },
            tx,
          );

          if (contact) {
            await this.employeeRepository.update(
              { id: update.id, companyId },
              { order: update.order },
              tx,
            );
            updatedCount++;
          } else {
            this.logger.warn(
              `Contact ${update.id} not found or access denied for company ${companyId}`,
            );
          }
        }

        return {
          message: 'Employee order updated successfully',
          updatedCount,
        };
      });
    } catch (error) {
      this.logger.error('Failed to update employee order:', error);
      handleError(error, this.logger);
    }
  }
  //#endregion PUT METHODS service

  //#region DELETE METHODS service
  /**
   * Delete contact by ID
   */
  async deleteEmployee(companyId: number, contactId: number) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const contact = await this.employeeRepository.findOne(
          {
            id: contactId,
            companyId,
          },
          tx,
        );

        if (!contact) {
          throw new NotFoundException(ErrorEmployee.ContactNotFound);
        }

        await this.employeeRepository.delete({ id: contactId, companyId }, tx);
        return {
          message: 'Employee deleted successfully',
        };
      });
    } catch (error) {
      this.logger.error('Failed to delete employee:', error);
      handleError(error, this.logger);
    }
  }

  /**
   * Bulk delete contacts
   */
  async bulkDeleteEmployees(companyId: number, contactIds: number[]) {
    try {
      if (!contactIds || contactIds.length === 0) {
        throw new BadRequestException(ErrorEmployee.NoContactIdsProvided);
      }

      let deletedCount = 0;

      await this.prisma.$transaction(async (tx) => {
        // Delete contacts one by one to ensure they belong to the company
        for (const contactId of contactIds) {
          const contact = await this.employeeRepository.findOne(
            {
              id: contactId,
              companyId,
            },
            tx,
          );
          if (contact) {
            await this.employeeRepository.delete(
              {
                id: contactId,
                companyId,
              },
              tx,
            );
            deletedCount++;
          }
        }
      });

      return deletedCount;
    } catch (error) {
      this.logger.error('Failed to bulk delete employees:', error);
      handleError(error, this.logger);
    }
  }
  //#endregion DELETE METHODS service
}
