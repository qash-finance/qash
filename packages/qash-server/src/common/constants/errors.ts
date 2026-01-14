export enum ErrorAdmin {
  NotFound = 'Admin not found',
  NotAuthorized = 'Not authorized',
}

export enum ErrorQuery {
  BadIdString = 'Bad id string',
  InvalidSearchTerm = 'Search term must be at least 2 characters',
  NotExists = 'Not exists',
}

export enum ErrorToken {
  NotFound = 'Token not found',
  InvalidFormat = 'Invalid token format',
  Expired = 'Token expired',
}

export enum ErrorMail {
  EmailNotSent = 'Email was not sent',
}

export enum ErrorAuth {
  NotAuthenticated = 'Not authenticated',
  NotAuthorized = 'Not authorized',
  AccessTokenRequired = 'Access token is required',
  InvalidToken = 'Invalid or expired token',
  FailedToGenerateTokens = 'Failed to generate tokens',
  InvalidRefreshToken = 'Invalid or expired refresh token',
  AccountDeactivated = 'Account is deactivated',
  InvalidEmailOrOtp = 'Invalid email or OTP',
  TooManyFailedAttempts = 'Too many failed attempts. Please request a new OTP.',
  InvalidOtp = 'Invalid OTP',
  RateLimitExceeded = 'Rate limit exceeded. Please wait a minute before requesting another OTP.',
  MissingJwtToken = 'Missing JWT token',
  JwtTokenMissingKeyId = 'JWT token missing key ID (kid)',
  JwtTokenExpired = 'JWT token expired',
  InvalidParaJwtPayloadStructure = 'Invalid Para JWT payload structure',
  NoEmailOrIdentifierInParaJwt = 'No email or identifier found in Para JWT',
  JwtValidationFailed = 'JWT validation failed',
  NoEmailOrIdentifierInParaToken = 'No email or identifier found in Para token',
}

export enum ErrorUser {
  NotFound = 'User not found',
  RoleSelfAssign = 'Cannot assign role to self',
  EmailExists = 'Email already in use',
  InvalidReferralCode = 'Invalid referral code',
  ReferralCodeMaxedOut = 'Referral code maxed out',
  UserAlreadyActive = 'User already active',
  UserNotActive = 'User is not active, verify your email',
  NoRole = 'User has no role',
  AdminRoleCannotBeChanged = 'Admin role cannot be changed',
  RoleCannotBeChanged = 'Role cannot be changed',
}

export enum ErrorCompany {
  CompanyNotFound = 'Company not found',
  RegistrationNumberAlreadyExists = 'Company with this registration number already exists',
  UserAlreadyTeamMember = 'User is already a team member of another company',
  UserNotAssociatedWithCompany = 'User is not associated with any company',
  FailedToFetchCompany = 'Failed to fetch company',
  InsufficientPermissions = 'Insufficient permissions to update company',
  OnlyCompanyOwnerCanDeactivate = 'Only company owner can deactivate company',
  OnlyCompanyOwnerCanActivate = 'Only company owner can activate company',
  CompanyDeactivated = 'Company is deactivated',
  AccessDeniedToCompany = 'Access denied to this company',
}

export enum ErrorEmployeeGroup {
  NotFound = 'Group not found or access denied',
  GroupAlreadyExists = 'Group already exists',
}

export enum ErrorEmployee {
  NameAlreadyExists = 'Name already exists',
  InvalidAddress = 'Invalid address format',
  InvalidName = 'Invalid name format',
  InvalidCategory = 'Invalid category format',
  AddressAlreadyExists = 'Address already exists in this category',
  SelfAddressNotAllowed = 'Cannot add your own address to address book',
  CategoryAlreadyExists = 'Category already exists',
  NoContactIdsProvided = 'No contact IDs provided',
  ContactNotFound = 'Employee not found',
}

export enum ErrorPayroll {
  HaveActivePayroll = 'Employee already has an active payroll. Please pause or complete the existing payroll first.',
  PayStartDateBeforeJoiningDate = 'Pay start date must be after joining date',
  PayStartDateInThePast = 'Pay start date cannot be in the past',
  PayrollNotFound = 'Payroll not found',
  PayEndDateBeforePayStartDate = 'Pay end date must be after pay start date',
  CannotDeletePayrollWithExistingInvoices = 'Cannot delete payroll with existing invoices. Please cancel instead.',
  PayrollAlreadyDeleted = 'Payroll has already been deleted',
}

export enum ErrorInvoice {
  InvoiceNotFound = 'Invoice not found',
  InvoiceAlreadyExistsThisMonth = 'An invoice for this payroll already exists this month',
  NotOwner = 'Only the employee can update their own invoices',
  InvoiceNotUpdatable = 'Invoice can only be updated when in SENT or REVIEWED status',
  InvoiceNotSendable = 'Only draft invoices can be sent',
  InvoiceNotReviewable = 'Only sent invoices can be reviewed',
  InvoiceNotConfirmable = 'Only reviewed invoices can be confirmed',
  InvoiceNotCancelable = 'Cannot cancel confirmed invoices',
  InvoiceNotBelongsToCompany = 'Invoice does not belong to this company',
  InvoiceNotConfirmed = 'Only confirmed invoices can be converted to bills',
}

export enum ErrorBill {
  BillAlreadyExists = 'Bill already exists for this invoice',
  BillsNotFoundOrNotPayable = 'Bills not found or not payable',
  BillNotFound = 'Bill not found',
  CannotDeletePaidBills = 'Cannot delete paid bills',
}

export enum ErrorClient {
  NotFound = 'Client not found',
  EmailAlreadyExists = 'Client with this email already exists',
}

export enum ErrorInvoiceSchedule {
  InvoiceScheduleNotFound = 'Invoice schedule not found',
  InvoiceScheduleAlreadyExists = 'Invoice schedule already exists for this payroll',
}

export enum ErrorInvoiceItem {
  InvoiceItemNotFound = 'Invoice item not found',
  InvoiceItemAlreadyExists = 'Invoice item already exists',
}

export enum ErrorPaymentLink {
  NotFound = 'Payment link not found',
  InvalidCode = 'Invalid payment link code',
  CodeAlreadyExists = 'Payment link code already exists',
  InvalidTitle = 'Invalid title',
  InvalidDescription = 'Invalid description',
  InvalidAmount = 'Invalid amount',
  InvalidPayee = 'Invalid payee address',
  InvalidPayer = 'Invalid payer address',
  AlreadyDeactivated = 'Payment link is already deactivated',
  AlreadyActive = 'Payment link is already active',
  NotOwner = 'Only the payee can modify this payment link',
  InvalidTokens = 'Invalid accepted tokens',
  InvalidChains = 'Invalid accepted chains',
  PaymentRecordNotFound = 'Payment record not found',
}

export enum ErrorTeamMember {
  NotFound = 'Team member not found',
  EmailAlreadyExists = 'Email already exists in this company',
  InsufficientPermissions = 'Insufficient permissions to add team members',
  InsufficientPermissionsToInvite = 'Insufficient permissions to invite team members',
  UserAlreadyJoined = 'User already joined this company',
  InvitationNotActive = 'Invitation is no longer active',
  EmailAlreadyInvited = 'Email already invited to this company',
  AccessDenied = 'Access denied to this company',
  CannotRemoveLastOwner = 'Cannot remove the last owner of the company',
}
