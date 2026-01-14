import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ErrorMail } from '../../common/constants/errors';
import { MailgunMessageData, MailgunService } from 'nestjs-mailgun';
import { AppConfigService } from '../shared/config/config.service';
import { TokenDto } from '../employee/employee.dto';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly mailgundefaultFromName: string;
  private readonly frontendUrl: string;

  constructor(
    private mailgunService: MailgunService,
    private readonly appConfigService: AppConfigService,
  ) {
    this.mailgundefaultFromName =
      this.appConfigService.mailConfig.mailgun.from.name;
    this.frontendUrl = this.appConfigService.otherConfig.frontendUrl;

    // check NODE_ENV is production
    if (process.env.NODE_ENV === 'production') {
      if (this.frontendUrl !== 'https://app.qash.finance') {
        this.frontendUrl = 'https://app.qash.finance';
      }
    }
  }

  async sendEmail({
    to,
    fromEmail,
    ...filledTemplate
  }: MailgunMessageData): Promise<void> {
    try {
      const domain = this.appConfigService.mailConfig.mailgun.domain;
      const data: MailgunMessageData = {
        from: `"${this.mailgundefaultFromName}" ${fromEmail}`,
        to,
        ...filledTemplate,
      };
      await this.mailgunService.createEmail(domain, data);
      this.logger.log('Email sent successfully');
      return;
    } catch (error) {
      this.logger.error(error, MailService.name);
      throw new BadRequestException(ErrorMail.EmailNotSent);
    }
  }

  /**
   * Send OTP email
   */
  async sendOtpEmail(email: string, otpCode: string): Promise<void> {
    try {
      const fromEmail = 'noreply@qash.finance';
      const subject = `Your OTP Code`;
      const html = `
       <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Login OTP code</title>
      </head>
      <body style="margin: 0; padding: 0; background: #0e3ee0; font-family: 'Inter', Arial, sans-serif; color: #0f172a;">
        <img src="https://raw.githubusercontent.com/qash-finance/qash-server/refs/heads/main/images/top.png" style="height: 50px; width: 100%; display: block;" alt=""/>
        <div style="width: 100%; background: #0e3ee0; padding: 32px 12px; box-sizing: border-box;">
          <div style="max-width: 720px; margin: 0 auto; background: #f5f7fb; overflow: hidden;">
            <div style="padding: 28px 36px 0 36px; text-align: left;">
              <img src="https://raw.githubusercontent.com/qash-finance/qash-server/refs/heads/main/images/qash-logo.png" alt="Qash logo" style="width: 60px; height: 60px; margin-bottom: 8px;" />
              <p style="font-size: 30px; font-weight: 700; margin: 0 0 12px 0; color: #0f172a;">Login OTP code</p>
              <div style="height: 1px; width: 100%; background-color: #d9d9d9; margin-bottom: 20px;"></div>
              <p style="font-size: 16px; margin: 0; color: #1f2937;">Hello, ${email.split('@')[0]}</p> 
            </div>
            <div style="padding: 0 36px 32px 36px; font-size: 15px; line-height: 1.6; color: #1f2937;">
              <p style="margin: 0 0 16px 0;">
                Your 6-digit login OTP code associated with
                <span style="font-weight: 600; color: #0e3ee0; text-decoration: underline;">${email}</span> is:
              </p>
              <div style="margin: 24px 0 12px 0; padding: 22px; text-align: center;">
                <p style="font-size: 40px; font-weight: 500; letter-spacing: 3px; margin: 0;">${otpCode}</p>
              </div>
              <div style="height: 1px; width: 100%; background-color: #d9d9d9; margin-bottom: 20px;"></div>
              <p style="margin-top: 16px; font-size: 14px; margin-bottom: 12px;">This OTP code expires in 10 minutes. If you didn't request this, just ignore and delete this message.</p>
              <div style="font-size: 14px;">
                To keep your account secure, please don't forward this email to anyone.
              </div>
            </div>
            <div style="padding: 0 36px 28px 36px; font-size: 13px; color: #6b7280; line-height: 1.5;">
              <p style="margin: 0;">This is an automated message, please do not reply to this email.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
      `;

      await this.sendEmail({
        to: email,
        fromEmail,
        subject,
        html,
      });
    } catch (error) {
      this.logger.error(`Failed to send OTP email to ${email}:`, error);
      throw new BadRequestException(ErrorMail.EmailNotSent);
    }
  }

  /**
   * Send invoice notification to employee
   */
  async sendInvoiceNotification(
    employeeEmail: string,
    invoiceNumber: string,
    invoiceUUID: string,
    dueDate: Date,
    companyName: string,
    employeeName: string,
    amount: string,
    month: string,
    tokenSymbol: string,
  ): Promise<void> {
    try {
      const fromEmail =
        'noreply@' + this.appConfigService.mailConfig.mailgun.domain;
      const invoiceReviewUrl = `${this.frontendUrl}/invoice-review?uuid=${invoiceUUID}&email=${encodeURIComponent(
        employeeEmail,
      )}`;

      const subject = `Invoice ${invoiceNumber} - Review Required`;
      const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Invoice Review</title>
      </head>
      <body style="margin: 0; padding: 0; background: #0e3ee0; font-family: 'Inter', Arial, sans-serif; color: #0f172a;">
        <img src="https://raw.githubusercontent.com/qash-finance/qash-server/refs/heads/main/images/top.png" style="height: 50px; width: 100%; display: block;" alt=""/>
        <div style="width: 100%; background: #0e3ee0; padding: 32px 12px; box-sizing: border-box;">
          <div style="max-width: 720px; margin: 0 auto; background: #f5f7fb; overflow: hidden;">
            <div style="padding: 28px 36px 0 36px; text-align: left;">
              <p style="font-size: 30px; font-weight: 700; margin: 0 0 12px 0; color: #0f172a;">Your invoice for ${companyName} is ready!</p>
              <p style="color: #848484; margin: 0 0 12px 0;">Due date: ${new Date(dueDate).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}</p>
              <div style="height: 1px; width: 100%; background-color: #d9d9d9; margin-bottom: 20px;"></div>
              <p style="font-size: 16px; margin: 0; margin-top: 40px; color: #1f2937; font-weight: bold;">Hello, ${employeeName}</p>
            </div>
            <div>
              <div style="padding: 0 36px 32px 36px; font-size: 15px; line-height: 1.6; color: #1f2937;">
              <p style="margin-bottom: 40px; margin-top: 0;">
                 Your monthly invoice for the ${month} salary of ${amount} ${tokenSymbol} for ${companyName} is ready. Please review the details and confirm so that ${companyName} can proceed with the payment
              </p>
              <div style="margin: 20px 0;">
                <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(0deg, #002c69 0%, #0061e7 100%); border-radius: 10px; padding: 2px;">
                  <tr>
                    <td align="center" style="background: #0059ff; border-top: 2px solid #4888ff; border-radius: 8px; padding: 12px;">
                      <a href="${invoiceReviewUrl}" style="color: white; font-size: 15px; text-decoration: none; font-weight: 500; display: block;">View Invoice</a>
                    </td>
                  </tr>
                </table>
              </div>
               <div style="margin-top: 40px; height: 1px; width: 100%; background-color: #d9d9d9;"></div>
              </div>
            </div>
            <div style="padding: 0 36px 28px 36px; font-size: 13px; color: #6b7280; line-height: 1.5;">
              <p style="margin: 0;">This is an automated message, please do not reply to this email.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
      `;

      await this.sendEmail({
        to: employeeEmail,
        fromEmail,
        subject,
        html,
      });

      this.logger.log(
        `Invoice notification sent to ${employeeEmail} for invoice ${invoiceNumber}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send invoice notification to ${employeeEmail}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Send invoice confirmation notification to company
   */
  async sendInvoiceConfirmationNotification(
    companyEmail: string,
    invoiceNumber: string,
    companyName: string,
    employeeName: string,
    employeeEmail: string,
    fromMonthYear: string,
    toMonthYear: string,
  ): Promise<void> {
    try {
      const fromEmail =
        'noreply@' + this.appConfigService.mailConfig.mailgun.domain;

      const subject = `Invoice ${invoiceNumber} from ${employeeName} Confirmed`;
      const html = `
       <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Invoice Confirmed</title>
      </head>
      <body style="margin: 0; padding: 0; background: #0e3ee0; font-family: 'Inter', Arial, sans-serif; color: #0f172a;">
        <img src="https://raw.githubusercontent.com/qash-finance/qash-server/refs/heads/main/images/top.png" style="height: 50px; width: 100%; display: block;" alt=""/>
        <div style="width: 100%; background: #0e3ee0; padding: 32px 12px; box-sizing: border-box;">
          <div style="max-width: 720px; margin: 0 auto; background: #f5f7fb; overflow: hidden;">
            <div style="padding: 28px 36px 0 36px; text-align: left;">
               <img src="https://raw.githubusercontent.com/qash-finance/qash-server/refs/heads/main/images/qash-logo.png" alt="Qash logo" style="width: 60px; height: 60px; margin-bottom: 8px;" />
              <p style="font-size: 30px; font-weight: 700; margin: 0 0 12px 0; color: #0f172a;">Invoice confirmed</p>
              <div style="height: 1px; width: 100%; background-color: #d9d9d9; margin-bottom: 20px;"></div>
              <p style="font-size: 16px; margin: 0; margin-top: 40px; color: #1f2937; font-weight: bold;">Dear ${companyName}</p>
            </div>
            <div>
              <div style="padding: 0 36px 32px 36px; font-size: 15px; line-height: 1.6; color: #1f2937;">
              <p style="margin-bottom: 40px; margin-top: 0;">
                 ${employeeName} (${employeeEmail}) has confirmed the invoice for ${fromMonthYear} to ${toMonthYear}. It is now available in the <b>Bill</b> section.
              </p>
              <div style="margin: 20px 0;">
                <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(0deg, #002c69 0%, #0061e7 100%); border-radius: 10px; padding: 2px;">
                  <tr>
                    <td align="center" style="background: #0059ff; border-top: 2px solid #4888ff; border-radius: 8px; padding: 12px;">
                      <a href="${this.frontendUrl}" style="color: white; font-size: 15px; text-decoration: none; font-weight: 500; display: block;">Open App</a>
                    </td>
                  </tr>
                </table>
              </div>
               <div style="margin-top: 40px; height: 1px; width: 100%; background-color: #d9d9d9;"></div>
              </div>
            </div>
            <div style="padding: 0 36px 28px 36px; font-size: 13px; color: #6b7280; line-height: 1.5;">
              <p style="margin: 0;">This is an automated message, please do not reply to this email.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
      `;

      await this.sendEmail({
        to: companyEmail,
        fromEmail,
        subject,
        html,
      });

      this.logger.log(
        `Invoice confirmation notification sent to ${companyEmail} for invoice ${invoiceNumber}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send invoice confirmation notification to ${companyEmail}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Send overdue bill notification
   */
  async sendOverdueBillNotification(
    companyEmail: string,
    overdueCount: number,
    totalAmount: string,
  ): Promise<void> {
    try {
      const fromEmail =
        'noreply@' + this.appConfigService.mailConfig.mailgun.domain;
      const billsUrl = `${this.frontendUrl}/dashboard/bills?status=OVERDUE`;

      const subject = `Overdue Bills Alert - ${overdueCount} Bill${overdueCount > 1 ? 's' : ''} Past Due`;
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #dc3545;">Overdue Bills Alert</h2>
          
          <p>Hello,</p>
          
          <p>You have bills that are past their due date:</p>
          
          <div style="background-color: #f8d7da; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #dc3545;">
            <p><strong>${overdueCount}</strong> overdue bill${overdueCount > 1 ? 's' : ''}</p>
            <p><strong>Total Amount:</strong> $${totalAmount}</p>
          </div>
          
          <p>Please review and process payment for these overdue bills as soon as possible.</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${billsUrl}" 
               style="background-color: #dc3545; color: white; padding: 12px 24px; 
                      text-decoration: none; border-radius: 5px; display: inline-block;">
              View Overdue Bills
            </a>
          </div>
          
          <p>Delayed payments may affect your employee relationships and company reputation.</p>
          
          <p>Best regards,<br>
          The Payroll System</p>
          
          <hr style="margin-top: 30px; border: none; border-top: 1px solid #eee;">
          <p style="font-size: 12px; color: #666;">
            This is an automated message. Please do not reply to this email.
          </p>
        </div>
      `;

      await this.sendEmail({
        to: companyEmail,
        fromEmail,
        subject,
        html,
      });

      this.logger.log(
        `Overdue bill notification sent to ${companyEmail} for ${overdueCount} bills`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send overdue bill notification to ${companyEmail}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Send B2B invoice notification to recipient company
   */
  async sendB2BInvoiceNotification(
    recipientEmail: string,
    invoiceNumber: string,
    _invoiceUUID: string,
    dueDate: Date,
    senderCompanyName: string,
    recipientCompanyName: string,
    amount: string,
    token: TokenDto,
    _description: string,
    reviewUrl: string,
    billCreated: boolean = false,
  ): Promise<void> {
    try {
      const fromEmail =
        'noreply@' + this.appConfigService.mailConfig.mailgun.domain;
      const fullReviewUrl = `${this.frontendUrl}${reviewUrl}`;

      const subject = `Invoice ${invoiceNumber} from ${senderCompanyName} - ${billCreated ? 'Bill Created' : 'Review Required'}`;

      // Customize message based on whether bill was auto-created
      const actionMessage = billCreated
        ? 'A bill has been automatically created in your account. Please review and process payment.'
        : 'Please review the invoice details and confirm to proceed with payment processing.';
      const actionButtonText = billCreated ? 'View Bill' : 'Review Invoice';

      const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>B2B Invoice ${billCreated ? 'Bill Created' : 'Review'}</title>
      </head>
      <body style="margin: 0; padding: 0; background: #0e3ee0; font-family: 'Inter', Arial, sans-serif; color: #0f172a;">
        <img src="https://raw.githubusercontent.com/qash-finance/qash-server/refs/heads/main/images/top.png" style="height: 50px; width: 100%; display: block;" alt=""/>
        <div style="width: 100%; background: #0e3ee0; padding: 32px 12px; box-sizing: border-box;">
          <div style="max-width: 720px; margin: 0 auto; background: #f5f7fb; overflow: hidden;">
            <div style="padding: 28px 36px 0 36px; text-align: left;">
              <img src="https://raw.githubusercontent.com/qash-finance/qash-server/refs/heads/main/images/qash-logo.png" alt="Qash logo" style="width: 60px; height: 60px; margin-bottom: 8px;" />
              <p style="font-size: 30px; font-weight: 700; margin: 0 0 12px 0; color: #0f172a;">New Invoice from ${senderCompanyName}</p>
              <p style="color: #848484; margin: 0 0 12px 0;">Due date: ${new Date(dueDate).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}</p>
              <div style="height: 1px; width: 100%; background-color: #d9d9d9; margin-bottom: 20px;"></div>
              <p style="font-size: 16px; margin: 0; margin-top: 40px; color: #1f2937; font-weight: bold;">Dear ${recipientCompanyName}</p>
            </div>
            <div>
              <div style="padding: 0 36px 32px 36px; font-size: 15px; line-height: 1.6; color: #1f2937;">
              <p style="margin-bottom: 20px; margin-top: 0;">
                You have received a new invoice from ${senderCompanyName} for the amount of <strong>${amount} ${token.symbol}</strong>.
              </p>
              <p style="margin-bottom: 40px;">
                ${actionMessage}
              </p>
              <div style="margin: 20px 0;">
                <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(0deg, #002c69 0%, #0061e7 100%); border-radius: 10px; padding: 2px;">
                  <tr>
                    <td align="center" style="background: #0059ff; border-top: 2px solid #4888ff; border-radius: 8px; padding: 12px;">
                      <a href="${fullReviewUrl}" style="color: white; font-size: 15px; text-decoration: none; font-weight: 500; display: block;">${actionButtonText}</a>
                    </td>
                  </tr>
                </table>
              </div>
               <div style="margin-top: 40px; height: 1px; width: 100%; background-color: #d9d9d9;"></div>
              </div>
            </div>
            <div style="padding: 0 36px 28px 36px; font-size: 13px; color: #6b7280; line-height: 1.5;">
              <p style="margin: 0;">This is an automated message, please do not reply to this email.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
      `;

      await this.sendEmail({
        to: recipientEmail,
        fromEmail,
        subject,
        html,
      });

      this.logger.log(
        `B2B invoice notification sent to ${recipientEmail} for invoice ${invoiceNumber} (${billCreated ? 'bill created' : 'review required'})`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send B2B invoice notification to ${recipientEmail}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Send B2B invoice confirmation notification to sender company
   */
  async sendB2BInvoiceConfirmationNotification(
    senderEmail: string,
    invoiceNumber: string,
    senderCompanyName: string,
    recipientCompanyName: string,
    recipientEmail: string,
    amount: string,
    currency: string,
  ): Promise<void> {
    try {
      const fromEmail =
        'noreply@' + this.appConfigService.mailConfig.mailgun.domain;

      const subject = `Invoice ${invoiceNumber} Confirmed by ${recipientCompanyName}`;
      const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>B2B Invoice Confirmed</title>
      </head>
      <body style="margin: 0; padding: 0; background: #0e3ee0; font-family: 'Inter', Arial, sans-serif; color: #0f172a;">
        <img src="https://raw.githubusercontent.com/qash-finance/qash-server/refs/heads/main/images/top.png" style="height: 50px; width: 100%; display: block;" alt=""/>
        <div style="width: 100%; background: #0e3ee0; padding: 32px 12px; box-sizing: border-box;">
          <div style="max-width: 720px; margin: 0 auto; background: #f5f7fb; overflow: hidden;">
            <div style="padding: 28px 36px 0 36px; text-align: left;">
               <img src="https://raw.githubusercontent.com/qash-finance/qash-server/refs/heads/main/images/qash-logo.png" alt="Qash logo" style="width: 60px; height: 60px; margin-bottom: 8px;" />
              <p style="font-size: 30px; font-weight: 700; margin: 0 0 12px 0; color: #0f172a;">Invoice Confirmed</p>
              <div style="height: 1px; width: 100%; background-color: #d9d9d9; margin-bottom: 20px;"></div>
              <p style="font-size: 16px; margin: 0; margin-top: 40px; color: #1f2937; font-weight: bold;">Dear ${senderCompanyName},</p>
            </div>
            <div>
              <div style="padding: 0 36px 32px 36px; font-size: 15px; line-height: 1.6; color: #1f2937;">
              <p style="margin-bottom: 20px; margin-top: 0;">
                <strong>${recipientCompanyName}</strong> (${recipientEmail}) has confirmed invoice <strong>${invoiceNumber}</strong> for <strong>${amount} ${currency}</strong>.
              </p>
              <p style="margin-bottom: 40px;">
                It’s now available in your <strong>Bill</strong> section on  Qash. Please check it.
              </p>
              <div style="margin: 20px 0;">
                <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(0deg, #002c69 0%, #0061e7 100%); border-radius: 10px; padding: 2px;">
                  <tr>
                    <td align="center" style="background: #0059ff; border-top: 2px solid #4888ff; border-radius: 8px; padding: 12px;">
                      <a href="${this.frontendUrl}" style="color: white; font-size: 15px; text-decoration: none; font-weight: 500; display: block;">Open App</a>
                    </td>
                  </tr>
                </table>
              </div>
               <div style="margin-top: 40px; height: 1px; width: 100%; background-color: #d9d9d9;"></div>
              </div>
            </div>
            <div style="padding: 0 36px 28px 36px; font-size: 13px; color: #6b7280; line-height: 1.5;">
              <p style="margin: 0;">This is an automated message, please do not reply to this email.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
      `;

      await this.sendEmail({
        to: senderEmail,
        fromEmail,
        subject,
        html,
      });

      this.logger.log(
        `B2B invoice confirmation notification sent to ${senderEmail} for invoice ${invoiceNumber}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send B2B invoice confirmation notification to ${senderEmail}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Send payslip email with PDF attachment
   */
  async sendPayslipEmail(
    employeeEmail: string,
    employeeName: string,
    companyName: string,
    payPeriod: string,
    _netPay: string,
    _currency: string,
    pdfBuffer: Buffer,
    pdfFilename: string,
  ): Promise<void> {
    try {
      const fromEmail =
        'noreply@' + this.appConfigService.mailConfig.mailgun.domain;

      const subject = `Your Payslip for ${payPeriod} - ${companyName}`;
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Your Payslip</title>
        </head>
        <body style="margin: 0; padding: 0; background: #0e3ee0; font-family: 'Inter', Arial, sans-serif; color: #0f172a;">
          <img src="https://raw.githubusercontent.com/qash-finance/qash-server/refs/heads/main/images/top.png" style="height: 50px; width: 100%; display: block;" alt=""/>
          <div style="width: 100%; background: #0e3ee0; padding: 32px 12px; box-sizing: border-box;">
            <div style="max-width: 720px; margin: 0 auto; background: #f5f7fb; overflow: hidden;">
              <div style="padding: 28px 36px 0 36px; text-align: left;">
                <img src="https://raw.githubusercontent.com/qash-finance/qash-server/refs/heads/main/images/qash-logo.png" alt="Qash logo" style="width: 60px; height: 60px; margin-bottom: 8px;" />
                <p style="font-size: 30px; font-weight: 700; margin: 0 0 12px 0; color: #0f172a;">Invoice confirmed</p>
                <div style="height: 1px; width: 100%; background-color: #d9d9d9; margin-bottom: 20px;"></div>
                <p style="font-size: 16px; margin: 0; margin-top: 40px; color: #1f2937; font-weight: bold;">Hello ${employeeName},</p>
              </div>
              <div>
                <div style="padding: 0 36px 32px 36px; font-size: 15px; line-height: 1.6; color: #1f2937;">
                <p style="margin-bottom: 20px; margin-top: 0;">
                  Your payslip is now available. Click below to download.
                </p>
                  
                <div style="height: 1px; width: 100%;border-top:1px dashed;border-color: #d9d9d9; margin-bottom: 20px;"></div>
                
                <div>
                  <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(0deg, #002c69 0%, #0061e7 100%); border-radius: 10px; padding: 2px;">
                    <tr>
                      <td align="center" style="background: #0059ff; border-top: 2px solid #4888ff; border-radius: 8px; padding: 12px;">
                        <a href="${this.frontendUrl}" style="color: white; font-size: 15px; text-decoration: none; font-weight: 500; display: block;">Download Payslip</a>
                      </td>
                    </tr>
                  </table>
                </div>

              </div>
            </div>
          </div>
        </body>
        </html>
      `;

      const domain = this.appConfigService.mailConfig.mailgun.domain;
      const data: any = {
        from: `"${this.mailgundefaultFromName}" ${fromEmail}`,
        to: employeeEmail,
        subject,
        html,
        attachment: [
          {
            data: pdfBuffer,
            filename: pdfFilename,
            contentType: 'application/pdf',
          },
        ],
      };

      await this.mailgunService.createEmail(domain, data);

      this.logger.log(
        `Payslip email sent to ${employeeEmail} for ${payPeriod}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send payslip email to ${employeeEmail}:`,
        error,
      );
      throw error;
    }
  }
}
