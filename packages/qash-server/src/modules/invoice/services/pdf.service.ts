import { Injectable, Logger } from '@nestjs/common';
import { InvoiceModel } from 'src/database/generated/models';
import { InvoiceTypeEnum } from 'src/database/generated/client';
import puppeteer from 'puppeteer';
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { CurrencySymbols } from 'src/common/constants/currency';

@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);

  /**
   * Get Chrome/Chromium executable path
   * Checks environment variable first, then common system paths
   */
  private getChromeExecutablePath(): string | undefined {
    // Check environment variable first
    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
      return process.env.PUPPETEER_EXECUTABLE_PATH;
    }

    // Common Chrome/Chromium paths for different platforms
    const commonPaths = [
      // macOS
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      // Linux
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      // Windows (if running on Windows)
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    ];

    // Check if any common path exists
    for (const path of commonPaths) {
      if (existsSync(path)) {
        this.logger.debug(`Found Chrome/Chromium at: ${path}`);
        return path;
      }
    }

    // Try to find Chrome via which command (Unix-like systems)
    try {
      const chromePath = execSync(
        'which google-chrome || which chromium || which chromium-browser',
        {
          encoding: 'utf-8',
        },
      ).trim();
      if (chromePath) {
        this.logger.debug(`Found Chrome/Chromium via which: ${chromePath}`);
        return chromePath;
      }
    } catch (_error) {
      // which command failed, continue
    }

    // If no path found, return undefined to let Puppeteer use its bundled Chrome
    // (requires: npx puppeteer browsers install chrome)
    return undefined;
  }

  /**
   * Generate PDF buffer from invoice data
   */
  async generateInvoicePdf(invoice: InvoiceModel): Promise<Buffer> {
    try {
      const htmlContent = this.generateInvoiceHtml(invoice);

      const executablePath = this.getChromeExecutablePath();
      const launchOptions: any = {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      };

      if (executablePath) {
        launchOptions.executablePath = executablePath;
      }

      const browser = await puppeteer.launch(launchOptions);
      const page = await browser.newPage();
      await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

      const pdfBuffer = await page.pdf({
        format: 'A4',
        margin: {
          top: '0.5cm',
          bottom: '0.5cm',
          left: '0.5cm',
          right: '0.5cm',
        },
        printBackground: true,
      });

      await browser.close();

      this.logger.log(`Generated PDF for invoice ${invoice.invoiceNumber}`);

      return Buffer.from(pdfBuffer);
    } catch (error) {
      this.logger.error(
        `Error generating PDF for invoice ${invoice.invoiceNumber}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Generate HTML template for invoice
   */
  private generateInvoiceHtml(invoice: InvoiceModel): string {
    const fromDetails = (invoice as any).fromDetails || {};
    const toDetails = (invoice as any).toDetails || {};
    const items = (invoice as any).items || [];
    const isB2B = invoice.invoiceType === InvoiceTypeEnum.B2B;

    // Use payment details from the invoice model if available, otherwise fallback to fromDetails
    const paymentNetwork = (invoice as any).paymentNetwork || {};
    const paymentToken = (invoice as any).paymentToken || {};
    const walletAddress =
      invoice.paymentWalletAddress || fromDetails.walletAddress || 'N/A';

    // Get currency symbol
    const currencySymbol = CurrencySymbols[invoice.currency] || invoice.currency;

    // Prepare FROM section based on invoice type
    const fromCompanyName = isB2B
      ? (invoice as any).fromCompany?.companyName || fromDetails.companyName || 'N/A'
      : fromDetails.companyName || fromDetails.name || 'N/A';
    const fromName = isB2B
      ? fromDetails.contactName || ''
      : fromDetails.name || '';
    const fromEmail = fromDetails.email || (invoice as any).fromCompany?.notificationEmail || 'N/A';
    const fromTaxId = isB2B
      ? fromDetails.taxId || (invoice as any).fromCompany?.taxId || ''
      : '';

    // Prepare TO section
    const toCompanyName = toDetails.companyName || invoice.toCompanyName || 'N/A';
    const toContactName = toDetails.contactName || invoice.toCompanyContactName || '';
    const toEmail = toDetails.email || invoice.toCompanyEmail || '';
    const toAddress = toDetails.address || toDetails.address1 || invoice.toCompanyAddress || '';
    const toTaxId = toDetails.taxId || invoice.toCompanyTaxId || '';

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Invoice ${invoice.invoiceNumber}</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                margin: 0;
                padding: 20px;
                color: #333;
            }
            .invoice-header {
                display: flex;
                justify-content: space-between;
                margin-bottom: 30px;
                border-bottom: 2px solid #007bff;
                padding-bottom: 20px;
            }
            .invoice-title {
                font-size: 28px;
                font-weight: bold;
                color: #007bff;
            }
            .invoice-type {
                font-size: 12px;
                color: #666;
                background-color: ${isB2B ? '#e3f2fd' : '#f3e5f5'};
                padding: 2px 8px;
                border-radius: 4px;
                margin-left: 10px;
            }
            .invoice-number {
                font-size: 18px;
                color: #666;
            }
            .invoice-details {
                display: flex;
                justify-content: space-between;
                margin-bottom: 30px;
            }
            .from-section, .bill-to-section {
                width: 45%;
            }
            .section-title {
                font-weight: bold;
                font-size: 16px;
                margin-bottom: 10px;
                color: #007bff;
            }
            .address-block {
                line-height: 1.6;
            }
            .tax-id {
                font-size: 12px;
                color: #666;
            }
            .invoice-meta {
                margin-bottom: 30px;
                background-color: #f8f9fa;
                padding: 15px;
                border-radius: 5px;
            }
            .meta-row {
                display: flex;
                justify-content: space-between;
                margin-bottom: 5px;
            }
            .items-table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 30px;
            }
            .items-table th,
            .items-table td {
                border: 1px solid #ddd;
                padding: 12px;
                text-align: left;
            }
            .items-table th {
                background-color: #007bff;
                color: white;
                font-weight: bold;
            }
            .items-table tr:nth-child(even) {
                background-color: #f8f9fa;
            }
            .amount-column {
                text-align: right;
            }
            .totals-section {
                width: 300px;
                margin-left: auto;
                border: 1px solid #ddd;
                border-radius: 5px;
            }
            .total-row {
                display: flex;
                justify-content: space-between;
                padding: 10px 15px;
                border-bottom: 1px solid #eee;
            }
            .total-row:last-child {
                border-bottom: none;
                background-color: #007bff;
                color: white;
                font-weight: bold;
            }
            .footer {
                margin-top: 50px;
                padding-top: 20px;
                border-top: 1px solid #eee;
                font-size: 12px;
                color: #666;
                text-align: center;
            }
            .network-info {
                background-color: #e3f2fd;
                padding: 10px;
                border-radius: 5px;
                margin-top: 10px;
                font-size: 12px;
            }
            .terms-section {
                margin-top: 30px;
                padding: 15px;
                background-color: #f8f9fa;
                border-radius: 5px;
                font-size: 12px;
            }
        </style>
    </head>
    <body>
        <div class="invoice-header">
            <div>
                <div class="invoice-title">
                    INVOICE
                    <span class="invoice-type">${isB2B ? 'B2B' : 'Payroll'}</span>
                </div>
                <div class="invoice-number">#${invoice.invoiceNumber}</div>
            </div>
            <div>
                <div><strong>Issue Date:</strong> ${invoice.issueDate.toLocaleDateString()}</div>
                <div><strong>Due Date:</strong> ${invoice.dueDate.toLocaleDateString()}</div>
                <div><strong>Currency:</strong> ${invoice.currency}</div>
            </div>
        </div>

        <div class="invoice-details">
            <div class="from-section">
                <div class="section-title">FROM</div>
                <div class="address-block">
                    <div><strong>${fromCompanyName}</strong></div>
                    ${fromName && fromName !== fromCompanyName ? `<div>${fromName}</div>` : ''}
                    <div>${fromEmail}</div>
                    ${fromDetails.address1 ? `<div>${fromDetails.address1}</div>` : ''}
                    ${fromDetails.address2 ? `<div>${fromDetails.address2}</div>` : ''}
                    ${fromDetails.city || fromDetails.country ? `<div>${[fromDetails.city, fromDetails.state, fromDetails.country, fromDetails.postalCode].filter(Boolean).join(', ')}</div>` : ''}
                    ${fromTaxId ? `<div class="tax-id">Tax ID: ${fromTaxId}</div>` : ''}
                </div>
                <div class="network-info">
                    <div><strong>Payment Details:</strong></div>
                    <div>Network: ${paymentNetwork.name || fromDetails.network?.name || 'N/A'}</div>
                    <div>Token: ${paymentToken.symbol || fromDetails.token?.symbol || 'N/A'}</div>
                    <div>Address: ${walletAddress}</div>
                </div>
            </div>

            <div class="bill-to-section">
                <div class="section-title">BILL TO</div>
                <div class="address-block">
                    <div><strong>${toCompanyName}</strong></div>
                    ${toContactName ? `<div>Attn: ${toContactName}</div>` : ''}
                    ${toEmail ? `<div>${toEmail}</div>` : ''}
                    ${toAddress ? `<div>${toAddress}</div>` : ''}
                    ${toDetails.address2 ? `<div>${toDetails.address2}</div>` : ''}
                    ${toDetails.city || toDetails.country ? `<div>${[toDetails.city, toDetails.state, toDetails.country, toDetails.postalCode].filter(Boolean).join(', ')}</div>` : ''}
                    ${toTaxId ? `<div class="tax-id">Tax ID: ${toTaxId}</div>` : ''}
                </div>
            </div>
        </div>

        <table class="items-table">
            <thead>
                <tr>
                    <th>Description</th>
                    <th>Quantity</th>
                    <th>Unit</th>
                    <th class="amount-column">Rate</th>
                    <th class="amount-column">Amount</th>
                </tr>
            </thead>
            <tbody>
                ${items
                  .map(
                    (item) => `
                    <tr>
                        <td>${item.description}</td>
                        <td>${item.quantity}</td>
                        <td>${item.unit || '-'}</td>
                        <td class="amount-column">${currencySymbol}${item.unitPrice || item.pricePerUnit || '0.00'}</td>
                        <td class="amount-column">${currencySymbol}${item.total}</td>
                    </tr>
                `,
                  )
                  .join('')}
            </tbody>
        </table>

        <div class="totals-section">
            <div class="total-row">
                <span>Subtotal:</span>
                <span>${currencySymbol}${invoice.subtotal}</span>
            </div>
            ${parseFloat(invoice.discount) > 0 ? `
            <div class="total-row">
                <span>Discount:</span>
                <span>-${currencySymbol}${invoice.discount}</span>
            </div>
            ` : ''}
            <div class="total-row">
                <span>Tax (${invoice.taxRate}%):</span>
                <span>${currencySymbol}${invoice.taxAmount}</span>
            </div>
            <div class="total-row">
                <span>Total (${invoice.currency}):</span>
                <span>${currencySymbol}${invoice.total}</span>
            </div>
        </div>

        ${(invoice as any).terms ? `
        <div class="terms-section">
            <strong>Terms & Conditions</strong>
            <p>${typeof (invoice as any).terms === 'object' ? JSON.stringify((invoice as any).terms) : (invoice as any).terms}</p>
        </div>
        ` : ''}

        <div class="footer">
            <p>Thank you for your business!</p>
            <p>${isB2B ? 'This is a business-to-business invoice.' : 'This invoice was generated automatically by the payroll system.'}</p>
        </div>
    </body>
    </html>
    `;
  }

  /**
   * Get PDF filename for invoice
   */
  getInvoiceFilename(invoice: InvoiceModel): string {
    const prefix = invoice.invoiceType === InvoiceTypeEnum.B2B ? 'b2b-invoice' : 'invoice';
    return `${prefix}-${invoice.invoiceNumber}.pdf`;
  }

  /**
   * Generate Payslip PDF buffer from invoice data
   */
  async generatePayslipPdf(invoice: InvoiceModel): Promise<Buffer> {
    try {
      const htmlContent = this.generatePayslipHtml(invoice);

      const executablePath = this.getChromeExecutablePath();
      const launchOptions: any = {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      };

      if (executablePath) {
        launchOptions.executablePath = executablePath;
      }

      const browser = await puppeteer.launch(launchOptions);
      const page = await browser.newPage();
      await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

      const pdfBuffer = await page.pdf({
        format: 'A4',
        margin: {
          top: '0.5cm',
          bottom: '0.5cm',
          left: '0.5cm',
          right: '0.5cm',
        },
        printBackground: true,
      });

      await browser.close();

      this.logger.log(`Generated payslip PDF for invoice ${invoice.invoiceNumber}`);

      return Buffer.from(pdfBuffer);
    } catch (error) {
      this.logger.error(
        `Error generating payslip PDF for invoice ${invoice.invoiceNumber}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Generate HTML template for payslip
   */
  private generatePayslipHtml(invoice: InvoiceModel): string {
    const employee = (invoice as any).employee || {};
    const company = (invoice as any).payroll?.company || {};
    const items = (invoice as any).items || [];
    
    // Get token symbol
    const tokenSymbol = (invoice as any).paymentToken?.symbol || invoice.currency || 'USD';

    // Calculate earnings and deductions
    const earnings = items.filter((item) => parseFloat(item.total) > 0);
    
    const totalEarnings = earnings.reduce((sum, item) => sum + parseFloat(item.total), 0);
    const totalBonus = 0; // Assuming no separate bonus items for now
    const netPay = parseFloat(invoice.total);

    // Format dates
    const issueDate = new Date(invoice.issueDate);
    const dueDate = new Date(invoice.dueDate);
    const payPeriod = issueDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
    const paymentDate = dueDate.toLocaleDateString('en-GB'); // DD/MM/YYYY format
    
    // Calculate payment period (assuming monthly, show start and end dates)
    const startDate = new Date(issueDate);
    startDate.setDate(1);
    const endDate = new Date(issueDate.getFullYear(), issueDate.getMonth() + 1, 0);
    const paymentPeriod = `${startDate.toLocaleDateString('en-GB')} - ${endDate.toLocaleDateString('en-GB')}`;

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Payslip - ${employee.name}</title>
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            body {
                font-family: 'Barlow', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
                padding: 0;
                color: #1b1b1b;
                background: white;
            }
            .payslip-wrapper {
                background: white;
                max-width: 850px;
                margin: 0 auto;
            }
            .payslip-container {
                background: white;
                padding: 20px;
            }
            .header-section {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding-bottom: 16px;
                border-bottom: 1px solid rgba(153, 160, 174, 0.24);
            }
            .company-info {
                display: flex;
                gap: 8px;
                align-items: center;
            }
            .company-logo {
                width: 40px;
                height: 40px;
                background: linear-gradient(135deg, #066eff 0%, #00a86b 100%);
                border-radius: 5.926px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: bold;
                color: white;
                font-size: 14px;
            }
            .company-details h3 {
                font-family: 'Barlow', sans-serif;
                font-weight: 600;
                font-size: 16px;
                margin: 0;
                color: #1b1b1b;
            }
            .company-details p {
                font-size: 11px;
                color: #848484;
                margin: 0;
                font-weight: 500;
            }
            .payslip-title {
                font-size: 32px;
                font-weight: 700;
                color: #1b1b1b;
                text-transform: uppercase;
                letter-spacing: -0.64px;
            }
            .date-section {
                display: flex;
                padding: 20px;
                align-items: center;
                border-bottom: 1px solid rgba(153, 160, 174, 0.24);
            }
            .date-item {
                flex: 1;
                text-align: center;
            }
            .date-item-label {
                font-size: 14px;
                font-weight: 500;
                color: #848484;
                margin-bottom: 4px;
            }
            .date-item-value {
                font-size: 14px;
                font-weight: 500;
                color: #1b1b1b;
            }
            .content-section {
                padding: 16px 40px;
            }
            .info-cards {
                display: flex;
                gap: 12px;
                margin-bottom: 16px;
                height: 160px;
            }
            .info-card {
                flex: 1;
                border: 0.978px solid rgba(153, 160, 174, 0.24);
                border-radius: 16px;
                padding: 20px;
                display: flex;
                flex-direction: column;
                justify-content: space-between;
            }
            .info-card-title {
                font-size: 14px;
                font-weight: 500;
                color: #848484;
                margin-bottom: 12px;
            }
            .info-card-name {
                font-size: 16px;
                font-weight: 600;
                color: #066eff;
                margin-bottom: 4px;
            }
            .info-card-detail {
                font-size: 12px;
                color: #848484;
                font-weight: 400;
                margin-bottom: 8px;
            }
            .info-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
                font-size: 12px;
                font-weight: 500;
            }
            .info-row-label {
                color: #848484;
            }
            .info-row-value {
                color: #1b1b1b;
            }
            .summary-section {
                margin-bottom: 16px;
            }
            .section-title {
                font-size: 16px;
                font-weight: 600;
                color: #1b1b1b;
                margin-bottom: 16px;
            }
            .summary-cards {
                display: flex;
                gap: 8px;
            }
            .summary-card {
                flex: 1;
                background: #f5f5f6;
                border-radius: 16px;
                padding: 20px;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                gap: 2px;
            }
            .summary-card-label {
                font-size: 12px;
                font-weight: 500;
                color: #848484;
            }
            .summary-card-amount {
                font-size: 18px;
                font-weight: 600;
                color: #1b1b1b;
            }
            .detail-box {
                border: 0.978px solid rgba(153, 160, 174, 0.24);
                border-radius: 16px;
                padding: 20px;
                margin-bottom: 12px;
            }
            .detail-box-title {
                font-size: 14px;
                font-weight: 600;
                color: #1b1b1b;
                margin-bottom: 12px;
            }
            .detail-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 8px 0;
                font-size: 12px;
            }
            .detail-row-label {
                color: #848484;
                font-weight: 500;
            }
            .detail-row-value {
                color: #1b1b1b;
                font-weight: 500;
                word-break: break-all;
                text-align: right;
                max-width: 50%;
            }
            .detail-row-value.link {
                color: #066eff;
                text-decoration: underline;
                font-size: 11px;
            }
            .confirmation-box {
                border: 0.978px solid rgba(153, 160, 174, 0.24);
                border-radius: 16px;
                padding: 20px;
                display: flex;
                gap: 16px;
                align-items: center;
            }
            .check-icon {
                flex-shrink: 0;
                width: 24px;
                height: 24px;
                background: #02be75;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-weight: bold;
            }
            .confirmation-text {
                flex: 1;
                display: flex;
                flex-direction: column;
                gap: 4px;
            }
            .confirmation-title {
                font-size: 14px;
                font-weight: 600;
                color: #1b1b1b;
                margin-bottom: 4px;
            }
            .confirmation-detail {
                font-size: 12px;
                color: #848484;
                font-weight: 500;
            }
            .confirmation-amount {
                font-size: 20px;
                font-weight: 600;
                color: #1b1b1b;
                white-space: nowrap;
            }
            .footer-section {
                border-top: 1px solid rgba(153, 160, 174, 0.16);
                padding: 18px 40px;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            .footer-text {
                font-size: 9px;
                color: rgba(132, 132, 132, 0.5);
                font-weight: 700;
            }
            .qash-logo {
                width: 33px;
                height: 12.6px;
                background: linear-gradient(135deg, #066eff 0%, #00a86b 100%);
                border-radius: 2px;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-size: 8px;
                font-weight: bold;
            }
            .status-success {
                color: #02be75;
                font-weight: 600;
            }
            .status-neutral {
                color: #1b1b1b;
                font-weight: 500;
            }
        </style>
    </head>
    <body>
        <div class="payslip-wrapper">
            <div class="payslip-container">
                <div class="header-section">
                    <div class="company-info">
                        <img src="https://raw.githubusercontent.com/qash-finance/qash-server/refs/heads/main/images/qash-logo.png" style="height: 40px; width: 100%; display: block;" alt=""/>
                        <div class="company-details">
                            <h3>${company.companyName}</h3>
                            <p>${company.address}</p>
                        </div>
                    </div>
                    <div class="payslip-title">Payslip</div>
                </div>

                <div class="date-section">
                    <div class="date-item">
                        <div class="date-item-label">Pay Period</div>
                        <div class="date-item-value">${payPeriod}</div>
                    </div>
                    <div class="date-item">
                        <div class="date-item-label">Payment date</div>
                        <div class="date-item-value">${paymentDate}</div>
                    </div>
                    <div class="date-item">
                        <div class="date-item-label">Payment period</div>
                        <div class="date-item-value">${paymentPeriod}</div>
                    </div>
                </div>

                <div class="content-section">
                    <div class="info-cards">
                        <div class="info-card">
                            <div>
                                <div class="info-card-title">Company Information</div>
                                <div class="info-card-name">${company.companyName}</div>
                                <div class="info-card-detail">${company.address}</div>
                            </div>
                            <div class="info-row">
                                <span class="info-row-label">Payment by</span>
                                <span class="info-row-value">Finance Department</span>
                            </div>
                        </div>
                        <div class="info-card">
                            <div>
                                <div class="info-card-title">Employee Information</div>
                                <div class="info-card-name">${employee.name}</div>
                                <div class="info-card-detail">${employee.email || 'N/A'}</div>
                            </div>
                            <div class="info-row">
                                <span class="info-row-label">Department</span>
                                <span class="info-row-value">${employee.group?.name || 'N/A'}</span>
                            </div>
                        </div>
                    </div>

                    <div class="summary-section">
                        <div class="section-title">Payment Summary</div>
                        <div class="summary-cards">
                            <div class="summary-card">
                                <div class="summary-card-label">Base Salary</div>
                                <div class="summary-card-amount">${tokenSymbol}${totalEarnings.toFixed(2)}</div>
                            </div>
                            <div class="summary-card">
                                <div class="summary-card-label">Bonus</div>
                                <div class="summary-card-amount">${tokenSymbol}${totalBonus.toFixed(2)}</div>
                            </div>
                            <div class="summary-card">
                                <div class="summary-card-label">Take Home Pay</div>
                                <div class="summary-card-amount">${tokenSymbol}${netPay.toFixed(2)}</div>
                            </div>
                        </div>
                    </div>

                    <div class="detail-box">
                        <div class="detail-box-title">Payment Transfer Detail</div>
                        <div class="detail-row">
                            <span class="detail-row-label">Token</span>
                            <span class="detail-row-value">${invoice.currency || 'N/A'}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-row-label">Network</span>
                            <span class="detail-row-value">${(invoice as any).paymentNetwork?.name || 'Ethereum'}</span>
                        </div>
                        ${(invoice as any).transactionHash ? `
                        <div class="detail-row">
                            <span class="detail-row-label">Transaction hash</span>
                            <span class="detail-row-value link">${(invoice as any).transactionHash}</span>
                        </div>
                        ` : ''}
                        ${(invoice as any).paymentWalletAddress ? `
                        <div class="detail-row">
                            <span class="detail-row-label">Wallet address</span>
                            <span class="detail-row-value link">${(invoice as any).paymentWalletAddress}</span>
                        </div>
                        ` : ''}
                        <div class="detail-row">
                            <span class="detail-row-label">Amount</span>
                            <span class="detail-row-value">${tokenSymbol}${netPay.toFixed(2)}</span>
                        </div>
                    </div>

                    <div class="detail-box">
                        <div class="detail-box-title">Transaction Information</div>
                        <div class="detail-row">
                            <span class="detail-row-label">Status</span>
                            <span class="detail-row-value status-success">Success</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-row-label">Processed</span>
                            <span class="detail-row-value">${paymentDate}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-row-label">Method</span>
                            <span class="detail-row-value">Token Transfer</span>
                        </div>
                    </div>

                    <div class="confirmation-box">
                        <div class="confirmation-text">
                            <div class="check-icon">✓</div>
                            <div class="confirmation-title">Payment Confirmed</div>
                            <div class="confirmation-detail">Your salary has been successfully transferred</div>
                        </div>
                        <div class="confirmation-amount">${tokenSymbol}${netPay.toFixed(2)}</div>
                    </div>
                </div>

                <div class="footer-section">
                    <div class="footer-text">This is a computer generated invoice, doesn't required any signature.</div>
                    <img src="https://raw.githubusercontent.com/qash-finance/qash-server/refs/heads/main/images/qash-logo.png" style="width: 20px; display: block;" alt=""/>
                </div>
            </div>
        </div>
    </body>
    </html>
    `;
  }

  /**
   * Get PDF filename for payslip
   */
  getPayslipFilename(invoice: InvoiceModel): string {
    const employee = (invoice as any).employee || {};
    const employeeName = `${employee.name}`.toLowerCase().replace(/\s+/g, '-');
    const date = new Date(invoice.issueDate);
    const month = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).replace(' ', '-');
    return `payslip-${employeeName}-${month}.pdf`;
  }
}
