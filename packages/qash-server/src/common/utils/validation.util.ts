import { BadRequestException } from '@nestjs/common';

/**
 * Validates if an address has the correct format (starts with 0x and has valid hex characters)
 */
export function validateAddress(
  address: string,
  fieldName: string = 'address',
): void {
  if (!address) {
    throw new BadRequestException(`${fieldName} is required`);
  }

  if (typeof address !== 'string') {
    throw new BadRequestException(`${fieldName} must be a string`);
  }

  if (!address.startsWith('mt') && !address.startsWith('mm')) {
    throw new BadRequestException(`${fieldName} must start with mt or mm`);
  }

  if (address.length < 3) {
    throw new BadRequestException(`${fieldName} is too short`);
  }
}

/**
 * Validates if an amount is a valid positive number string
 */
export function validateAmount(
  amount: string,
  fieldName: string = 'amount',
): void {
  if (!amount) {
    throw new BadRequestException(`${fieldName} is required`);
  }

  if (typeof amount !== 'string') {
    throw new BadRequestException(`${fieldName} must be a string`);
  }

  const numericAmount = parseFloat(amount);
  if (isNaN(numericAmount)) {
    throw new BadRequestException(`${fieldName} must be a valid number`);
  }

  if (numericAmount <= 0) {
    throw new BadRequestException(`${fieldName} must be greater than 0`);
  }

  if (!isFinite(numericAmount)) {
    throw new BadRequestException(`${fieldName} must be a finite number`);
  }
}

/**
 * Validates if a string is not empty and doesn't contain only whitespace
 */
export function validateNonEmptyString(value: string, fieldName: string): void {
  if (!value) {
    throw new BadRequestException(`${fieldName} is required`);
  }

  if (typeof value !== 'string') {
    throw new BadRequestException(`${fieldName} must be a string`);
  }

  if (value.trim().length === 0) {
    throw new BadRequestException(
      `${fieldName} cannot be empty or contain only whitespace`,
    );
  }
}

/**
 * Validates if an array has unique elements
 */
export function validateUniqueArray<T>(array: T[], fieldName: string): void {
  if (!Array.isArray(array)) {
    throw new BadRequestException(`${fieldName} must be an array`);
  }

  const uniqueSet = new Set(array);
  if (uniqueSet.size !== array.length) {
    throw new BadRequestException(`${fieldName} must contain unique elements`);
  }
}

/**
 * Validates if an array is not empty
 */
export function validateNonEmptyArray<T>(array: T[], fieldName: string): void {
  if (!Array.isArray(array)) {
    throw new BadRequestException(`${fieldName} must be an array`);
  }

  if (array.length === 0) {
    throw new BadRequestException(`${fieldName} cannot be empty`);
  }
}

/**
 * Validates if a serial number array has exactly 4 numeric elements
 */
export function validateSerialNumber(
  serialNumber: string[],
  fieldName: string = 'serialNumber',
): void {
  if (!Array.isArray(serialNumber)) {
    throw new BadRequestException(`${fieldName} must be an array`);
  }

  if (serialNumber.length !== 4) {
    throw new BadRequestException(
      `${fieldName} must contain exactly 4 elements`,
    );
  }
}

/**
 * Validates if a date is in the future
 */
export function validateFutureDate(
  date: Date | string,
  fieldName: string,
): void {
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  if (isNaN(dateObj.getTime())) {
    throw new BadRequestException(`${fieldName} must be a valid date`);
  }

  if (dateObj <= new Date()) {
    throw new BadRequestException(`${fieldName} must be in the future`);
  }
}

/**
 * Sanitizes a string by trimming whitespace and removing potentially dangerous characters
 */
export function sanitizeString(value: string): string {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim().replace(/[<>]/g, '');
}

/**
 * Validates if a name is valid (not empty, reasonable length, no special characters)
 */
export function validateName(name: string, fieldName: string = 'name'): void {
  validateNonEmptyString(name, fieldName);

  if (name.length > 100) {
    throw new BadRequestException(
      `${fieldName} cannot be longer than 100 characters`,
    );
  }

  // Allow letters, numbers, spaces, hyphens, and underscores
  if (!/^[a-zA-Z0-9\s\-_]+$/.test(name)) {
    throw new BadRequestException(
      `${fieldName} can only contain letters, numbers, spaces, hyphens, and underscores`,
    );
  }
}

/**
 * Validates if a category is valid
 */
export function validateCategory(
  category: string,
  fieldName: string = 'category',
): void {
  validateNonEmptyString(category, fieldName);

  if (category.length > 50) {
    throw new BadRequestException(
      `${fieldName} cannot be longer than 50 characters`,
    );
  }

  // Allow letters, numbers, spaces, and hyphens
  if (!/^[a-zA-Z0-9\s\-]+$/.test(category)) {
    throw new BadRequestException(
      `${fieldName} can only contain letters, numbers, spaces, and hyphens`,
    );
  }
}

/**
 * Validates if a message is valid
 */
export function validateMessage(
  message: string,
  fieldName: string = 'message',
): void {
  validateNonEmptyString(message, fieldName);

  if (message.length > 500) {
    throw new BadRequestException(
      `${fieldName} cannot be longer than 500 characters`,
    );
  }
}

/**
 * Normalizes an address to lowercase
 */
export function normalizeAddress(address: string): string {
  return address.toLowerCase();
}

/**
 * Validates if two addresses are different
 */
export function validateDifferentAddresses(
  address1: string,
  address2: string,
  field1: string,
  field2: string,
): void {
  if (normalizeAddress(address1) === normalizeAddress(address2)) {
    throw new BadRequestException(`${field1} and ${field2} cannot be the same`);
  }
}
