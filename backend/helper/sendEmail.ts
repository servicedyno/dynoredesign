import mailTransporter from "../utils/mailTransporter";

/**
 * Get currency symbol for a given currency code
 * @param currency - ISO 4217 currency code (e.g., 'USD', 'EUR', 'GBP')
 * @returns Currency symbol (e.g., '$', '€', '£')
 */
const getCurrencySymbol = (currency: string): string => {
  const symbols: Record<string, string> = {
    USD: '$', EUR: '€', GBP: '£', AUD: 'A$', CAD: 'C$', CHF: 'CHF ',
    CNY: '¥', JPY: '¥', HKD: 'HK$', NZD: 'NZ$', SGD: 'S$',
    BRL: 'R$', ARS: 'ARS ', COP: 'COP ', CLP: 'CLP ', PEN: 'S/', MXN: 'MX$', VES: 'Bs.', UYU: '$U',
    NGN: '₦', ZAR: 'R', KES: 'KSh', GHS: 'GH₵', TZS: 'TSh', XAF: 'FCFA ', XOF: 'CFA ', EGP: 'E£', MAD: 'MAD ',
    UGX: 'USh', RWF: 'FRw', ETB: 'Br', ZMW: 'ZK', BWP: 'P', MUR: '₨', AOA: 'Kz', MZN: 'MT', CDF: 'FC'
  };
  return symbols[currency?.toUpperCase()] || `${currency} `;
};

/**
 * Format amount with currency symbol
 * @param amount - Numeric amount
 * @param currency - ISO 4217 currency code
 * @returns Formatted string like "$100.00 USD" or "€85.50 EUR"
 */
const formatAmountWithCurrency = (amount: number, currency: string = 'USD'): string => {
  const symbol = getCurrencySymbol(currency);
  return `${symbol}${amount.toFixed(2)} ${currency}`;
};

// Public CDN-hosted PNG logo for maximum email client compatibility
// PNG format is supported by all major email clients (Gmail, Outlook, Apple Mail)
const DYNOPAY_LOGO_URL = "https://files.catbox.moe/9wq2et.png";

const getDynopayLogoUrl = () => {
  return DYNOPAY_LOGO_URL;
};

const dynoPayEmailTemplate = (
  name: string,
  message: string,
  heading: string,
  _showImage: boolean = false
) => {
  const LOGO_URL = getDynopayLogoUrl();
  const html = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
  <html xmlns="http://www.w3.org/1999/xhtml">
    <head>
      <meta charset="UTF-8" />
      <meta content="width=device-width, initial-scale=1" name="viewport" />
      <meta name="x-apple-disable-message-reformatting" />
      <meta http-equiv="X-UA-Compatible" content="IE=edge" />
      <meta content="telephone=no" name="format-detection" />
      <title>Dynopay</title>
      <!--[if mso]>
      <style type="text/css">
        body, table, td {font-family: Arial, Helvetica, sans-serif !important;}
      </style>
      <![endif]-->
      <meta name="color-scheme" content="light dark">
      <meta name="supported-color-schemes" content="light dark">
      <style type="text/css">
        :root { color-scheme: light dark; supported-color-schemes: light dark; }
        @media (prefers-color-scheme: dark) {
          body, .dm-wrapper { background-color: #0f172a !important; }
          .dm-card { background-color: #1e293b !important; box-shadow: 0 2px 8px rgba(0,0,0,0.4) !important; }
          .dm-content { background-color: #1e293b !important; }
          .dm-content h1 { color: #93c5fd !important; }
          .dm-content p { color: #e2e8f0 !important; }
          .dm-content div { color: #e2e8f0 !important; }
          .dm-content li { color: #e2e8f0 !important; }
          .dm-content td { color: #e2e8f0 !important; }
          .dm-content strong { color: #f1f5f9 !important; }
          .dm-content a:not(.button) { color: #93c5fd !important; }
          .dm-content [style*="color: #6b7280"] { color: #94a3b8 !important; }
          .dm-content [style*="color: #9ca3af"] { color: #94a3b8 !important; }
          .dm-content [style*="color: #166534"] { color: #86efac !important; }
          .dm-content [style*="color: #92400e"] { color: #fcd34d !important; }
          .dm-content [style*="color: #14532d"] { color: #86efac !important; }
          .dm-content [style*="color: #dc2626"] { color: #f87171 !important; }
          .dm-content [style*="background: #f8f9ff"] { background: #162032 !important; }
          .dm-content [style*="background: linear-gradient(135deg, #f8f9ff"] { background: #162032 !important; }
          .dm-content [style*="background: linear-gradient(135deg, #f0fff4"] { background: #0d2818 !important; }
          .dm-content [style*="background: #fef2f2"] { background: #2a1215 !important; }
          .dm-content [style*="background: #fffbeb"] { background: #27200d !important; }
          .dm-content [style*="background: #fef3c7"] { background: #332d1a !important; }
          .dm-content [style*="background: #f0fdf4"] { background: #0d2818 !important; }
          .dm-content [style*="background: #dcfce7"] { background: #1a3325 !important; }
          .dm-content [style*="background: #e5e7eb"] { background: #334155 !important; }
          .dm-content [style*="border-bottom: 1px solid #f3f4f6"] { border-bottom-color: #334155 !important; }
          .dm-text { color: #e2e8f0 !important; }
          .dm-text strong { color: #f1f5f9 !important; }
          .dm-border { border-top-color: #334155 !important; }
          .dm-footer { background: #0b1120 !important; }
          .dm-footer td { color: #94a3b8 !important; }
          .dm-footer a { color: #94a3b8 !important; }
          u + .body .dm-wrapper { background-color: #0f172a !important; }
        }
        @media only screen and (max-width: 600px) {
          .dm-card { width: 100% !important; margin: 0 !important; border-radius: 0 !important; }
          .dm-content { padding: 24px 20px !important; }
          .dm-footer { padding: 24px 20px !important; }
        }
      </style>
    </head>
    <body class="body" style="margin: 0; padding: 0; background-color: #f5f7fa; -webkit-font-smoothing: antialiased;">
      <table role="presentation" class="dm-wrapper" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f7fa; table-layout: fixed;">
        <tr>
          <td align="center" style="padding: 20px 10px;">
            <table role="presentation" class="dm-card" width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #1034a6 0%, #0d2570 100%); padding: 28px 32px; text-align: center;">
                  <a href="https://dynopay.com" style="text-decoration: none;">
                    <img src="${LOGO_URL}" alt="dynopay" width="134" height="45" style="display: inline-block; max-width: 134px; height: auto;" />
                  </a>
                </td>
              </tr>
              <!-- Content -->
              <tr>
                <td class="dm-content" style="padding: 40px 32px; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">
                  <h1 style="font-size: 24px; font-weight: 600; color: #1034a6; margin: 0 0 24px 0; font-family: 'Inter', Arial, sans-serif;">${heading}</h1>
                  <p style="font-size: 16px; color: #1a1a2e; margin: 0 0 16px 0; font-family: 'Inter', Arial, sans-serif;">Hey ${name || "there"},</p>
                  <div style="font-size: 15px; color: #4a4a4a; line-height: 1.6; font-family: 'Inter', Arial, sans-serif;">${message}</div>
                  <table role="presentation" class="dm-border" width="100%" cellpadding="0" cellspacing="0" style="margin-top: 32px; border-top: 1px solid #e5e7eb; padding-top: 24px;">
                    <tr>
                      <td class="dm-text" style="font-family: 'Inter', Arial, sans-serif; font-size: 15px; color: #4a4a4a;">
                        Best regards,<br /><strong>The Dynopay Team</strong>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <!-- Footer -->
              <tr>
                <td class="dm-footer" style="background: #1a1a2e; padding: 32px; text-align: center;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td align="center" style="padding-bottom: 16px;">
                        <img src="${LOGO_URL}" alt="dynopay" width="110" height="37" style="display: inline-block; max-width: 110px; height: auto; opacity: 0.9;" />
                      </td>
                    </tr>
                    <tr>
                      <td align="center" style="color: #9ca3af; font-size: 13px; font-family: 'Inter', Arial, sans-serif; padding-bottom: 8px;">
                        Secure Crypto Payment Gateway
                      </td>
                    </tr>
                    <tr>
                      <td align="center" style="padding: 20px 0;">
                        <table role="presentation" cellpadding="0" cellspacing="0">
                          <tr>
                            <td style="padding: 0 6px;">
                              <a href="https://www.facebook.com/dynopay" target="_blank" style="text-decoration: none;">
                                <img src="https://cdn-icons-png.flaticon.com/512/733/733547.png" alt="Facebook" width="26" height="26" style="display: block; border-radius: 50%;" />
                              </a>
                            </td>
                            <td style="padding: 0 6px;">
                              <a href="https://www.instagram.com/dynopay" target="_blank" style="text-decoration: none;">
                                <img src="https://cdn-icons-png.flaticon.com/512/733/733558.png" alt="Instagram" width="26" height="26" style="display: block; border-radius: 50%;" />
                              </a>
                            </td>
                            <td style="padding: 0 6px;">
                              <a href="https://x.com/dynopaycom" target="_blank" style="text-decoration: none;">
                                <img src="https://cdn-icons-png.flaticon.com/512/5969/5969020.png" alt="X" width="26" height="26" style="display: block; border-radius: 50%;" />
                              </a>
                            </td>
                            <td style="padding: 0 6px;">
                              <a href="https://www.linkedin.com/company/dynopay/" target="_blank" style="text-decoration: none;">
                                <img src="https://cdn-icons-png.flaticon.com/512/733/733561.png" alt="LinkedIn" width="26" height="26" style="display: block; border-radius: 50%;" />
                              </a>
                            </td>
                            <td style="padding: 0 6px;">
                              <a href="https://t.me/Dynopay_Announcements" target="_blank" style="text-decoration: none;">
                                <img src="https://cdn-icons-png.flaticon.com/512/2111/2111646.png" alt="Telegram" width="26" height="26" style="display: block; border-radius: 50%;" />
                              </a>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    <tr>
                      <td align="center" style="color: #9ca3af; font-size: 13px; font-family: 'Inter', Arial, sans-serif; padding-bottom: 16px;">
                        &copy; ${new Date().getFullYear()} Dynopay. All rights reserved.
                      </td>
                    </tr>
                    <tr>
                      <td align="center">
                        <table role="presentation" cellpadding="0" cellspacing="0">
                          <tr>
                            <td style="padding: 0 12px;">
                              <a href="https://dynopay.com/privacy" style="color: #9ca3af; text-decoration: none; font-size: 13px; font-family: 'Inter', Arial, sans-serif;">Privacy</a>
                            </td>
                            <td style="padding: 0 12px;">
                              <a href="https://dynopay.com/terms" style="color: #9ca3af; text-decoration: none; font-size: 13px; font-family: 'Inter', Arial, sans-serif;">Terms</a>
                            </td>
                            <td style="padding: 0 12px;">
                              <a href="https://dynopay.com/support" style="color: #9ca3af; text-decoration: none; font-size: 13px; font-family: 'Inter', Arial, sans-serif;">Support</a>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>`;
  return html;
};

const sendEmail = async (
  recipientEmail: string,
  name: string,
  subject: string,
  message: string,
  showImage = false
) => {
  try {
    // Wrap message in Dynopay branded HTML template
    const htmlBody = dynoPayEmailTemplate(name, message, subject, showImage);
    
    const info = await mailTransporter({
      to: recipientEmail,
      name,
      subject,
      body: htmlBody,
    });
    return info;
  } catch (e) {
    console.log("Email send error:", e);
  }
};

/**
 * Send payment received email notification
 * Always sent regardless of user preferences
 */
const sendPaymentReceivedEmail = async (
  recipientEmail: string,
  name: string,
  amount: string,
  currency: string,
  companyName: string,
  transactionId: string,
  date?: string,
  time?: string
) => {
  try {
    const subject = `Payment received — ${amount} ${currency}`;
    const dateTimeRow = date && time 
      ? `<tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-family: 'Inter', Arial, sans-serif; border-bottom: 1px solid #f3f4f6;">Date</td><td style="padding: 8px 0; color: #1a1a2e; font-size: 14px; font-family: 'Inter', Arial, sans-serif; text-align: right; border-bottom: 1px solid #f3f4f6;">${date} at ${time}</td></tr>` 
      : '';
    
    const htmlContent = `
      <p style="font-size: 15px; color: #4a4a4a; line-height: 1.6; margin: 0 0 16px 0; font-family: 'Inter', Arial, sans-serif;">Great news! Your company <strong style="color: #1a1a2e;">${companyName}</strong> has received a payment.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #f8f9ff; border-radius: 8px; border-left: 4px solid #22c55e; margin: 24px 0;">
        <tr><td style="padding: 20px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-family: 'Inter', Arial, sans-serif; border-bottom: 1px solid #f3f4f6;">Amount</td><td style="padding: 8px 0; color: #1a1a2e; font-size: 16px; font-weight: 600; font-family: 'Inter', Arial, sans-serif; text-align: right; border-bottom: 1px solid #f3f4f6;">${amount} ${currency}</td></tr>
            <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-family: 'Inter', Arial, sans-serif; border-bottom: 1px solid #f3f4f6;">Status</td><td style="padding: 8px 0; font-family: 'Inter', Arial, sans-serif; text-align: right; border-bottom: 1px solid #f3f4f6;"><span style="background: #dcfce7; color: #166534; padding: 4px 12px; border-radius: 12px; font-size: 13px; font-weight: 500;">Received</span></td></tr>
            ${dateTimeRow}
            <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-family: 'Inter', Arial, sans-serif;">Transaction ID</td><td style="padding: 8px 0; color: #1a1a2e; font-size: 13px; font-family: 'Inter', Arial, monospace; text-align: right; word-break: break-all;">${transactionId}</td></tr>
          </table>
        </td></tr>
      </table>
      <p style="font-size: 15px; color: #4a4a4a; line-height: 1.6; margin: 16px 0 0 0; font-family: 'Inter', Arial, sans-serif;">The funds have been credited to your wallet. You can view the full transaction details in your Dynopay dashboard.</p>`;

    const htmlBody = dynoPayEmailTemplate(name, htmlContent, "Payment Received");
    const info = await mailTransporter({
      to: recipientEmail,
      name,
      subject,
      body: htmlBody,
    });
    return info;
  } catch (e) {
    console.log("Payment received email error:", e);
  }
};

/**
 * Send transaction confirmed email notification
 */
const sendTransactionConfirmedEmail = async (
  recipientEmail: string,
  name: string,
  transactionId: string,
  amount: string,
  currency: string,
  status: string
) => {
  try {
    const subject = `Transaction ${status} - Dynopay`;
    const statusColor = status.toLowerCase() === 'confirmed' ? '#166534' : '#1034a6';
    const statusBg = status.toLowerCase() === 'confirmed' ? '#dcfce7' : '#eef1ff';
    
    const htmlContent = `
      <p style="font-size: 15px; color: #4a4a4a; line-height: 1.6; margin: 0 0 16px 0; font-family: 'Inter', Arial, sans-serif;">Your transaction has been <strong style="color: ${statusColor};">${status.toLowerCase()}</strong>.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #f8f9ff; border-radius: 8px; border-left: 4px solid #1034a6; margin: 24px 0;">
        <tr><td style="padding: 20px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-family: 'Inter', Arial, sans-serif; border-bottom: 1px solid #f3f4f6;">Transaction ID</td><td style="padding: 8px 0; color: #1a1a2e; font-size: 13px; font-family: 'Inter', Arial, monospace; text-align: right; border-bottom: 1px solid #f3f4f6; word-break: break-all;">${transactionId}</td></tr>
            <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-family: 'Inter', Arial, sans-serif; border-bottom: 1px solid #f3f4f6;">Amount</td><td style="padding: 8px 0; color: #1a1a2e; font-size: 16px; font-weight: 600; font-family: 'Inter', Arial, sans-serif; text-align: right; border-bottom: 1px solid #f3f4f6;">${amount} ${currency}</td></tr>
            <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-family: 'Inter', Arial, sans-serif;">Status</td><td style="padding: 8px 0; font-family: 'Inter', Arial, sans-serif; text-align: right;"><span style="background: ${statusBg}; color: ${statusColor}; padding: 4px 12px; border-radius: 12px; font-size: 13px; font-weight: 500;">${status}</span></td></tr>
          </table>
        </td></tr>
      </table>
      <p style="font-size: 15px; color: #4a4a4a; line-height: 1.6; margin: 16px 0 0 0; font-family: 'Inter', Arial, sans-serif;">You can view more details in your Dynopay dashboard.</p>`;

    const htmlBody = dynoPayEmailTemplate(name, htmlContent, `Transaction ${status}`);
    const info = await mailTransporter({
      to: recipientEmail,
      name,
      subject,
      body: htmlBody,
    });
    return info;
  } catch (e) {
    console.log("Transaction confirmed email error:", e);
  }
};

/**
 * Send weekly summary email
 */
const sendWeeklySummaryEmail = async (
  recipientEmail: string,
  name: string,
  summaryData: {
    periodStart: string;
    periodEnd: string;
    transactionCount: number;
    totalVolume: number;
    completedCount: number;
    pendingCount: number;
    currency?: string;
  }
) => {
  try {
    const currency = summaryData.currency || 'USD';
    const currencySymbol = getCurrencySymbol(currency);
    const subject = "Your Weekly Summary - Dynopay";
    
    const htmlContent = `
      <p style="font-size: 15px; color: #4a4a4a; line-height: 1.6; margin: 0 0 16px 0; font-family: 'Inter', Arial, sans-serif;">Here's your weekly activity summary for <strong style="color: #1a1a2e;">${summaryData.periodStart}</strong> to <strong style="color: #1a1a2e;">${summaryData.periodEnd}</strong>.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
        <tr>
          <td style="padding: 0 6px 12px 0; width: 50%;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #f8f9ff; border-radius: 8px;">
              <tr><td style="padding: 16px; text-align: center;">
                <p style="font-size: 28px; font-weight: 700; color: #1034a6; margin: 0; font-family: 'Inter', Arial, sans-serif;">${summaryData.transactionCount}</p>
                <p style="font-size: 13px; color: #6b7280; margin: 4px 0 0 0; font-family: 'Inter', Arial, sans-serif;">Total Transactions</p>
              </td></tr>
            </table>
          </td>
          <td style="padding: 0 0 12px 6px; width: 50%;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #f0fdf4; border-radius: 8px;">
              <tr><td style="padding: 16px; text-align: center;">
                <p style="font-size: 28px; font-weight: 700; color: #166534; margin: 0; font-family: 'Inter', Arial, sans-serif;">${currencySymbol}${summaryData.totalVolume.toFixed(2)}</p>
                <p style="font-size: 13px; color: #6b7280; margin: 4px 0 0 0; font-family: 'Inter', Arial, sans-serif;">Total Volume (${currency})</p>
              </td></tr>
            </table>
          </td>
        </tr>
      </table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #f8f9ff; border-radius: 8px; border-left: 4px solid #1034a6; margin: 0 0 24px 0;">
        <tr><td style="padding: 20px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-family: 'Inter', Arial, sans-serif; border-bottom: 1px solid #f3f4f6;">Completed</td><td style="padding: 8px 0; font-family: 'Inter', Arial, sans-serif; text-align: right; border-bottom: 1px solid #f3f4f6;"><span style="background: #dcfce7; color: #166534; padding: 4px 12px; border-radius: 12px; font-size: 13px; font-weight: 500;">${summaryData.completedCount}</span></td></tr>
            <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-family: 'Inter', Arial, sans-serif;">Pending</td><td style="padding: 8px 0; font-family: 'Inter', Arial, sans-serif; text-align: right;"><span style="background: #fef3c7; color: #92400e; padding: 4px 12px; border-radius: 12px; font-size: 13px; font-weight: 500;">${summaryData.pendingCount}</span></td></tr>
          </table>
        </td></tr>
      </table>
      <p style="font-size: 15px; color: #4a4a4a; line-height: 1.6; margin: 0; font-family: 'Inter', Arial, sans-serif;">Log in to your dashboard for detailed analytics and insights. Keep up the great work!</p>`;

    const htmlBody = dynoPayEmailTemplate(name, htmlContent, "Weekly Summary");
    const info = await mailTransporter({
      to: recipientEmail,
      name,
      subject,
      body: htmlBody,
    });
    return info;
  } catch (e) {
    console.log("Weekly summary email error:", e);
  }
};

/**
 * Send security alert email
 */
const sendSecurityAlertEmail = async (
  recipientEmail: string,
  name: string,
  alertType: string,
  details: string
) => {
  try {
    const subject = "Security Alert - Dynopay";
    
    const htmlContent = `
      <p style="font-size: 15px; color: #4a4a4a; line-height: 1.6; margin: 0 0 16px 0; font-family: 'Inter', Arial, sans-serif;">We detected unusual activity on your account.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #fef2f2; border-radius: 8px; border-left: 4px solid #dc2626; margin: 24px 0;">
        <tr><td style="padding: 20px;">
          <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #991b1b; font-family: 'Inter', Arial, sans-serif;">Alert Type: ${alertType}</p>
          <p style="margin: 0; font-size: 14px; color: #7f1d1d; line-height: 1.5; font-family: 'Inter', Arial, sans-serif;">${details}</p>
        </td></tr>
      </table>
      <p style="font-size: 15px; color: #4a4a4a; line-height: 1.6; margin: 0 0 12px 0; font-family: 'Inter', Arial, sans-serif;">If this was you, you can ignore this message. If you didn't perform this action, please secure your account immediately:</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 24px 0;">
        <tr><td style="padding: 8px 0 8px 16px; font-size: 14px; color: #4a4a4a; font-family: 'Inter', Arial, sans-serif;">1. Change your password</td></tr>
        <tr><td style="padding: 8px 0 8px 16px; font-size: 14px; color: #4a4a4a; font-family: 'Inter', Arial, sans-serif;">2. Enable two-factor authentication</td></tr>
        <tr><td style="padding: 8px 0 8px 16px; font-size: 14px; color: #4a4a4a; font-family: 'Inter', Arial, sans-serif;">3. Contact our support team</td></tr>
      </table>
      <p style="font-size: 15px; color: #4a4a4a; line-height: 1.6; margin: 0; font-family: 'Inter', Arial, sans-serif;">Your security is our priority.</p>`;

    const htmlBody = dynoPayEmailTemplate(name, htmlContent, "Security Alert");
    const info = await mailTransporter({
      to: recipientEmail,
      name,
      subject,
      body: htmlBody,
    });
    return info;
  } catch (e) {
    console.log("Security alert email error:", e);
  }
};

/**
 * Send pending payment notification email
 * Sent when an unconfirmed transaction is detected on the blockchain
 */
const sendPaymentPendingEmail = async (
  recipientEmail: string,
  name: string,
  companyName: string,
  amount: string,
  currency: string,
  transactionId: string,
  confirmationsRequired: number = 1
) => {
  try {
    const subject = "Payment Pending Confirmation - Dynopay";
    
    const htmlContent = `
      <p style="font-size: 15px; color: #4a4a4a; line-height: 1.6; margin: 0 0 16px 0; font-family: 'Inter', Arial, sans-serif;">A new payment has been detected for your company <strong style="color: #1a1a2e;">${companyName}</strong>!</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #f8f9ff; border-radius: 8px; border-left: 4px solid #f59e0b; margin: 24px 0;">
        <tr><td style="padding: 20px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-family: 'Inter', Arial, sans-serif; border-bottom: 1px solid #f3f4f6;">Amount</td><td style="padding: 8px 0; color: #1a1a2e; font-size: 16px; font-weight: 600; font-family: 'Inter', Arial, sans-serif; text-align: right; border-bottom: 1px solid #f3f4f6;">${amount} ${currency}</td></tr>
            <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-family: 'Inter', Arial, sans-serif; border-bottom: 1px solid #f3f4f6;">Status</td><td style="padding: 8px 0; font-family: 'Inter', Arial, sans-serif; text-align: right; border-bottom: 1px solid #f3f4f6;"><span style="background: #fef3c7; color: #92400e; padding: 4px 12px; border-radius: 12px; font-size: 13px; font-weight: 500;">Awaiting Confirmation</span></td></tr>
            <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-family: 'Inter', Arial, sans-serif;">Transaction ID</td><td style="padding: 8px 0; color: #1a1a2e; font-size: 13px; font-family: 'Inter', Arial, monospace; text-align: right; word-break: break-all;">${transactionId}</td></tr>
          </table>
        </td></tr>
      </table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #fffbeb; border-radius: 8px; margin: 0 0 24px 0;">
        <tr><td style="padding: 16px 20px;">
          <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #92400e; font-family: 'Inter', Arial, sans-serif;">Estimated Confirmation Times</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="padding: 4px 0; font-size: 13px; color: #78350f; font-family: 'Inter', Arial, sans-serif;">BTC: 10-60 min (${confirmationsRequired} confirmation${confirmationsRequired > 1 ? 's' : ''})</td></tr>
            <tr><td style="padding: 4px 0; font-size: 13px; color: #78350f; font-family: 'Inter', Arial, sans-serif;">ETH/ERC20: 1-5 min</td></tr>
            <tr><td style="padding: 4px 0; font-size: 13px; color: #78350f; font-family: 'Inter', Arial, sans-serif;">TRX/TRC20: 1-3 min</td></tr>
            <tr><td style="padding: 4px 0; font-size: 13px; color: #78350f; font-family: 'Inter', Arial, sans-serif;">LTC: 2-30 min &bull; DOGE: 1-10 min</td></tr>
          </table>
        </td></tr>
      </table>
      <p style="font-size: 15px; color: #4a4a4a; line-height: 1.6; margin: 0; font-family: 'Inter', Arial, sans-serif;">We'll notify you once the payment is fully confirmed and credited to your wallet. You can track the transaction status in your Dynopay dashboard.</p>`;

    const htmlBody = dynoPayEmailTemplate(name, htmlContent, "Payment Pending");
    const info = await mailTransporter({
      to: recipientEmail,
      name,
      subject,
      body: htmlBody,
    });
    return info;
  } catch (e) {
    console.log("Payment pending email error:", e);
  }
};

/**
 * Send payment confirming notification email
 * Sent when a transaction is being confirmed (for chains requiring multiple confirmations)
 */
const sendPaymentConfirmingEmail = async (
  recipientEmail: string,
  name: string,
  companyName: string,
  amount: string,
  currency: string,
  transactionId: string,
  currentConfirmations: number,
  requiredConfirmations: number
) => {
  try {
    const subject = `Payment Confirming (${currentConfirmations}/${requiredConfirmations}) - Dynopay`;
    const progressPct = Math.min(100, Math.round((currentConfirmations / requiredConfirmations) * 100));
    const isComplete = currentConfirmations >= requiredConfirmations;
    
    const htmlContent = `
      <p style="font-size: 15px; color: #4a4a4a; line-height: 1.6; margin: 0 0 16px 0; font-family: 'Inter', Arial, sans-serif;">Good news! Your payment for <strong style="color: #1a1a2e;">${companyName}</strong> is being confirmed.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #f8f9ff; border-radius: 8px; border-left: 4px solid #3b82f6; margin: 24px 0;">
        <tr><td style="padding: 20px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-family: 'Inter', Arial, sans-serif; border-bottom: 1px solid #f3f4f6;">Amount</td><td style="padding: 8px 0; color: #1a1a2e; font-size: 16px; font-weight: 600; font-family: 'Inter', Arial, sans-serif; text-align: right; border-bottom: 1px solid #f3f4f6;">${amount} ${currency}</td></tr>
            <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-family: 'Inter', Arial, sans-serif; border-bottom: 1px solid #f3f4f6;">Confirmations</td><td style="padding: 8px 0; color: #1a1a2e; font-size: 14px; font-weight: 600; font-family: 'Inter', Arial, sans-serif; text-align: right; border-bottom: 1px solid #f3f4f6;">${currentConfirmations} of ${requiredConfirmations}</td></tr>
            <tr><td colspan="2" style="padding: 12px 0 4px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #e5e7eb; border-radius: 4px; height: 8px;">
                <tr><td style="width: ${progressPct}%; background: ${isComplete ? '#22c55e' : '#3b82f6'}; border-radius: 4px; height: 8px;">&nbsp;</td><td style="height: 8px;">&nbsp;</td></tr>
              </table>
            </td></tr>
            <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-family: 'Inter', Arial, sans-serif;">Transaction ID</td><td style="padding: 8px 0; color: #1a1a2e; font-size: 13px; font-family: 'Inter', Arial, monospace; text-align: right; word-break: break-all;">${transactionId}</td></tr>
          </table>
        </td></tr>
      </table>
      <p style="font-size: 15px; color: #4a4a4a; line-height: 1.6; margin: 0; font-family: 'Inter', Arial, sans-serif;">${isComplete
        ? "The payment has reached the required confirmations and will be credited shortly!"
        : `${requiredConfirmations - currentConfirmations} more confirmation${requiredConfirmations - currentConfirmations > 1 ? 's' : ''} needed before the payment is credited.`} You can track the full status in your Dynopay dashboard.</p>`;

    const htmlBody = dynoPayEmailTemplate(name, htmlContent, "Payment Confirming");
    const info = await mailTransporter({
      to: recipientEmail,
      name,
      subject,
      body: htmlBody,
    });
    return info;
  } catch (e) {
    console.log("Payment confirming email error:", e);
  }
};

/**
 * Send partial payment notification email
 * Sent when a partial payment is received and more funds are needed
 */
const sendPaymentPartialEmail = async (
  recipientEmail: string,
  name: string,
  companyName: string,
  receivedAmount: string,
  expectedAmount: string,
  remainingAmount: string,
  currency: string,
  transactionId: string,
  walletAddress: string,
  gracePeriodMinutes: number = 30
) => {
  try {
    const subject = "Partial Payment Received - Action Required - Dynopay";
    
    const htmlContent = `
      <p style="font-size: 15px; color: #4a4a4a; line-height: 1.6; margin: 0 0 16px 0; font-family: 'Inter', Arial, sans-serif;">A partial payment has been received for your company <strong style="color: #1a1a2e;">${companyName}</strong>.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #f8f9ff; border-radius: 8px; border-left: 4px solid #f59e0b; margin: 24px 0;">
        <tr><td style="padding: 20px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-family: 'Inter', Arial, sans-serif; border-bottom: 1px solid #f3f4f6;">Expected Amount</td><td style="padding: 8px 0; color: #1a1a2e; font-size: 14px; font-family: 'Inter', Arial, sans-serif; text-align: right; border-bottom: 1px solid #f3f4f6;">${expectedAmount} ${currency}</td></tr>
            <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-family: 'Inter', Arial, sans-serif; border-bottom: 1px solid #f3f4f6;">Received</td><td style="padding: 8px 0; color: #166534; font-size: 14px; font-weight: 600; font-family: 'Inter', Arial, sans-serif; text-align: right; border-bottom: 1px solid #f3f4f6;">${receivedAmount} ${currency}</td></tr>
            <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-family: 'Inter', Arial, sans-serif; border-bottom: 1px solid #f3f4f6;">Remaining</td><td style="padding: 8px 0; color: #dc2626; font-size: 14px; font-weight: 600; font-family: 'Inter', Arial, sans-serif; text-align: right; border-bottom: 1px solid #f3f4f6;">${remainingAmount} ${currency}</td></tr>
            <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-family: 'Inter', Arial, sans-serif;">Transaction ID</td><td style="padding: 8px 0; color: #1a1a2e; font-size: 13px; font-family: 'Inter', Arial, monospace; text-align: right; word-break: break-all;">${transactionId}</td></tr>
          </table>
        </td></tr>
      </table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #fef2f2; border-radius: 8px; border-left: 4px solid #dc2626; margin: 0 0 24px 0;">
        <tr><td style="padding: 16px 20px;">
          <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #991b1b; font-family: 'Inter', Arial, sans-serif;">Action Required</p>
          <p style="margin: 0; font-size: 14px; color: #7f1d1d; line-height: 1.5; font-family: 'Inter', Arial, sans-serif;">You have <strong>${gracePeriodMinutes} minutes</strong> to send the remaining <strong>${remainingAmount} ${currency}</strong> to complete this payment.</p>
        </td></tr>
      </table>
      <p style="font-size: 14px; color: #4a4a4a; line-height: 1.6; margin: 0 0 8px 0; font-family: 'Inter', Arial, sans-serif;"><strong>Send to:</strong></p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #f3f4f6; border-radius: 6px; margin: 0 0 24px 0;">
        <tr><td style="padding: 12px 16px; font-size: 13px; color: #1a1a2e; font-family: 'Inter', Arial, monospace; word-break: break-all;">${walletAddress}</td></tr>
      </table>
      <p style="font-size: 14px; color: #6b7280; line-height: 1.6; margin: 0; font-family: 'Inter', Arial, sans-serif;">If the remaining amount is received within ${gracePeriodMinutes} minutes, the full payment will be processed. If the grace period expires, the partial amount will be processed with adjusted fees.</p>`;

    const htmlBody = dynoPayEmailTemplate(name, htmlContent, "Partial Payment Received");
    const info = await mailTransporter({
      to: recipientEmail,
      name,
      subject,
      body: htmlBody,
    });
    return info;
  } catch (e) {
    console.log("Payment partial email error:", e);
  }
};

/**
 * Send partial payment expired notification email
 * Sent when a partial payment grace period has expired
 */
const sendPaymentPartialExpiredEmail = async (
  recipientEmail: string,
  name: string,
  companyName: string,
  receivedAmount: string,
  expectedAmount: string,
  currency: string,
  transactionId: string,
  status: "completed_partial" | "incomplete_expired"
) => {
  try {
    const isCompleted = status === "completed_partial";
    const subject = isCompleted 
      ? "Partial Payment Processed - Dynopay"
      : "Partial Payment Expired - Dynopay";
    const heading = isCompleted ? "Partial Payment Processed" : "Payment Grace Period Expired";
    const borderColor = isCompleted ? '#22c55e' : '#f59e0b';
    const statusBg = isCompleted ? '#dcfce7' : '#fef3c7';
    const statusColor = isCompleted ? '#166534' : '#92400e';
    const statusLabel = isCompleted ? 'Processed' : 'Expired';
    
    const htmlContent = `
      <p style="font-size: 15px; color: #4a4a4a; line-height: 1.6; margin: 0 0 16px 0; font-family: 'Inter', Arial, sans-serif;">${isCompleted
        ? `The partial payment for your company <strong style="color: #1a1a2e;">${companyName}</strong> has been processed.`
        : `The grace period for the partial payment to your company <strong style="color: #1a1a2e;">${companyName}</strong> has expired.`}</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #f8f9ff; border-radius: 8px; border-left: 4px solid ${borderColor}; margin: 24px 0;">
        <tr><td style="padding: 20px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-family: 'Inter', Arial, sans-serif; border-bottom: 1px solid #f3f4f6;">Expected Amount</td><td style="padding: 8px 0; color: #1a1a2e; font-size: 14px; font-family: 'Inter', Arial, sans-serif; text-align: right; border-bottom: 1px solid #f3f4f6;">${expectedAmount} ${currency}</td></tr>
            <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-family: 'Inter', Arial, sans-serif; border-bottom: 1px solid #f3f4f6;">Received Amount</td><td style="padding: 8px 0; color: #1a1a2e; font-size: 14px; font-weight: 600; font-family: 'Inter', Arial, sans-serif; text-align: right; border-bottom: 1px solid #f3f4f6;">${receivedAmount} ${currency}</td></tr>
            <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-family: 'Inter', Arial, sans-serif; border-bottom: 1px solid #f3f4f6;">Status</td><td style="padding: 8px 0; font-family: 'Inter', Arial, sans-serif; text-align: right; border-bottom: 1px solid #f3f4f6;"><span style="background: ${statusBg}; color: ${statusColor}; padding: 4px 12px; border-radius: 12px; font-size: 13px; font-weight: 500;">${statusLabel}</span></td></tr>
            <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-family: 'Inter', Arial, sans-serif;">Transaction ID</td><td style="padding: 8px 0; color: #1a1a2e; font-size: 13px; font-family: 'Inter', Arial, monospace; text-align: right; word-break: break-all;">${transactionId}</td></tr>
          </table>
        </td></tr>
      </table>
      <p style="font-size: 15px; color: #4a4a4a; line-height: 1.6; margin: 0; font-family: 'Inter', Arial, sans-serif;">${isCompleted
        ? "The received amount has been processed with adjusted fees and forwarded to your wallet."
        : "Since the full payment was not received within the grace period, the partial amount has been processed. Please note that fees may be higher for incomplete payments."} You can view the transaction details in your Dynopay dashboard.</p>`;

    const htmlBody = dynoPayEmailTemplate(name, htmlContent, heading);
    const info = await mailTransporter({
      to: recipientEmail,
      name,
      subject,
      body: htmlBody,
    });
    return info;
  } catch (e) {
    console.log("Payment partial expired email error:", e);
  }
};

/**
 * Send admin fee received email notification
 * Sent to admin when platform fee is received from a merchant payment
 */
const sendAdminFeeReceivedEmail = async (
  recipientEmail: string,
  name: string,
  feeAmount: string,
  currency: string,
  transactionId: string,
  companyName: string,
  merchantAmount: string,
  totalAmount: string
) => {
  try {
    const subject = `Platform Fee Received — ${feeAmount} ${currency}`;
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    
    const merchantAmountNum = parseFloat(merchantAmount);
    const feeAmountNum = parseFloat(feeAmount);
    const totalAmountNum = parseFloat(totalAmount);
    const isUnderThreshold = merchantAmountNum === 0 && feeAmountNum === totalAmountNum;
    
    let detailRows: string;
    let noticeBlock = '';
    
    if (isUnderThreshold) {
      detailRows = `
            <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-family: 'Inter', Arial, sans-serif; border-bottom: 1px solid #f3f4f6;">Total Received</td><td style="padding: 8px 0; color: #1a1a2e; font-size: 16px; font-weight: 600; font-family: 'Inter', Arial, sans-serif; text-align: right; border-bottom: 1px solid #f3f4f6;">${feeAmount} ${currency}</td></tr>
            <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-family: 'Inter', Arial, sans-serif; border-bottom: 1px solid #f3f4f6;">Status</td><td style="padding: 8px 0; font-family: 'Inter', Arial, sans-serif; text-align: right; border-bottom: 1px solid #f3f4f6;"><span style="background: #fef3c7; color: #92400e; padding: 4px 12px; border-radius: 12px; font-size: 13px; font-weight: 500;">Under Threshold</span></td></tr>
            <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-family: 'Inter', Arial, sans-serif; border-bottom: 1px solid #f3f4f6;">Merchant Received</td><td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-family: 'Inter', Arial, sans-serif; text-align: right; border-bottom: 1px solid #f3f4f6;">${merchantAmount} ${currency}</td></tr>
            <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-family: 'Inter', Arial, sans-serif; border-bottom: 1px solid #f3f4f6;">Platform Received</td><td style="padding: 8px 0; color: #166534; font-size: 14px; font-weight: 600; font-family: 'Inter', Arial, sans-serif; text-align: right; border-bottom: 1px solid #f3f4f6;">${feeAmount} ${currency} (100%)</td></tr>
            <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-family: 'Inter', Arial, sans-serif; border-bottom: 1px solid #f3f4f6;">Date</td><td style="padding: 8px 0; color: #1a1a2e; font-size: 14px; font-family: 'Inter', Arial, sans-serif; text-align: right; border-bottom: 1px solid #f3f4f6;">${dateStr} at ${timeStr}</td></tr>
            <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-family: 'Inter', Arial, sans-serif; border-bottom: 1px solid #f3f4f6;">Company</td><td style="padding: 8px 0; color: #1a1a2e; font-size: 14px; font-family: 'Inter', Arial, sans-serif; text-align: right; border-bottom: 1px solid #f3f4f6;">${companyName}</td></tr>
            <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-family: 'Inter', Arial, sans-serif;">Transaction ID</td><td style="padding: 8px 0; color: #1a1a2e; font-size: 13px; font-family: 'Inter', Arial, monospace; text-align: right; word-break: break-all;">${transactionId}</td></tr>`;
      noticeBlock = `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #fef3c7; border-radius: 8px; border-left: 4px solid #f59e0b; margin: 0 0 24px 0;">
        <tr><td style="padding: 16px 20px;">
          <p style="margin: 0; font-size: 14px; color: #92400e; line-height: 1.5; font-family: 'Inter', Arial, sans-serif;"><strong>Under Threshold:</strong> This payment was below the minimum forwarding threshold. All funds have been credited to the admin ${currency} wallet.</p>
        </td></tr>
      </table>`;
    } else {
      detailRows = `
            <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-family: 'Inter', Arial, sans-serif; border-bottom: 1px solid #f3f4f6;">Platform Fee</td><td style="padding: 8px 0; color: #166534; font-size: 16px; font-weight: 600; font-family: 'Inter', Arial, sans-serif; text-align: right; border-bottom: 1px solid #f3f4f6;">${feeAmount} ${currency}</td></tr>
            <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-family: 'Inter', Arial, sans-serif; border-bottom: 1px solid #f3f4f6;">Status</td><td style="padding: 8px 0; font-family: 'Inter', Arial, sans-serif; text-align: right; border-bottom: 1px solid #f3f4f6;"><span style="background: #dcfce7; color: #166534; padding: 4px 12px; border-radius: 12px; font-size: 13px; font-weight: 500;">Processed</span></td></tr>
            <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-family: 'Inter', Arial, sans-serif; border-bottom: 1px solid #f3f4f6;">Merchant Net</td><td style="padding: 8px 0; color: #1a1a2e; font-size: 14px; font-family: 'Inter', Arial, sans-serif; text-align: right; border-bottom: 1px solid #f3f4f6;">${merchantAmount} ${currency}</td></tr>
            <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-family: 'Inter', Arial, sans-serif; border-bottom: 1px solid #f3f4f6;">Total Processed</td><td style="padding: 8px 0; color: #1a1a2e; font-size: 14px; font-family: 'Inter', Arial, sans-serif; text-align: right; border-bottom: 1px solid #f3f4f6;">${totalAmount} ${currency}</td></tr>
            <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-family: 'Inter', Arial, sans-serif; border-bottom: 1px solid #f3f4f6;">Date</td><td style="padding: 8px 0; color: #1a1a2e; font-size: 14px; font-family: 'Inter', Arial, sans-serif; text-align: right; border-bottom: 1px solid #f3f4f6;">${dateStr} at ${timeStr}</td></tr>
            <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-family: 'Inter', Arial, sans-serif; border-bottom: 1px solid #f3f4f6;">Company</td><td style="padding: 8px 0; color: #1a1a2e; font-size: 14px; font-family: 'Inter', Arial, sans-serif; text-align: right; border-bottom: 1px solid #f3f4f6;">${companyName}</td></tr>
            <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-family: 'Inter', Arial, sans-serif;">Transaction ID</td><td style="padding: 8px 0; color: #1a1a2e; font-size: 13px; font-family: 'Inter', Arial, monospace; text-align: right; word-break: break-all;">${transactionId}</td></tr>`;
    }
    
    const htmlContent = `
      <p style="font-size: 15px; color: #4a4a4a; line-height: 1.6; margin: 0 0 16px 0; font-family: 'Inter', Arial, sans-serif;">Platform fee received from <strong style="color: #1a1a2e;">${companyName}</strong>.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #f8f9ff; border-radius: 8px; border-left: 4px solid #22c55e; margin: 24px 0;">
        <tr><td style="padding: 20px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            ${detailRows}
          </table>
        </td></tr>
      </table>
      ${noticeBlock}
      <p style="font-size: 15px; color: #4a4a4a; line-height: 1.6; margin: 0; font-family: 'Inter', Arial, sans-serif;">The fee has been credited to the admin ${currency} wallet. You can view the full transaction details in the Dynopay admin dashboard.</p>`;

    const htmlBody = dynoPayEmailTemplate(name, htmlContent, "Platform Fee Received");
    const info = await mailTransporter({
      to: recipientEmail,
      name,
      subject,
      body: htmlBody,
    });
    return info;
  } catch (e) {
    console.log("Admin fee received email error:", e);
  }
};

/**
 * Send admin notification email when admin fees are swept from a pool address to admin wallet
 * This is sent when the sweep (blockchain transfer) actually completes, not when the fee is calculated.
 */
const sendAdminFeeSweepEmail = async (
  recipientEmail: string,
  amountSwept: string,
  currency: string,
  fromAddress: string,
  toAddress: string,
  sweepTxId: string,
  gasUsed: string,
  sweepMode: string
) => {
  try {
    const subject = `Admin Fee Swept — ${amountSwept} ${currency}`;
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

    const detailRows = `
          <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-family: 'Inter', Arial, sans-serif; border-bottom: 1px solid #f3f4f6;">Amount Swept</td><td style="padding: 8px 0; color: #166534; font-size: 16px; font-weight: 600; font-family: 'Inter', Arial, sans-serif; text-align: right; border-bottom: 1px solid #f3f4f6;">${amountSwept} ${currency}</td></tr>
          <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-family: 'Inter', Arial, sans-serif; border-bottom: 1px solid #f3f4f6;">Status</td><td style="padding: 8px 0; font-family: 'Inter', Arial, sans-serif; text-align: right; border-bottom: 1px solid #f3f4f6;"><span style="background: #dcfce7; color: #166534; padding: 4px 12px; border-radius: 12px; font-size: 13px; font-weight: 500;">Swept</span></td></tr>
          <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-family: 'Inter', Arial, sans-serif; border-bottom: 1px solid #f3f4f6;">Sweep Mode</td><td style="padding: 8px 0; color: #1a1a2e; font-size: 14px; font-family: 'Inter', Arial, sans-serif; text-align: right; border-bottom: 1px solid #f3f4f6;">${sweepMode === 'threshold' ? 'USD Threshold' : 'Time-Based'}</td></tr>
          <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-family: 'Inter', Arial, sans-serif; border-bottom: 1px solid #f3f4f6;">Gas Used</td><td style="padding: 8px 0; color: #1a1a2e; font-size: 14px; font-family: 'Inter', Arial, sans-serif; text-align: right; border-bottom: 1px solid #f3f4f6;">${gasUsed}</td></tr>
          <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-family: 'Inter', Arial, sans-serif; border-bottom: 1px solid #f3f4f6;">From Address</td><td style="padding: 8px 0; color: #1a1a2e; font-size: 12px; font-family: 'Inter', Arial, monospace; text-align: right; word-break: break-all; border-bottom: 1px solid #f3f4f6;">${fromAddress}</td></tr>
          <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-family: 'Inter', Arial, sans-serif; border-bottom: 1px solid #f3f4f6;">To Admin Wallet</td><td style="padding: 8px 0; color: #1a1a2e; font-size: 12px; font-family: 'Inter', Arial, monospace; text-align: right; word-break: break-all; border-bottom: 1px solid #f3f4f6;">${toAddress}</td></tr>
          <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-family: 'Inter', Arial, sans-serif; border-bottom: 1px solid #f3f4f6;">Date</td><td style="padding: 8px 0; color: #1a1a2e; font-size: 14px; font-family: 'Inter', Arial, sans-serif; text-align: right; border-bottom: 1px solid #f3f4f6;">${dateStr} at ${timeStr}</td></tr>
          <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-family: 'Inter', Arial, sans-serif;">Sweep TX ID</td><td style="padding: 8px 0; color: #1a1a2e; font-size: 12px; font-family: 'Inter', Arial, monospace; text-align: right; word-break: break-all;">${sweepTxId}</td></tr>`;

    const htmlContent = `
      <p style="font-size: 15px; color: #4a4a4a; line-height: 1.6; margin: 0 0 16px 0; font-family: 'Inter', Arial, sans-serif;">Admin fees have been swept from a pool address to the admin wallet.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #f8f9ff; border-radius: 8px; border-left: 4px solid #3b82f6; margin: 24px 0;">
        <tr><td style="padding: 20px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            ${detailRows}
          </table>
        </td></tr>
      </table>
      <p style="font-size: 15px; color: #4a4a4a; line-height: 1.6; margin: 0; font-family: 'Inter', Arial, sans-serif;">The admin fees have been transferred to the admin ${currency} wallet. You can verify the transaction on the blockchain explorer.</p>`;

    const htmlBody = dynoPayEmailTemplate("Dynopay Admin", htmlContent, "Admin Fee Sweep Completed");
    const info = await mailTransporter({
      to: recipientEmail,
      name: "Dynopay Admin",
      subject,
      body: htmlBody,
    });
    return info;
  } catch (e) {
    console.log("Admin fee sweep email error:", e);
  }
};


/**
 * Send referee code reminder email
 * Encourages recipients to sign up before their discount expires
 */
const sendRefereeCodeReminderEmail = async (
  recipientEmail: string,
  code: string,
  discountPercent: number,
  discountDurationDays: number,
  daysRemaining: number,
  reminderType: 'week1' | 'week2' | 'week3' | 'final',
  unsubscribeToken: string
) => {
  try {
    const baseUrl = process.env.FRONTEND_URL || process.env.CHECKOUT_URL || 'https://dynopay.io';
    const signupUrl = `${baseUrl}/signup?ref=${code}`;
    const unsubscribeUrl = `${baseUrl}/unsubscribe?token=${unsubscribeToken}`;
    
    let subject: string;
    let urgencyMessage: string;
    let ctaText: string;
    
    switch (reminderType) {
      case 'week1':
        subject = "Don't forget your exclusive Dynopay offer! 🎁";
        urgencyMessage = `You still have <strong>${daysRemaining} days</strong> to claim your exclusive discount.`;
        ctaText = "Claim Your Discount";
        break;
      case 'week2':
        subject = "Your 50% discount is waiting - Dynopay 💰";
        urgencyMessage = `Your exclusive <strong>${discountPercent}% discount</strong> is still available! Only <strong>${daysRemaining} days</strong> remaining.`;
        ctaText = "Start Saving Today";
        break;
      case 'week3':
        subject = `⏰ Only ${daysRemaining} days left on your Dynopay offer!`;
        urgencyMessage = `<strong>Time is running out!</strong> Your exclusive ${discountPercent}% discount expires in just <strong>${daysRemaining} days</strong>.`;
        ctaText = "Don't Miss Out";
        break;
      case 'final':
        subject = "⚠️ LAST CHANCE: Your Dynopay discount expires in 3 days!";
        urgencyMessage = `<strong style="color: #dc2626;">FINAL REMINDER:</strong> Your exclusive ${discountPercent}% discount expires in just <strong>${daysRemaining} days</strong>. This is your last chance!`;
        ctaText = "Claim Now Before It's Gone";
        break;
    }
    
    const message = `
<p>We noticed you haven't claimed your exclusive Dynopay discount yet!</p>

<div style="margin: 24px 0; padding: 20px; background: linear-gradient(135deg, #f0fff4 0%, #e6ffed 100%); border-left: 4px solid #22c55e; border-radius: 0 8px 8px 0;">
  <h3 style="margin: 0 0 12px 0; color: #166534; font-size: 18px;">🎁 Your Exclusive Offer</h3>
  <p style="margin: 0 0 8px 0; color: #14532d; font-size: 16px;">
    <strong>${discountPercent}% OFF</strong> all transaction fees for <strong>${discountDurationDays} days</strong>
  </p>
  <p style="margin: 0; font-size: 14px;">
    Your code: <strong style="background: #dcfce7; padding: 6px 12px; border-radius: 4px; font-family: monospace; font-size: 16px;">${code}</strong>
  </p>
</div>

<p style="font-size: 15px;">${urgencyMessage}</p>

<h4 style="margin: 24px 0 12px 0; color: #1034a6;">Why Dynopay?</h4>
<ul style="margin: 0; padding-left: 20px; color: #4a4a4a;">
  <li>Accept crypto payments from customers worldwide</li>
  <li>Support for Bitcoin, Ethereum, USDT, and more</li>
  <li>Instant notifications and easy dashboard</li>
  <li>Lower fees than traditional payment processors</li>
</ul>

<div style="text-align: center; margin: 32px 0;">
  <a href="${signupUrl}" style="display: inline-block; background: linear-gradient(135deg, #f47323 0%, #e05a00 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: 600; font-size: 16px;">${ctaText}</a>
</div>

<p style="font-size: 13px; color: #6b7280; margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
  <a href="${unsubscribeUrl}" style="color: #6b7280;">Unsubscribe</a> from these reminders
</p>
    `.trim();
    
    const recipientName = recipientEmail.split('@')[0] || "there";
    const htmlBody = dynoPayEmailTemplate(recipientName, message, "Your Discount is Waiting!", false);
    
    const info = await mailTransporter({
      to: recipientEmail,
      name: recipientName,
      subject,
      body: htmlBody,
    });
    
    console.log(`[Email] Referee reminder (${reminderType}) sent to ${recipientEmail}`);
    return info;
  } catch (e) {
    console.log("Referee code reminder email error:", e);
  }
};

/**
 * Send payment link reminder email
 * Reminds customers to complete their pending payment
 */
const sendPaymentLinkReminderEmail = async (
  recipientEmail: string,
  companyName: string,
  amount: string,
  currency: string,
  description: string | null,
  paymentLink: string,
  expiresAt: Date | null,
  reminderType: 'reminder1' | 'reminder2' | 'final',
  unsubscribeToken: string
) => {
  try {
    const baseUrl = process.env.FRONTEND_URL || process.env.CHECKOUT_URL || 'https://dynopay.io';
    const unsubscribeUrl = `${baseUrl}/api/user/unsubscribe-payment-reminders?token=${unsubscribeToken}`;
    
    let subject: string;
    let urgencyMessage: string;
    let ctaText: string;
    let headerText: string;
    
    // Calculate time remaining if expires_at exists
    let timeRemaining = '';
    if (expiresAt) {
      const now = new Date();
      const diffMs = expiresAt.getTime() - now.getTime();
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffHours / 24);
      
      if (diffDays > 0) {
        timeRemaining = `${diffDays} day${diffDays > 1 ? 's' : ''}`;
      } else if (diffHours > 0) {
        timeRemaining = `${diffHours} hour${diffHours > 1 ? 's' : ''}`;
      } else {
        timeRemaining = 'less than an hour';
      }
    }
    
    switch (reminderType) {
      case 'reminder1':
        subject = `Complete your payment to ${companyName}`;
        headerText = "Payment Reminder";
        urgencyMessage = expiresAt 
          ? `You have <strong>${timeRemaining}</strong> to complete this payment.`
          : `Please complete your payment at your earliest convenience.`;
        ctaText = "Complete Payment";
        break;
      case 'reminder2':
        subject = `Your payment to ${companyName} is still pending`;
        headerText = "Payment Still Pending";
        urgencyMessage = expiresAt
          ? `<strong>Don't forget!</strong> You have <strong>${timeRemaining}</strong> remaining to complete this payment.`
          : `We noticed you haven't completed your payment yet. Need help?`;
        ctaText = "Pay Now";
        break;
      case 'final':
        subject = expiresAt 
          ? `⚠️ Payment expires soon - ${companyName}`
          : `Final reminder: Payment pending - ${companyName}`;
        headerText = expiresAt ? "⚠️ Expiring Soon!" : "Final Reminder";
        urgencyMessage = expiresAt
          ? `<strong style="color: #dc2626;">URGENT:</strong> Your payment link expires in <strong>${timeRemaining}</strong>. Please complete your payment now to avoid missing the deadline.`
          : `This is a final reminder about your pending payment. Please complete it soon or contact ${companyName} if you have questions.`;
        ctaText = "Complete Payment Now";
        break;
    }
    
    const message = `
<p>You have a pending payment request from <strong>${companyName}</strong>.</p>

<div style="margin: 24px 0; padding: 20px; background: #f8f9ff; border-radius: 8px; border-left: 4px solid #1034a6;">
  <p style="margin: 0 0 8px 0; font-size: 16px;"><strong>Amount Due:</strong> ${amount} ${currency}</p>
  ${description ? `<p style="margin: 0 0 8px 0;"><strong>Description:</strong> ${description}</p>` : ''}
  ${expiresAt ? `<p style="margin: 0;"><strong>Expires:</strong> ${expiresAt.toLocaleDateString()} at ${expiresAt.toLocaleTimeString()}</p>` : ''}
</div>

<p style="font-size: 15px;">${urgencyMessage}</p>

<div style="text-align: center; margin: 32px 0;">
  <a href="${paymentLink}" style="display: inline-block; background: linear-gradient(135deg, #f47323 0%, #e05a00 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: 600; font-size: 16px;">${ctaText}</a>
</div>

<p style="font-size: 14px; color: #6b7280;">
  If you've already completed this payment, please disregard this email. If you have any questions about this payment, please contact ${companyName} directly.
</p>

<p style="font-size: 13px; color: #9ca3af; margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
  <a href="${unsubscribeUrl}" style="color: #9ca3af;">Unsubscribe</a> from payment reminders
</p>
    `.trim();
    
    const recipientName = recipientEmail.split('@')[0] || "there";
    const htmlBody = dynoPayEmailTemplate(recipientName, message, headerText, false);
    
    const info = await mailTransporter({
      to: recipientEmail,
      name: recipientName,
      subject,
      body: htmlBody,
    });
    
    console.log(`[Email] Payment link reminder (${reminderType}) sent to ${recipientEmail}`);
    return info;
  } catch (e) {
    console.log("Payment link reminder email error:", e);
  }
};

/**
 * Send auto-conversion payout email
 * Sent when a crypto payment is auto-converted to stablecoin and withdrawn to merchant wallet
 * Conditional design: visual volatility indicator if market was volatile, text-focused if stable
 */
const sendAutoConversionPayoutEmail = async (
  recipientEmail: string,
  name: string,
  companyName: string,
  data: {
    sourceCurrency: string;
    sourceAmount: string;
    sourceAmountUsd: string;
    targetCurrency: string;
    payoutAmount: string;
    conversionRate: string;
    priceAtConversion: number;
    currentPrice: number;
    priceMovementPct: number;
    marketState: string;
    feeTierUsed: string;
    transactionId: string;
    conversionId: string;
    withdrawalTxHash?: string;
  }
) => {
  try {
    const {
      sourceCurrency, sourceAmount, sourceAmountUsd,
      targetCurrency, payoutAmount, conversionRate,
      priceAtConversion, currentPrice, priceMovementPct,
      marketState, feeTierUsed, transactionId, conversionId,
      withdrawalTxHash,
    } = data;

    const isVolatile = ["VOLATILE", "DECLINING"].includes(marketState);
    const priceDiffSinceConversion = ((currentPrice - priceAtConversion) / priceAtConversion) * 100;
    const priceDroppedSinceConversion = priceDiffSinceConversion < -0.1;
    const savedAmount = priceDroppedSinceConversion
      ? Math.abs(priceDiffSinceConversion / 100) * parseFloat(payoutAmount)
      : 0;

    const subject = `Payout Complete — ${payoutAmount} ${targetCurrency} from ${sourceAmount} ${sourceCurrency}`;

    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

    // Volatility visual bar (only shown when volatile)
    const volatilityVisual = isVolatile ? `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 20px 0 24px 0;">
        <tr>
          <td style="padding: 16px 20px; background: #fef2f2; border-radius: 8px; border-left: 4px solid #ef4444;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="font-size: 13px; font-weight: 600; color: #991b1b; font-family: 'Inter', Arial, sans-serif; padding-bottom: 10px;">
                  MARKET VOLATILITY AT TIME OF CONVERSION
                </td>
              </tr>
              <tr>
                <td>
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #fecaca; border-radius: 4px; height: 10px;">
                    <tr>
                      <td style="width: ${Math.min(100, Math.abs(priceMovementPct) * 20)}%; background: linear-gradient(90deg, #ef4444, #dc2626); border-radius: 4px; height: 10px;">&nbsp;</td>
                      <td style="height: 10px;">&nbsp;</td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="font-size: 12px; color: #7f1d1d; font-family: 'Inter', Arial, sans-serif; padding-top: 6px;">
                  ${sourceCurrency} moved <strong>${Math.abs(priceMovementPct).toFixed(2)}%</strong> during conversion window &mdash; ${feeTierUsed === 'fast' || feeTierUsed === 'fastest' ? 'fast-tracked with priority fees' : 'processed with standard fees'}
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>` : '';

    // Savings block (shown when price dropped since conversion)
    const savingsBlock = priceDroppedSinceConversion ? `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 24px 0;">
        <tr>
          <td style="padding: 20px; background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-radius: 8px; border-left: 4px solid #22c55e; text-align: center;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="font-size: 13px; font-weight: 600; color: #166534; font-family: 'Inter', Arial, sans-serif; padding-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px;">
                  Auto-Conversion Protected You
                </td>
              </tr>
              <tr>
                <td style="font-size: 28px; font-weight: 700; color: #15803d; font-family: 'Inter', Arial, sans-serif; padding: 8px 0;">
                  ~$${savedAmount.toFixed(2)} saved
                </td>
              </tr>
              <tr>
                <td style="font-size: 13px; color: #166534; font-family: 'Inter', Arial, sans-serif; line-height: 1.5;">
                  ${sourceCurrency} has dropped <strong>${Math.abs(priceDiffSinceConversion).toFixed(2)}%</strong> since your conversion<br/>
                  <span style="color: #6b7280;">Converted at $${priceAtConversion.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} &mdash; Now $${currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>` : '';

    // Price went up since conversion (no savings, but show info)
    const priceUpBlock = !priceDroppedSinceConversion && Math.abs(priceDiffSinceConversion) > 0.1 ? `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 24px 0;">
        <tr>
          <td style="padding: 16px 20px; background: #f8f9ff; border-radius: 8px; border-left: 4px solid #1034a6;">
            <p style="margin: 0; font-size: 13px; color: #4a4a4a; font-family: 'Inter', Arial, sans-serif; line-height: 1.5;">
              ${sourceCurrency} is currently at <strong>$${currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong> 
              (${priceDiffSinceConversion > 0 ? '+' : ''}${priceDiffSinceConversion.toFixed(2)}% since conversion). 
              Your payout was locked in at <strong>$${priceAtConversion.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong> for price certainty.
            </p>
          </td>
        </tr>
      </table>` : '';

    const htmlContent = `
      <p style="font-size: 15px; color: #4a4a4a; line-height: 1.6; margin: 0 0 16px 0; font-family: 'Inter', Arial, sans-serif;">
        Your crypto payment has been auto-converted and the payout has been sent to your wallet.
      </p>

      <!-- Payment & Payout Summary -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
        <tr>
          <td style="padding: 0 4px 12px 0; width: 50%;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #f8f9ff; border-radius: 8px;">
              <tr><td style="padding: 16px; text-align: center;">
                <p style="font-size: 11px; font-weight: 600; color: #6b7280; margin: 0 0 4px 0; font-family: 'Inter', Arial, sans-serif; text-transform: uppercase; letter-spacing: 0.5px;">Received</p>
                <p style="font-size: 22px; font-weight: 700; color: #1034a6; margin: 0; font-family: 'Inter', Arial, sans-serif;">${sourceAmount} ${sourceCurrency}</p>
                <p style="font-size: 12px; color: #6b7280; margin: 4px 0 0 0; font-family: 'Inter', Arial, sans-serif;">~$${parseFloat(sourceAmountUsd).toFixed(2)} USD</p>
              </td></tr>
            </table>
          </td>
          <td style="padding: 0 0 12px 4px; width: 50%;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-radius: 8px;">
              <tr><td style="padding: 16px; text-align: center;">
                <p style="font-size: 11px; font-weight: 600; color: #6b7280; margin: 0 0 4px 0; font-family: 'Inter', Arial, sans-serif; text-transform: uppercase; letter-spacing: 0.5px;">Payout</p>
                <p style="font-size: 22px; font-weight: 700; color: #15803d; margin: 0; font-family: 'Inter', Arial, sans-serif;">${payoutAmount} ${targetCurrency}</p>
                <p style="font-size: 12px; color: #166534; margin: 4px 0 0 0; font-family: 'Inter', Arial, sans-serif;">Sent to your wallet</p>
              </td></tr>
            </table>
          </td>
        </tr>
      </table>

      ${volatilityVisual}
      ${savingsBlock}
      ${priceUpBlock}

      <!-- Conversion Details -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #f8f9ff; border-radius: 8px; border-left: 4px solid #1034a6; margin: 0 0 24px 0;">
        <tr><td style="padding: 20px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-family: 'Inter', Arial, sans-serif; border-bottom: 1px solid #f3f4f6;">Conversion Rate</td><td style="padding: 8px 0; color: #1a1a2e; font-size: 14px; font-weight: 600; font-family: 'Inter', Arial, sans-serif; text-align: right; border-bottom: 1px solid #f3f4f6;">1 ${sourceCurrency} = ${parseFloat(conversionRate).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${targetCurrency}</td></tr>
            <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-family: 'Inter', Arial, sans-serif; border-bottom: 1px solid #f3f4f6;">Market State</td><td style="padding: 8px 0; font-family: 'Inter', Arial, sans-serif; text-align: right; border-bottom: 1px solid #f3f4f6;"><span style="background: ${isVolatile ? '#fef3c7' : '#dcfce7'}; color: ${isVolatile ? '#92400e' : '#166534'}; padding: 4px 12px; border-radius: 12px; font-size: 13px; font-weight: 500;">${marketState}</span></td></tr>
            <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-family: 'Inter', Arial, sans-serif; border-bottom: 1px solid #f3f4f6;">Date</td><td style="padding: 8px 0; color: #1a1a2e; font-size: 14px; font-family: 'Inter', Arial, sans-serif; text-align: right; border-bottom: 1px solid #f3f4f6;">${dateStr} at ${timeStr}</td></tr>
            ${withdrawalTxHash ? `<tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-family: 'Inter', Arial, sans-serif; border-bottom: 1px solid #f3f4f6;">Withdrawal TX</td><td style="padding: 8px 0; color: #1a1a2e; font-size: 12px; font-family: 'Inter', Arial, monospace; text-align: right; word-break: break-all; border-bottom: 1px solid #f3f4f6;">${withdrawalTxHash}</td></tr>` : ''}
            <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-family: 'Inter', Arial, sans-serif;">Conversion ID</td><td style="padding: 8px 0; color: #1a1a2e; font-size: 13px; font-family: 'Inter', Arial, monospace; text-align: right; word-break: break-all;">#${conversionId}</td></tr>
          </table>
        </td></tr>
      </table>

      <p style="font-size: 14px; color: #6b7280; line-height: 1.6; margin: 0; font-family: 'Inter', Arial, sans-serif;">
        Auto-conversion ensures you receive stablecoins, protecting your revenue from crypto price swings. View your full transaction history in your Dynopay dashboard.
      </p>`;

    const htmlBody = dynoPayEmailTemplate(name, htmlContent, "Payout Complete");
    const info = await mailTransporter({
      to: recipientEmail,
      name,
      subject,
      body: htmlBody,
    });

    console.log(`[Email] Auto-conversion payout email sent to ${recipientEmail} (conversion #${conversionId})`);
    return info;
  } catch (e) {
    console.log("Auto-conversion payout email error:", e);
  }
};

export default sendEmail;
export {
  sendEmail,
  sendPaymentReceivedEmail,
  sendPaymentPendingEmail,
  sendPaymentConfirmingEmail,
  sendPaymentPartialEmail,
  sendPaymentPartialExpiredEmail,
  sendTransactionConfirmedEmail,
  sendAdminFeeReceivedEmail,
  sendAdminFeeSweepEmail,
  sendWeeklySummaryEmail,
  sendSecurityAlertEmail,
  sendRefereeCodeReminderEmail,
  sendPaymentLinkReminderEmail,
  sendAutoConversionPayoutEmail,
  dynoPayEmailTemplate,
};
