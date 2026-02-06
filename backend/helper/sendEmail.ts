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

const DYNOPAY_LOGO_URL = "https://raw.githubusercontent.com/Moxxcompany/DynoFrontend/dharmik-new-design/assets/Images/auth/dynopay-logo.png";

const dynoPayEmailTemplate = (
  name: string,
  message: string,
  heading: string,
  _showImage: boolean = false
) => {
  const html = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
  <html xmlns="http://www.w3.org/1999/xhtml">
    <head>
      <meta charset="UTF-8" />
      <meta content="width=device-width, initial-scale=1" name="viewport" />
      <meta name="x-apple-disable-message-reformatting" />
      <meta http-equiv="X-UA-Compatible" content="IE=edge" />
      <meta content="telephone=no" name="format-detection" />
      <title>DynoPay</title>
      <!--[if mso]>
      <style type="text/css">
        body, table, td {font-family: Arial, Helvetica, sans-serif !important;}
      </style>
      <![endif]-->
    </head>
    <body style="margin: 0; padding: 0; background-color: #f5f7fa; -webkit-font-smoothing: antialiased;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f7fa; table-layout: fixed;">
        <tr>
          <td align="center" style="padding: 20px 10px;">
            <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #1034a6 0%, #0d2570 100%); padding: 24px 32px; text-align: center;">
                  <a href="https://dynopay.com" style="text-decoration: none;">
                    <img src="${DYNOPAY_LOGO_URL}" alt="DynoPay" width="140" style="height: 40px; display: inline-block;" />
                  </a>
                </td>
              </tr>
              <!-- Content -->
              <tr>
                <td style="padding: 40px 32px; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">
                  <h1 style="font-size: 24px; font-weight: 600; color: #1034a6; margin: 0 0 24px 0; font-family: 'Inter', Arial, sans-serif;">${heading}</h1>
                  <p style="font-size: 16px; color: #1a1a2e; margin: 0 0 16px 0; font-family: 'Inter', Arial, sans-serif;">Hey ${name || "there"},</p>
                  <div style="font-size: 15px; color: #4a4a4a; line-height: 1.6; font-family: 'Inter', Arial, sans-serif;">${message}</div>
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top: 32px; border-top: 1px solid #e5e7eb; padding-top: 24px;">
                    <tr>
                      <td style="font-family: 'Inter', Arial, sans-serif; font-size: 15px; color: #4a4a4a;">
                        Best regards,<br /><strong>The DynoPay Team</strong>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <!-- Footer -->
              <tr>
                <td style="background: #1a1a2e; padding: 32px; text-align: center;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td align="center" style="padding-bottom: 16px;">
                        <img src="${DYNOPAY_LOGO_URL}" alt="DynoPay" width="120" style="height: 30px; opacity: 0.9;" />
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
                            <td style="padding: 0 8px;">
                              <a href="https://facebook.com/dynopay" target="_blank" style="text-decoration: none;">
                                <img src="https://cdn-icons-png.flaticon.com/512/733/733547.png" alt="Facebook" width="28" height="28" style="display: block; border-radius: 50%;" />
                              </a>
                            </td>
                            <td style="padding: 0 8px;">
                              <a href="https://instagram.com/dynopay" target="_blank" style="text-decoration: none;">
                                <img src="https://cdn-icons-png.flaticon.com/512/733/733558.png" alt="Instagram" width="28" height="28" style="display: block; border-radius: 50%;" />
                              </a>
                            </td>
                            <td style="padding: 0 8px;">
                              <a href="https://x.com/dynopay" target="_blank" style="text-decoration: none;">
                                <img src="https://cdn-icons-png.flaticon.com/512/5969/5969020.png" alt="X" width="28" height="28" style="display: block; border-radius: 50%;" />
                              </a>
                            </td>
                            <td style="padding: 0 8px;">
                              <a href="https://linkedin.com/company/dynopay" target="_blank" style="text-decoration: none;">
                                <img src="https://cdn-icons-png.flaticon.com/512/733/733561.png" alt="LinkedIn" width="28" height="28" style="display: block; border-radius: 50%;" />
                              </a>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    <tr>
                      <td align="center" style="color: #9ca3af; font-size: 13px; font-family: 'Inter', Arial, sans-serif; padding-bottom: 16px;">
                        &copy; ${new Date().getFullYear()} DynoPay. All rights reserved.
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
    // Wrap message in DynoPay branded HTML template
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
      <p style="font-size: 15px; color: #4a4a4a; line-height: 1.6; margin: 16px 0 0 0; font-family: 'Inter', Arial, sans-serif;">The funds have been credited to your wallet. You can view the full transaction details in your DynoPay dashboard.</p>`;

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
    const subject = `Transaction ${status} - DynoPay`;
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
      <p style="font-size: 15px; color: #4a4a4a; line-height: 1.6; margin: 16px 0 0 0; font-family: 'Inter', Arial, sans-serif;">You can view more details in your DynoPay dashboard.</p>`;

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
    const subject = "Your Weekly Summary - DynoPay";
    
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
    const subject = "🔒 Security Alert - DynoPay";
    const message = `We detected unusual activity on your account.

⚠️ Alert Type: ${alertType}

${details}

If this was you, you can ignore this message. If you didn't perform this action, please secure your account immediately by:
1. Changing your password
2. Enabling two-factor authentication
3. Contacting our support team

Your security is our priority.`;

    const info = await mailTransporter({
      to: recipientEmail,
      name,
      subject,
      body: message,
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
    const subject = "⏳ Payment Pending Confirmation - DynoPay";
    const message = `A new payment has been detected for your company ${companyName}!

💰 Amount: ${amount} ${currency}
📝 Transaction ID: ${transactionId}
⏳ Status: Awaiting Confirmation

The transaction has been broadcast to the ${currency} network and is waiting for blockchain confirmation. This typically takes:
• BTC: 10-60 minutes (${confirmationsRequired} confirmation${confirmationsRequired > 1 ? 's' : ''} required)
• ETH/ERC20: 1-5 minutes
• TRX/TRC20: 1-3 minutes
• LTC: 2-30 minutes
• DOGE: 1-10 minutes

We'll notify you once the payment is fully confirmed and credited to your wallet.

You can track the transaction status in your DynoPay dashboard.`;

    const info = await mailTransporter({
      to: recipientEmail,
      name,
      subject,
      body: message,
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
    const subject = `🔄 Payment Confirming (${currentConfirmations}/${requiredConfirmations}) - DynoPay`;
    const message = `Good news! Your payment for ${companyName} is being confirmed.

💰 Amount: ${amount} ${currency}
📝 Transaction ID: ${transactionId}
✅ Confirmations: ${currentConfirmations} of ${requiredConfirmations}

${currentConfirmations >= requiredConfirmations 
  ? "The payment has reached the required confirmations and will be credited shortly!"
  : `${requiredConfirmations - currentConfirmations} more confirmation${requiredConfirmations - currentConfirmations > 1 ? 's' : ''} needed before the payment is credited.`}

You can track the full status in your DynoPay dashboard.`;

    const info = await mailTransporter({
      to: recipientEmail,
      name,
      subject,
      body: message,
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
    const subject = "⚠️ Partial Payment Received - Action Required - DynoPay";
    const message = `A partial payment has been received for your company ${companyName}.

💰 Expected Amount: ${expectedAmount} ${currency}
✅ Received Amount: ${receivedAmount} ${currency}
⚠️ Remaining Amount: ${remainingAmount} ${currency}

📝 Transaction ID: ${transactionId}
📍 Wallet Address: ${walletAddress}

⏰ IMPORTANT: You have ${gracePeriodMinutes} minutes to send the remaining ${remainingAmount} ${currency} to complete this payment.

What happens next?
• If the remaining amount is received within ${gracePeriodMinutes} minutes, the full payment will be processed and forwarded to your wallet.
• If the grace period expires, the partial amount received will be processed with adjusted fees.

To complete the payment, send exactly ${remainingAmount} ${currency} to:
${walletAddress}

You can track the payment status in your DynoPay dashboard.`;

    const info = await mailTransporter({
      to: recipientEmail,
      name,
      subject,
      body: message,
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
      ? "✅ Partial Payment Processed - DynoPay"
      : "⏰ Partial Payment Expired - DynoPay";
    
    const message = isCompleted
      ? `The partial payment for your company ${companyName} has been processed.

💰 Expected Amount: ${expectedAmount} ${currency}
✅ Received Amount: ${receivedAmount} ${currency}
📝 Transaction ID: ${transactionId}

The received amount has been processed with adjusted fees and forwarded to your wallet. The transaction is now complete.

You can view the full transaction details in your DynoPay dashboard.`
      : `The grace period for the partial payment to your company ${companyName} has expired.

💰 Expected Amount: ${expectedAmount} ${currency}
⚠️ Received Amount: ${receivedAmount} ${currency}
📝 Transaction ID: ${transactionId}

Since the full payment was not received within the grace period, the partial amount has been processed. Please note that fees may be higher for incomplete payments.

If you believe this is an error or need assistance, please contact our support team.

You can view the transaction details in your DynoPay dashboard.`;

    const info = await mailTransporter({
      to: recipientEmail,
      name,
      subject,
      body: message,
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
    const subject = "💰 Platform Fee Received - DynoPay";
    
    // Check if this is an under-threshold payment (merchant gets $0)
    const merchantAmountNum = parseFloat(merchantAmount);
    const feeAmountNum = parseFloat(feeAmount);
    const totalAmountNum = parseFloat(totalAmount);
    const isUnderThreshold = merchantAmountNum === 0 && feeAmountNum === totalAmountNum;
    
    let message = `Platform fee received from ${companyName}!\n\n`;
    
    if (isUnderThreshold) {
      // Under-threshold payment - all goes to admin
      message += `⚠️ UNDER THRESHOLD PAYMENT - All funds to platform\n\n`;
      message += `💰 Total Amount Received: ${feeAmount} ${currency}\n`;
      message += `📊 Merchant Received: ${merchantAmount} ${currency} (Below minimum threshold)\n`;
      message += `💵 Platform Received: ${feeAmount} ${currency} (100%)\n`;
      message += `🏢 Company: ${companyName}\n\n`;
      message += `📝 Transaction Reference:\n${transactionId}\n\n`;
      message += `ℹ️ This payment was below the minimum forwarding threshold.\n`;
      message += `All funds have been credited to the admin ${currency} wallet.\n`;
      message += `The merchant will not receive any funds from this transaction.`;
    } else {
      // Normal fee distribution
      message += `💰 Fee Amount: ${feeAmount} ${currency}\n`;
      message += `📊 Merchant Received: ${merchantAmount} ${currency}\n`;
      message += `💵 Total Payment: ${totalAmount} ${currency}\n`;
      message += `🏢 Company: ${companyName}\n\n`;
      message += `📝 Transaction Reference:\n${transactionId}\n\n`;
      message += `Fee Breakdown:\n`;
      message += `• Platform Fee: ${feeAmount} ${currency}\n`;
      message += `• Merchant Net: ${merchantAmount} ${currency}\n`;
      message += `• Total Processed: ${totalAmount} ${currency}\n\n`;
      message += `The fee has been credited to the admin ${currency} wallet.\n\n`;
    }
    
    message += `You can view the full transaction details in the DynoPay admin dashboard.`;

    const info = await mailTransporter({
      to: recipientEmail,
      name,
      subject,
      body: message,
    });
    return info;
  } catch (e) {
    console.log("Admin fee received email error:", e);
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
        subject = "Don't forget your exclusive DynoPay offer! 🎁";
        urgencyMessage = `You still have <strong>${daysRemaining} days</strong> to claim your exclusive discount.`;
        ctaText = "Claim Your Discount";
        break;
      case 'week2':
        subject = "Your 50% discount is waiting - DynoPay 💰";
        urgencyMessage = `Your exclusive <strong>${discountPercent}% discount</strong> is still available! Only <strong>${daysRemaining} days</strong> remaining.`;
        ctaText = "Start Saving Today";
        break;
      case 'week3':
        subject = `⏰ Only ${daysRemaining} days left on your DynoPay offer!`;
        urgencyMessage = `<strong>Time is running out!</strong> Your exclusive ${discountPercent}% discount expires in just <strong>${daysRemaining} days</strong>.`;
        ctaText = "Don't Miss Out";
        break;
      case 'final':
        subject = "⚠️ LAST CHANCE: Your DynoPay discount expires in 3 days!";
        urgencyMessage = `<strong style="color: #dc2626;">FINAL REMINDER:</strong> Your exclusive ${discountPercent}% discount expires in just <strong>${daysRemaining} days</strong>. This is your last chance!`;
        ctaText = "Claim Now Before It's Gone";
        break;
    }
    
    const message = `
<p>We noticed you haven't claimed your exclusive DynoPay discount yet!</p>

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

<h4 style="margin: 24px 0 12px 0; color: #1034a6;">Why DynoPay?</h4>
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
  sendWeeklySummaryEmail,
  sendSecurityAlertEmail,
  sendRefereeCodeReminderEmail,
  sendPaymentLinkReminderEmail,
  dynoPayEmailTemplate,
};
