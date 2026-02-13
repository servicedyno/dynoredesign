import mailTransporter from "../utils/mailTransporter";
import { generatePaymentReceipt, getReceiptFilename } from "./pdfReceiptService";
import { baseEmailTemplate, getCurrencySymbol, infoBox, dataRow, statusBadge, p, otpBlock } from "../utils/emailTemplate";

/**
 * Dynopay Email Service
 * Comprehensive email notification system
 * Provider: Brevo
 * Uses shared base template from utils/emailTemplate.ts
 */

// Base email template wrapper - delegates to shared template
export const dynoPayEmailTemplate = (
  heading: string,
  content: string,
  showButton: boolean = false,
  buttonText: string = "",
  buttonLink: string = ""
) => {
  return baseEmailTemplate(heading, content, { showButton, buttonText, buttonLink });
};

/**
 * Template 1: Welcome Email
 * Trigger: User registration
 */
export const sendWelcomeEmail = async (
  email: string,
  name: string
) => {
  try {
    const subject = "Welcome to Dynopay - Let's get you paid";
    const content = `${p(`Hey ${name},`)}
    ${p(`Welcome to Dynopay! We're excited to have you on board.`)}
    ${p(`Dynopay makes accepting crypto payments simple, secure, and fast. Whether you're a freelancer, business owner, or developer, we've got you covered.`)}
    ${infoBox(`
      <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #0d1f5c; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;"><strong>Here's what you can do next:</strong></p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="padding: 4px 0; font-size: 14px; color: #374151; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">1. Complete your company profile</td></tr>
        <tr><td style="padding: 4px 0; font-size: 14px; color: #374151; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">2. Add your payout wallet</td></tr>
        <tr><td style="padding: 4px 0; font-size: 14px; color: #374151; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">3. Start accepting payments</td></tr>
      </table>
    `)}
    ${p(`If you have any questions, our support team is here to help.`)}`;

    const html = dynoPayEmailTemplate("Welcome to Dynopay", content, true, "Get Started", "https://dynopay.com/dashboard");
    
    await mailTransporter({ to: email, name, subject, body: html });
    console.log(`Welcome email sent to ${email}`);
  } catch (e) {
    console.error("Welcome email error:", e);
  }
};

/**
 * Template 2: Company Profile Created
 * Trigger: Company created
 * Recipient: Account email (user who created the company)
 */
export const sendCompanyProfileCreatedEmail = async (
  email: string,
  name: string,
  companyName: string
) => {
  try {
    const subject = "Profile complete - One step left";
    const content = `${p(`Hey ${name},`)}
    ${p(`Great job! Your company profile for <strong>${companyName}</strong> is now complete.`)}
    ${p(`You're almost ready to start accepting payments. The last step is to add your payout wallet address.`)}
    ${infoBox(`
      <p style="margin: 0 0 6px 0; font-size: 14px; font-weight: 600; color: #0d1f5c; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">Why add a wallet?</p>
      <p style="margin: 0; font-size: 14px; color: #374151; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">Your wallet is where we'll send the crypto payments you receive. It's quick and secure.</p>
    `)}`;

    const html = dynoPayEmailTemplate("Profile Complete", content, true, "Add Wallet", "https://dynopay.com/dashboard/wallets");
    await mailTransporter({ to: email, name, subject, body: html });
    console.log(`Company profile created email sent to ${email}`);
  } catch (e) {
    console.error("Company profile created email error:", e);
  }
};

/**
 * Template 2b: Company Contact Welcome Email
 * Trigger: Company created (sent to company contact email if different from account)
 * Recipient: Company contact email
 */
export const sendCompanyContactWelcomeEmail = async (
  companyContactEmail: string,
  companyName: string,
  accountHolderName: string
) => {
  try {
    const subject = `Welcome to Dynopay - ${companyName} is now registered`;
    const content = `${p(`Hello,`)}
    ${p(`<strong>${companyName}</strong> has been registered on Dynopay by ${accountHolderName}.`)}
    ${p(`Dynopay is a secure crypto payment gateway that enables businesses to accept cryptocurrency payments easily and safely.`)}
    ${infoBox(`
      <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #0d1f5c; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">What this means for you:</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="padding: 4px 0; font-size: 14px; color: #374151; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">1. Your company can now accept crypto payments</td></tr>
        <tr><td style="padding: 4px 0; font-size: 14px; color: #374151; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">2. Fast and secure transactions</td></tr>
        <tr><td style="padding: 4px 0; font-size: 14px; color: #374151; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">3. Real-time payment notifications</td></tr>
      </table>
    `)}
    ${p(`If you have any questions about this registration, please contact our support team or reach out to ${accountHolderName}.`)}`;

    const html = dynoPayEmailTemplate("Welcome to Dynopay", content, true, "Learn More", "https://dynopay.com");
    await mailTransporter({ to: companyContactEmail, name: companyName, subject, body: html });
    console.log(`Company contact welcome email sent to ${companyContactEmail}`);
  } catch (e) {
    console.error("Company contact welcome email error:", e);
  }
};

/**
 * Template 2b: User Profile Updated Email
 * Trigger: User profile updated (name, username, email, mobile)
 * Recipient: User's email (both old and new if email changed)
 */
export const sendUserProfileUpdatedEmail = async (
  email: string,
  name: string,
  updatedFields: string[],
  oldEmail?: string
) => {
  try {
    const subject = "Account Profile Updated";
    const now = new Date();
    const date = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
    const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    
    const fieldsList = updatedFields.length > 0 
      ? updatedFields.map(field => dataRow(field, statusBadge('Updated', 'info'))).join('')
      : dataRow('General', statusBadge('Updated', 'info'), true);
    
    const content = `${p(`Hey ${name},`)}
    ${p(`Your account profile has been updated successfully.`)}
    ${infoBox(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${fieldsList}
        ${dataRow('Date', `${date} at ${time}`, true)}
      </table>
    `, '#22c55e')}
    ${p(`<strong>Security Notice:</strong> If you didn't make these changes, please reset your password immediately and contact our support team.`, `color: #991b1b;`)}`;

    const html = dynoPayEmailTemplate("Profile Updated", content, true, "View Profile", "https://dynopay.com/dashboard/profile");
    await mailTransporter({ to: email, name, subject, body: html });
    
    if (oldEmail && oldEmail !== email) {
      const oldEmailContent = `${p(`Hey ${name},`)}
      ${p(`Your account email has been changed from <strong>${oldEmail}</strong> to <strong>${email}</strong>.`)}
      ${infoBox(`
        <p style="margin: 0 0 6px 0; font-size: 14px; font-weight: 600; color: #991b1b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">Important</p>
        <p style="margin: 0; font-size: 14px; color: #374151; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">If you did not make this change, your account may be compromised. Please contact our support team immediately.</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top: 12px;">
          ${dataRow('Date', `${date} at ${time}`, true)}
        </table>
      `, '#ef4444')}`;

      const oldEmailHtml = dynoPayEmailTemplate("Email Address Changed", oldEmailContent, true, "Contact Support", "https://dynopay.com/support");
      await mailTransporter({ to: oldEmail, name, subject: "Your Dynopay Email Address Has Been Changed", body: oldEmailHtml });
      console.log(`[ProfileUpdate] Email change notification sent to old email: ${oldEmail}`);
    }
    
    console.log(`[ProfileUpdate] Profile updated email sent to ${email}`);
  } catch (e) {
    console.error("[ProfileUpdate] Email error:", e);
  }
};

/**
 * Template 2c: Company Profile Updated Email
 * Trigger: Company profile updated
 * Recipient: Account holder email
 */
export const sendCompanyProfileUpdatedEmail = async (
  email: string,
  name: string,
  companyName: string,
  updatedFields: string[]
) => {
  try {
    const subject = "Company Profile Updated Successfully";
    const fieldsList = updatedFields.length > 0 
      ? updatedFields.map(field => dataRow(field, statusBadge('Updated', 'info'))).join('')
      : dataRow('General', statusBadge('Updated', 'info'), true);
    
    const content = `${p(`Hey ${name},`)}
    ${p(`Your company profile for <strong>${companyName}</strong> has been updated successfully.`)}
    ${infoBox(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${fieldsList}
      </table>
    `, '#22c55e')}
    ${p(`If you didn't make these changes, please contact our support team immediately.`)}`;

    const html = dynoPayEmailTemplate("Profile Updated", content, true, "View Profile", "https://dynopay.com/dashboard/company");
    await mailTransporter({ to: email, name, subject, body: html });
    console.log(`Company profile updated email sent to ${email}`);
  } catch (e) {
    console.error("Company profile updated email error:", e);
  }
};


/**
 * Template 3: Wallet OTP
 * Trigger: Adding wallet
 */
export const sendWalletOTPEmail = async (
  email: string,
  name: string,
  otpCode: string,
  walletAddressMasked: string,
  network: string
) => {
  try {
    const subject = "Confirm your payout wallet";
    const content = `${p(`Hey ${name},`)}
    ${p(`You're adding a new payout wallet to your Dynopay account. Please verify this action with the code below:`)}
    ${otpBlock(otpCode)}
    ${infoBox(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${dataRow('Address', walletAddressMasked)}
        ${dataRow('Network', network, true)}
      </table>
    `)}
    ${p(`This code expires in 10 minutes. If you didn't request this, please ignore this email.`)}`;

    const html = dynoPayEmailTemplate("Confirm Your Wallet", content);
    await mailTransporter({ to: email, name, subject, body: html });
    console.log(`Wallet OTP email sent to ${email}`);
  } catch (e) {
    console.error("Wallet OTP email error:", e);
  }
};

/**
 * Template 4: Wallet Verified
 * Trigger: Wallet confirmed
 */
export const sendWalletVerifiedEmail = async (
  email: string,
  name: string,
  walletAddressMasked: string,
  network: string
) => {
  try {
    const subject = "Payout wallet active";
    const content = `${p(`Hey ${name},`)}
    ${p(`Your payout wallet has been verified and is now active.`)}
    ${infoBox(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${dataRow('Address', walletAddressMasked)}
        ${dataRow('Network', network)}
        ${dataRow('Status', statusBadge('Active', 'success'), true)}
      </table>
    `, '#22c55e')}
    ${p(`All payments you receive will be automatically forwarded to this wallet. You're all set to start accepting crypto payments.`)}`;

    const html = dynoPayEmailTemplate("Wallet Active", content, true, "View Dashboard", "https://dynopay.com/dashboard");
    await mailTransporter({ to: email, name, subject, body: html });
    console.log(`Wallet verified email sent to ${email}`);
  } catch (e) {
    console.error("Wallet verified email error:", e);
  }
};

/**
 * Template 5: Wallet Update OTP
 * Trigger: Changing wallet
 */
export const sendWalletUpdateOTPEmail = async (
  email: string,
  name: string,
  otpCode: string,
  oldWalletMasked: string,
  newWalletMasked: string,
  network: string
) => {
  try {
    const subject = "Confirm wallet update";
    const content = `${p(`Hey ${name},`)}
    ${p(`You're updating your payout wallet. Please verify this change with the code below:`)}
    ${otpBlock(otpCode)}
    ${infoBox(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${dataRow('Current', oldWalletMasked)}
        ${dataRow('New', newWalletMasked)}
        ${dataRow('Network', network, true)}
      </table>
    `)}
    ${p(`This code expires in 10 minutes. If you didn't request this change, please secure your account immediately.`, `color: #991b1b;`)}`;

    const html = dynoPayEmailTemplate("Confirm Wallet Update", content);
    await mailTransporter({ to: email, name, subject, body: html });
    console.log(`Wallet update OTP email sent to ${email}`);
  } catch (e) {
    console.error("Wallet update OTP email error:", e);
  }
};

/**
 * Template 6: Payment Received
 * Trigger: Payment forwarded
 */
export const sendPaymentReceivedEmail = async (
  email: string,
  name: string,
  amount: string,
  currency: string,
  companyName: string,
  transactionId: string,
  date: string,
  time: string
) => {
  try {
    const subject = `Payment received - ${amount} ${currency}`;
    const content = `${p(`Hey ${name},`)}
    ${p(`Great news! Your company <strong>${companyName}</strong> has received a payment.`)}
    ${infoBox(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${dataRow('Amount', `<strong>${amount} ${currency}</strong>`)}
        ${dataRow('Status', statusBadge('Received', 'success'))}
        ${dataRow('Date', `${date} at ${time}`)}
        ${dataRow('Transaction ID', `<span style="font-size: 12px; font-family: monospace;">${transactionId}</span>`, true)}
      </table>
    `, '#22c55e')}
    ${p(`The funds have been forwarded to your payout wallet. You can view the full transaction details in your dashboard.`)}`;

    const html = dynoPayEmailTemplate("Payment Received", content, true, "View Transaction", "https://dynopay.com/dashboard/transactions");
    await mailTransporter({ to: email, name, subject, body: html });
    console.log(`Payment received email sent to ${email}`);
  } catch (e) {
    console.error("Payment received email error:", e);
  }
};

/**
 * Template 7: Add Wallet Reminder
 * Trigger: No wallet added after 24 hours
 */
export const sendAddWalletReminderEmail = async (
  email: string,
  name: string,
  companyName: string
) => {
  try {
    const subject = "You're almost ready to accept payments";
    const content = `${p(`Hey ${name},`)}
    ${p(`You're so close! Your <strong>${companyName}</strong> profile is set up, but you haven't added a payout wallet yet.`)}
    ${infoBox(`
      <p style="margin: 0 0 6px 0; font-size: 14px; font-weight: 600; color: #0d1f5c; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">Why add a wallet?</p>
      <p style="margin: 0; font-size: 14px; color: #374151; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">Without a wallet, you can't receive payments. It takes less than 2 minutes to set up.</p>
    `)}
    ${p(`Add your wallet now and start accepting crypto payments today.`)}`;

    const html = dynoPayEmailTemplate("Add Your Wallet", content, true, "Add Wallet Now", "https://dynopay.com/dashboard/wallets");
    await mailTransporter({ to: email, name, subject, body: html });
    console.log(`Add wallet reminder email sent to ${email}`);
  } catch (e) {
    console.error("Add wallet reminder email error:", e);
  }
};

/**
 * Template 8: Email Verification OTP
 * Trigger: Email verification
 */
export const sendEmailVerificationOTPEmail = async (
  email: string,
  name: string,
  otpCode: string
) => {
  try {
    const subject = "Verify your email";
    const content = `${p(`Hey ${name},`)}
    ${p(`Please verify your email address to complete your Dynopay registration. Enter this code in the verification page:`)}
    ${otpBlock(otpCode)}
    ${p(`This code expires in 10 minutes. If you didn't create a Dynopay account, please ignore this email.`)}`;

    const html = dynoPayEmailTemplate("Verify Your Email", content);
    await mailTransporter({ to: email, name, subject, body: html });
    console.log(`Email verification OTP sent to ${email}`);
  } catch (e) {
    console.error("Email verification OTP email error:", e);
  }
};

/**
 * Template 9: Login OTP
 * Trigger: Login code requested
 */
export const sendLoginOTPEmail = async (
  email: string,
  name: string,
  otpCode: string
) => {
  try {
    const subject = "Your login code";
    const content = `${p(`Hey ${name},`)}
    ${p(`Here's your one-time login code for Dynopay:`)}
    ${otpBlock(otpCode)}
    ${p(`This code expires in 10 minutes. If you didn't request this code, please secure your account immediately.`)}`;

    const html = dynoPayEmailTemplate("Your Login Code", content);
    await mailTransporter({ to: email, name, subject, body: html });
    console.log(`Login OTP email sent to ${email}`);
  } catch (e) {
    console.error("Login OTP email error:", e);
  }
};

/**
 * Template 10: Forgot Password OTP
 * Trigger: Password reset requested
 */
export const sendForgotPasswordOTPEmail = async (
  email: string,
  name: string,
  otpCode: string
) => {
  try {
    const subject = "Password reset code";
    const content = `${p(`Hey ${name},`)}
    ${p(`You requested to reset your Dynopay password. Use this code to continue:`)}
    ${otpBlock(otpCode)}
    ${p(`This code expires in 10 minutes. If you didn't request a password reset, please ignore this email and your password will remain unchanged.`)}`;

    const html = dynoPayEmailTemplate("Reset Your Password", content);
    await mailTransporter({ to: email, name, subject, body: html });
    console.log(`Forgot password OTP email sent to ${email}`);
  } catch (e) {
    console.error("Forgot password OTP email error:", e);
  }
};

/**
 * Template 11: Password Changed
 * Trigger: Password updated successfully
 */
export const sendPasswordChangedEmail = async (
  email: string,
  name: string,
  date: string,
  time: string
) => {
  try {
    const subject = "Password updated successfully";
    const content = `${p(`Hey ${name},`)}
    ${p(`Your Dynopay password has been successfully updated.`)}
    ${infoBox(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${dataRow('Date', `${date} at ${time}`, true)}
      </table>
    `, '#22c55e')}
    ${p(`<strong>Security Notice:</strong> If you didn't make this change, please contact our support team immediately to secure your account.`, `color: #991b1b;`)}`;

    const html = dynoPayEmailTemplate("Password Updated", content, true, "View Account Settings", "https://dynopay.com/dashboard/settings");
    await mailTransporter({ to: email, name, subject, body: html });
    console.log(`Password changed email sent to ${email}`);
  } catch (e) {
    console.error("Password changed email error:", e);
  }
};

/**
 * Template 12: Payment Link Created
 * Trigger: New payment link created
 */
export const sendPaymentLinkCreatedEmail = async (
  email: string,
  name: string,
  amount: string,
  currency: string,
  paymentLink: string,
  description: string,
  expiresAt: string | null
) => {
  try {
    const subject = `Payment link ready — ${amount} ${currency}`;
    
    // Create shortened display URL for cleaner appearance
    // e.g., "checkout.dynopay.com/pay/...f939" 
    let shortDisplayUrl = paymentLink;
    try {
      const url = new URL(paymentLink);
      const pathParts = url.pathname + url.search;
      if (pathParts.length > 20) {
        const lastChars = pathParts.slice(-8);
        shortDisplayUrl = `${url.host}/pay/...${lastChars}`;
      }
    } catch {
      // Keep original if URL parsing fails
    }
    
    const content = `${p(`Hey ${name},`)}
    ${p(`Your payment link has been created successfully.`)}
    ${infoBox(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${dataRow('Amount', `<strong>${amount} ${currency}</strong>`)}
        ${dataRow('Description', description)}
        ${dataRow('Expires', expiresAt || 'Never')}
        ${dataRow('Link', `<a href="${paymentLink}" style="color: #0d1f5c; text-decoration: none;">${shortDisplayUrl}</a>`, true)}
      </table>
    `)}
    ${p(`Share this link with your customer to receive payment.`)}`;

    const html = dynoPayEmailTemplate("Payment Link Created", content, true, "Open Payment Link", paymentLink);
    await mailTransporter({ to: email, name, subject, body: html });
    
    console.log(`Payment link created email sent to ${email}`);
  } catch (e) {
    console.error("Payment link created email error:", e);
  }
};

/**
 * Template 13: KYC Required
 * Trigger: $5,000 volume threshold reached
 */
export const sendKYCRequiredEmail = async (
  email: string,
  name: string,
  totalVolume: string,
  currency: string = 'USD'
) => {
  try {
    const currencySymbol = getCurrencySymbol(currency);
    const thresholdAmount = currency === 'USD' ? '5,000' : '5,000 USD equivalent';
    const subject = `Verification required - ${currencySymbol}${thresholdAmount} volume reached`;
    const content = `${p(`Hey ${name},`)}
    ${p(`Congratulations on reaching <strong>${currencySymbol}${totalVolume} ${currency}</strong> in transaction volume!`)}
    ${p(`To continue accepting payments above ${currencySymbol}${thresholdAmount}, we need to verify your identity. This is a regulatory requirement and helps us keep Dynopay secure.`)}
    ${infoBox(`
      <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #0d1f5c; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">What you need:</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="padding: 4px 0; font-size: 14px; color: #374151; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">1. Government-issued ID</td></tr>
        <tr><td style="padding: 4px 0; font-size: 14px; color: #374151; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">2. Proof of address (utility bill, bank statement)</td></tr>
        <tr><td style="padding: 4px 0; font-size: 14px; color: #374151; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">3. About 5 minutes of your time</td></tr>
      </table>
    `)}
    ${p(`Complete your verification now to keep accepting payments without interruption.`)}`;

    const html = dynoPayEmailTemplate("Verification Required", content, true, "Start Verification", "https://dynopay.com/dashboard/kyc");
    await mailTransporter({ to: email, name, subject, body: html });
    console.log(`KYC required email sent to ${email}`);
  } catch (e) {
    console.error("KYC required email error:", e);
  }
};

/**
 * Template 14: KYC Approved
 * Trigger: Verification passed
 */
export const sendKYCApprovedEmail = async (
  email: string,
  name: string
) => {
  try {
    const subject = "Verification approved - You're all set";
    const content = `${p(`Hey ${name},`)}
    ${p(`Your identity verification has been approved.`)}
    ${infoBox(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${dataRow('Status', statusBadge('Approved', 'success'), true)}
      </table>
    `, '#22c55e')}
    ${p(`You can now accept payments without limits and access all Dynopay features. Keep growing your business with Dynopay!`)}`;

    const html = dynoPayEmailTemplate("Verification Approved", content, true, "View Dashboard", "https://dynopay.com/dashboard");
    await mailTransporter({ to: email, name, subject, body: html });
    console.log(`KYC approved email sent to ${email}`);
  } catch (e) {
    console.error("KYC approved email error:", e);
  }
};

/**
 * Template 15: KYC Rejected
 * Trigger: Verification failed
 */
export const sendKYCRejectedEmail = async (
  email: string,
  name: string,
  rejectionReason: string
) => {
  try {
    const subject = "Verification unsuccessful";
    const content = `${p(`Hey ${name},`)}
    ${p(`We were unable to verify your identity at this time.`)}
    ${infoBox(`
      <p style="margin: 0 0 6px 0; font-size: 14px; font-weight: 600; color: #991b1b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">Reason</p>
      <p style="margin: 0; font-size: 14px; color: #374151; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">${rejectionReason}</p>
    `, '#ef4444')}
    ${p(`You can resubmit your verification documents. Please ensure:`)}
    ${p(`1. Use clear, high-quality images<br />2. All information is visible<br />3. Name matches your Dynopay account`)}
    ${p(`If you need help, our support team is here for you.`)}`;

    const html = dynoPayEmailTemplate("Verification Unsuccessful", content, true, "Resubmit Documents", "https://dynopay.com/dashboard/kyc");
    await mailTransporter({ to: email, name, subject, body: html });
    console.log(`KYC rejected email sent to ${email}`);
  } catch (e) {
    console.error("KYC rejected email error:", e);
  }
};

/**
 * Template 16: Weekly Summary
 * Trigger: Every Monday
 */
export const sendWeeklySummaryEmail = async (
  email: string,
  name: string,
  periodStart: string,
  periodEnd: string,
  transactionCount: number,
  totalVolume: string,
  completedCount: number,
  pendingCount: number,
  topCurrency: string,
  baseCurrency: string = 'USD' // Company's base currency
) => {
  try {
    const currencySymbol = getCurrencySymbol(baseCurrency);
    const subject = "Your weekly Dynopay summary";
    const content = `${p(`Hey ${name},`)}
    ${p(`Here's your weekly activity summary for <strong>${periodStart}</strong> to <strong>${periodEnd}</strong>:`)}
    ${infoBox(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${dataRow('Total Transactions', `<strong>${transactionCount}</strong>`)}
        ${dataRow('Total Volume', `<strong>${currencySymbol}${totalVolume} ${baseCurrency}</strong>`)}
        ${dataRow('Completed', statusBadge(String(completedCount), 'success'))}
        ${dataRow('Pending', statusBadge(String(pendingCount), 'pending'))}
        ${dataRow('Top Currency', topCurrency, true)}
      </table>
    `)}
    ${p(`Keep up the great work! Log in to your dashboard for detailed analytics and insights.`)}`;

    const html = dynoPayEmailTemplate("Your Weekly Summary", content, true, "View Full Analytics", "https://dynopay.com/dashboard/analytics");
    await mailTransporter({ to: email, name, subject, body: html });
    console.log(`Weekly summary email sent to ${email}`);
  } catch (e) {
    console.error("Weekly summary email error:", e);
  }
};

/**
 * Template 17: Security Alert
 * Trigger: Suspicious activity detected
 */
export const sendSecurityAlertEmail = async (
  email: string,
  name: string,
  alertType: string,
  details: string,
  date: string,
  time: string
) => {
  try {
    const subject = "Security alert on your account";
    const content = `${p(`Hey ${name},`)}
    ${p(`We detected unusual activity on your Dynopay account.`)}
    ${infoBox(`
      <p style="margin: 0 0 6px 0; font-size: 14px; font-weight: 600; color: #991b1b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">Alert Details</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${dataRow('Type', alertType)}
        ${dataRow('Date', `${date} at ${time}`)}
        ${dataRow('Details', details, true)}
      </table>
    `, '#ef4444')}
    ${p(`<strong>Was this you?</strong><br />If you recognize this activity, you can ignore this message.`)}
    ${p(`<strong>Didn't perform this action?</strong><br />Please secure your account immediately by:<br />1. Changing your password<br />2. Reviewing your recent activity<br />3. Contacting our support team`)}`;

    const html = dynoPayEmailTemplate("Security Alert", content, true, "Secure My Account", "https://dynopay.com/dashboard/security");
    await mailTransporter({ to: email, name, subject, body: html });
    console.log(`Security alert email sent to ${email}`);
  } catch (e) {
    console.error("Security alert email error:", e);
  }
};

/**
 * Template 18: Invoice Generated Email
 * Trigger: Invoice created for transaction
 */
export const sendInvoiceGeneratedEmail = async (
  email: string,
  name: string,
  invoiceData: {
    invoice_number: string;
    transaction_id: number;
    total_usd: number;
    total_amount?: number; // Amount in base_currency
    currency?: string; // Base currency (e.g., EUR, GBP)
    invoice_date: Date;
    invoice_url: string;
  }
) => {
  try {
    // Use base currency amount if available, otherwise fall back to USD
    const currency = invoiceData.currency || 'USD';
    const amount = invoiceData.total_amount || invoiceData.total_usd;
    const currencySymbol = getCurrencySymbol(currency);
    
    const subject = `Invoice ${invoiceData.invoice_number} - Dynopay`;
    const content = `${p(`Hello ${name},`)}
    ${p(`Your invoice has been successfully generated for transaction #${invoiceData.transaction_id}.`)}
    ${infoBox(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${dataRow('Invoice Number', invoiceData.invoice_number)}
        ${dataRow('Transaction ID', `<span style="font-family: monospace; font-size: 13px;">${invoiceData.transaction_id}</span>`)}
        ${dataRow('Total Amount', `<strong>${currencySymbol}${amount.toFixed(2)} ${currency}</strong>`)}
        ${dataRow('Invoice Date', new Date(invoiceData.invoice_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }), true)}
      </table>
    `)}
    ${p(`You can view and download your invoice using the button below.`)}`;

    const html = dynoPayEmailTemplate("Invoice Generated", content, true, "View Invoice", invoiceData.invoice_url);
    await mailTransporter({ to: email, name, subject, body: html });

    console.log(`Invoice email sent to ${email} for invoice ${invoiceData.invoice_number}`);
  } catch (error) {
    console.error(`Failed to send invoice email to ${email}:`, error);
    throw error;
  }
};

/**
 * Template 19: Customer Payment Confirmation Email with PDF Receipt
 * Trigger: Customer successfully completes payment via payment link
 * Recipient: Customer who made the payment
 * Includes: Branded PDF receipt attachment
 */
export const sendCustomerPaymentConfirmationEmail = async (
  customerEmail: string,
  customerName: string | null,
  companyName: string,
  amount: string,
  currency: string,
  transactionId: string,
  description: string | null,
  date: string,
  time: string,
  cryptoAmount?: string,
  cryptoCurrency?: string,
  transactionReference?: string
) => {
  try {
    const displayName = customerName || customerEmail.split('@')[0];
    const subject = `Payment Successful - Receipt from ${companyName}`;
    
    // Generate PDF receipt
    let pdfAttachment: { name: string; content: string; contentType: string } | undefined;
    try {
      const receiptData = {
        transactionId,
        transactionReference,
        amount,
        currency,
        cryptoAmount,
        cryptoCurrency,
        companyName,
        customerEmail,
        customerName: displayName,
        paymentDate: new Date(`${date} ${time}`),
        description: description || undefined,
        paymentMethod: cryptoCurrency ? `Cryptocurrency (${cryptoCurrency})` : "Cryptocurrency",
        status: "Completed",
      };
      
      const pdfBuffer = await generatePaymentReceipt(receiptData);
      const filename = getReceiptFilename(transactionId);
      
      pdfAttachment = {
        name: filename,
        content: pdfBuffer.toString('base64'),
        contentType: 'application/pdf',
      };
      console.log(`[Email] Generated PDF receipt: ${filename}`);
    } catch (pdfError) {
      console.error("[Email] Failed to generate PDF receipt:", pdfError);
      // Continue without PDF attachment
    }
    
    const content = `${p(`Hey ${displayName},`)}
    ${p(`Your payment to <strong>${companyName}</strong> has been successfully processed.`)}
    ${infoBox(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${dataRow('Status', statusBadge('Complete', 'success'))}
        ${dataRow('Amount Paid', `<strong>${amount} ${currency}</strong>`)}
        ${cryptoAmount && cryptoCurrency ? dataRow('Crypto Amount', `${cryptoAmount} ${cryptoCurrency}`) : ''}
        ${description ? dataRow('Description', description) : ''}
        ${dataRow('Transaction ID', `<span style="font-family: monospace; font-size: 13px;">${transactionId}</span>`)}
        ${transactionReference ? dataRow('Reference', transactionReference) : ''}
        ${dataRow('Date', `${date} at ${time}`, true)}
      </table>
    `, '#22c55e')}
    ${pdfAttachment ? p(`<strong>PDF Receipt Attached</strong> - A detailed receipt is attached to this email for your records.`) : ''}
    ${p(`If you have any questions about this payment, please contact <strong>${companyName}</strong> directly.`)}
    ${p(`<span style="font-size: 13px; color: #6b7280;">This payment was processed securely through Dynopay, a trusted crypto payment gateway.</span>`)}`;

    const html = dynoPayEmailTemplate("Payment Successful", content);
    await mailTransporter({ to: customerEmail, name: displayName, subject, body: html, attachments: pdfAttachment ? [pdfAttachment] : undefined });
    
    console.log(`[Email] Customer payment confirmation sent to ${customerEmail} for ${amount} ${currency}${pdfAttachment ? ' with PDF receipt' : ''}`);
  } catch (e) {
    console.error("Customer payment confirmation email error:", e);
  }
};

/**
 * Template 20: KYC Verification Started Email
 * Trigger: User starts KYC verification session
 * Recipient: Merchant/User who started KYC
 */
export const sendKYCStartedEmail = async (
  email: string,
  name: string,
  verificationUrl: string
) => {
  try {
    const subject = "Complete your identity verification";
    const content = `${p(`Hey ${name},`)}
    ${p(`Your identity verification session has been created. Please complete the verification to continue using Dynopay without restrictions.`)}
    ${infoBox(`
      <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #0d1f5c; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">What you'll need:</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="padding: 4px 0; font-size: 14px; color: #374151; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">1. Government-issued ID</td></tr>
        <tr><td style="padding: 4px 0; font-size: 14px; color: #374151; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">2. Proof of address (last 3 months)</td></tr>
        <tr><td style="padding: 4px 0; font-size: 14px; color: #374151; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">3. A few minutes for selfie verification</td></tr>
      </table>
    `)}
    ${p(`The verification typically takes 5-10 minutes to complete and is reviewed within 24-48 hours.`)}`;

    const html = dynoPayEmailTemplate("Identity Verification", content, true, "Complete Verification", verificationUrl);
    await mailTransporter({ to: email, name, subject, body: html });
    console.log(`KYC started email sent to ${email}`);
  } catch (e) {
    console.error("KYC started email error:", e);
  }
};

/**
 * Template 21: KYC Resubmission Required Email
 * Trigger: Veriff requests additional documents
 * Recipient: Merchant/User who needs to resubmit
 */
export const sendKYCResubmissionRequiredEmail = async (
  email: string,
  name: string,
  reason: string
) => {
  try {
    const subject = "Additional information needed for verification";
    const content = `${p(`Hey ${name},`)}
    ${p(`We need a bit more information to complete your identity verification.`)}
    ${infoBox(`
      <p style="margin: 0 0 6px 0; font-size: 14px; font-weight: 600; color: #92400e; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">Reason</p>
      <p style="margin: 0; font-size: 14px; color: #374151; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">${reason}</p>
    `, '#f59e0b')}
    ${p(`This is a common request. To continue, please:`)}
    ${p(`1. Ensure your documents are clear and all text is readable<br />2. Make sure the name matches your Dynopay account<br />3. Use documents that are not expired`)}`;

    const html = dynoPayEmailTemplate("Resubmission Required", content, true, "Resubmit Documents", "https://dynopay.com/dashboard/kyc");
    await mailTransporter({ to: email, name, subject, body: html });
    console.log(`KYC resubmission required email sent to ${email}`);
  } catch (e) {
    console.error("KYC resubmission required email error:", e);
  }
};

/**
 * Template 22: Payment Link Expiring Soon
 * Trigger: Payment link about to expire (24h, 6h, 1h before)
 * Recipient: Customer who received the payment link
 */
export const sendPaymentExpiringEmail = async (
  customerEmail: string,
  customerName: string | null,
  companyName: string,
  amount: string,
  currency: string,
  paymentLink: string,
  expiresIn: string,
  description: string | null
) => {
  try {
    const displayName = customerName || customerEmail.split('@')[0];
    const subject = `Payment link expires ${expiresIn} - ${amount} ${currency}`;
    
    const content = `${p(`Hey ${displayName},`)}
    ${p(`This is a friendly reminder that your payment link from <strong>${companyName}</strong> will expire <strong>${expiresIn}</strong>.`)}
    ${infoBox(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${dataRow('Amount', `<strong>${amount} ${currency}</strong>`)}
        ${description ? dataRow('Description', description) : ''}
        ${dataRow('Expires', statusBadge(expiresIn, 'pending'), true)}
      </table>
    `, '#f59e0b')}
    ${p(`Complete your payment now to avoid missing this deadline.`)}`;

    const html = dynoPayEmailTemplate("Payment Expiring Soon", content, true, "Pay Now", paymentLink);
    await mailTransporter({ to: customerEmail, name: displayName, subject, body: html });
    console.log(`[Email] Payment expiring reminder sent to ${customerEmail} - expires ${expiresIn}`);
  } catch (e) {
    console.error("Payment expiring email error:", e);
  }
};

/**
 * Template 23: New Device Login Alert
 * Trigger: User logs in from new IP address or device
 * Recipient: Account holder
 */
export const sendNewDeviceLoginEmail = async (
  email: string,
  name: string,
  ipAddress: string,
  userAgent: string,
  location: string | null,
  date: string,
  time: string
) => {
  try {
    const subject = "New login to your Dynopay account";
    
    // Parse user agent for readable device info
    let deviceInfo = 'Unknown Device';
    if (userAgent.includes('iPhone') || userAgent.includes('iPad')) {
      deviceInfo = userAgent.includes('iPad') ? 'iPad' : 'iPhone';
    } else if (userAgent.includes('Android')) {
      deviceInfo = 'Android Device';
    } else if (userAgent.includes('Windows')) {
      deviceInfo = 'Windows PC';
    } else if (userAgent.includes('Mac')) {
      deviceInfo = 'Mac';
    } else if (userAgent.includes('Linux')) {
      deviceInfo = 'Linux';
    } else if (userAgent.includes('Mobile')) {
      deviceInfo = 'Mobile Device';
    }
    
    // Browser detection
    let browser = '';
    if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) {
      browser = 'Chrome';
    } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
      browser = 'Safari';
    } else if (userAgent.includes('Firefox')) {
      browser = 'Firefox';
    } else if (userAgent.includes('Edg')) {
      browser = 'Edge';
    }
    if (browser) {
      deviceInfo += ` (${browser})`;
    }
    
    const locationDisplay = location || 'Unknown location';
    
    const content = `${p(`Hey ${name},`)}
    ${p(`We noticed a new login to your Dynopay account from a different location.`)}
    ${infoBox(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${dataRow('Location', locationDisplay)}
        ${dataRow('Device', deviceInfo)}
        ${dataRow('IP Address', `<span style="font-family: monospace; font-size: 13px;">${ipAddress}</span>`)}
        ${dataRow('Date', `${date} at ${time}`, true)}
      </table>
    `)}
    ${p(`<strong>Was this you?</strong><br />If you recognize this login, you can safely ignore this message.`)}
    ${p(`<strong>Didn't log in?</strong><br />Please change your password immediately and review your recent account activity.`)}`;

    const html = dynoPayEmailTemplate("New Login Detected", content, true, "Secure My Account", "https://dynopay.com/dashboard/settings");
    await mailTransporter({ to: email, name, subject, body: html });
    
    console.log(`[Email] New device login alert sent to ${email} from ${locationDisplay} (${ipAddress})`);
  } catch (e) {
    console.error("New device login email error:", e);
  }
};

/**
 * Template 24: Failed Login Attempts Alert
 * Trigger: Multiple failed login attempts (3+)
 * Recipient: Account holder
 */
export const sendFailedLoginAttemptsEmail = async (
  email: string,
  name: string,
  attemptCount: number,
  ipAddress: string,
  date: string,
  time: string
) => {
  try {
    const subject = "Multiple failed login attempts on your account";
    
    const content = `${p(`Hey ${name},`)}
    ${p(`We detected <strong>${attemptCount} failed login attempts</strong> on your Dynopay account.`)}
    ${infoBox(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${dataRow('Failed Attempts', `<strong>${attemptCount}</strong>`)}
        ${dataRow('Date', `${date} at ${time}`)}
        ${dataRow('IP Address', `<span style="font-family: monospace; font-size: 13px;">${ipAddress}</span>`, true)}
      </table>
    `, '#ef4444')}
    ${p(`<strong>Was this you?</strong><br />If you forgot your password, you can reset it using the button below.`)}
    ${p(`<strong>Wasn't you?</strong><br />Someone may be trying to access your account. We recommend changing your password immediately. Your account is still secure - we blocked these login attempts.`)}`;

    const html = dynoPayEmailTemplate("Security Alert", content, true, "Reset Password", "https://dynopay.com/forgot-password");
    
    await mailTransporter({
      to: email,
      name,
      subject,
      body: html,
    });
    
    console.log(`[Email] Failed login attempts alert sent to ${email} - ${attemptCount} attempts from ${ipAddress}`);
  } catch (e) {
    console.error("Failed login attempts email error:", e);
  }
};

/**
 * Template 25: Payment Failed/Underpaid Notification
 * Trigger: Payment expired, underpaid, or cancelled
 * Recipient: Customer and optionally Merchant
 */
export const sendPaymentFailedEmail = async (
  customerEmail: string,
  customerName: string | null,
  merchantEmail: string | null,
  merchantName: string | null,
  companyName: string,
  reason: 'expired' | 'underpaid' | 'cancelled' | 'timeout',
  amount: string,
  currency: string,
  paidAmount: string | null,
  transactionId: string
) => {
  try {
    const displayName = customerName || customerEmail.split('@')[0];
    
    const reasonMessages = {
      expired: 'The payment link has expired',
      underpaid: `We received ${paidAmount} ${currency} but the required amount was ${amount} ${currency}`,
      cancelled: 'The payment was cancelled',
      timeout: 'The payment session timed out'
    };
    
    const reasonMessage = reasonMessages[reason];
    const subject = reason === 'underpaid' 
      ? `Underpayment detected - ${paidAmount} of ${amount} ${currency} received`
      : `Payment unsuccessful - ${companyName}`;
    
    // Email to Customer
    const customerContent = `${p(`Hey ${displayName},`)}
    ${p(`Unfortunately, your payment to <strong>${companyName}</strong> was not completed.`)}
    ${infoBox(`
      <p style="margin: 0 0 6px 0; font-size: 14px; font-weight: 600; color: #991b1b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">Issue</p>
      <p style="margin: 0; font-size: 14px; color: #374151; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">${reasonMessage}</p>
    `, '#ef4444')}
    ${infoBox(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${dataRow('Amount', `${amount} ${currency}`)}
        ${paidAmount ? dataRow('Amount Received', `${paidAmount} ${currency}`) : ''}
        ${dataRow('Transaction ID', `<span style="font-family: monospace; font-size: 13px;">${transactionId}</span>`, true)}
      </table>
    `)}
    ${reason === 'underpaid' ? p(`Please contact <strong>${companyName}</strong> to resolve this underpayment or request a refund.`) : ''}
    ${reason === 'expired' || reason === 'timeout' ? p(`Please contact <strong>${companyName}</strong> if you still wish to complete this payment.`) : ''}`;

    const customerHtml = dynoPayEmailTemplate("Payment Unsuccessful", customerContent);
    await mailTransporter({ to: customerEmail, name: displayName, subject, body: customerHtml });
    console.log(`[Email] Payment failed notification sent to customer ${customerEmail} - reason: ${reason}`);
    
    // Email to Merchant (if provided)
    if (merchantEmail) {
      const merchantDisplayName = merchantName || 'Merchant';
      const merchantSubject = reason === 'underpaid'
        ? `Underpayment received - ${paidAmount} of ${amount} ${currency}`
        : `Payment failed - ${transactionId}`;
      
      const merchantContent = `${p(`Hey ${merchantDisplayName},`)}
      ${p(`A payment from <strong>${displayName}</strong> was not completed.`)}
      ${infoBox(`
        <p style="margin: 0 0 6px 0; font-size: 14px; font-weight: 600; color: #92400e; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">Issue</p>
        <p style="margin: 0; font-size: 14px; color: #374151; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">${reasonMessage}</p>
      `, '#f59e0b')}
      ${infoBox(`
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${dataRow('Customer', customerEmail)}
          ${dataRow('Amount', `${amount} ${currency}`)}
          ${paidAmount ? dataRow('Amount Received', `${paidAmount} ${currency}`) : ''}
          ${dataRow('Transaction ID', `<span style="font-family: monospace; font-size: 13px;">${transactionId}</span>`, true)}
        </table>
      `)}
      ${reason === 'underpaid' ? p(`The customer has been notified. You may need to issue a partial refund or request the remaining amount.`) : ''}`;

      const merchantHtml = dynoPayEmailTemplate("Payment Alert", merchantContent, true, "View Transaction", "https://dynopay.com/dashboard/transactions");
      await mailTransporter({ to: merchantEmail, name: merchantDisplayName, subject: merchantSubject, body: merchantHtml });
      console.log(`[Email] Payment failed notification sent to merchant ${merchantEmail} - reason: ${reason}`);
    }
  } catch (e) {
    console.error("Payment failed email error:", e);
  }
};

/**
 * Template 26: API Key Created/Regenerated
 * Trigger: User creates new API key or regenerates existing one
 * Recipient: Account holder
 */
export const sendApiKeyCreatedEmail = async (
  email: string,
  name: string,
  keyType: 'development' | 'production',
  action: 'created' | 'regenerated',
  keyPreview: string,
  date: string,
  time: string
) => {
  try {
    const subject = `API key ${action} - ${keyType} environment`;
    const actionText = action === 'created' ? 'created' : 'regenerated';
    
    const content = `${p(`Hey ${name},`)}
    ${p(`Your <strong>${keyType}</strong> API key has been ${actionText}.`)}
    ${infoBox(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${dataRow('Environment', keyType === 'production' ? statusBadge('Production', 'error') : statusBadge('Development', 'pending'))}
        ${dataRow('Key Preview', `<span style="font-family: monospace; font-size: 13px;">${keyPreview}...</span>`)}
        ${action === 'regenerated' ? dataRow('Note', 'Your old key is now invalid') : ''}
        ${dataRow('Date', `${date} at ${time}`, true)}
      </table>
    `)}
    ${keyType === 'production' ? p(`<strong>Important:</strong> This is a production key. Keep it secure and never share it publicly.`, `color: #991b1b;`) : ''}
    ${p(`<strong>Didn't do this?</strong><br />If you didn't ${action === 'created' ? 'create' : 'regenerate'} this API key, please secure your account immediately.`)}`;

    const html = dynoPayEmailTemplate("API Key Update", content, true, "View API Keys", "https://dynopay.com/dashboard/api-keys");
    await mailTransporter({ to: email, name, subject, body: html });
    
    console.log(`[Email] API key ${action} notification sent to ${email} for ${keyType} environment`);
  } catch (e) {
    console.error("API key created email error:", e);
  }
};

/**
 * Template 27: Wallet Deleted Confirmation
 * Trigger: User deletes a wallet address
 * Recipient: Account holder
 */
export const sendWalletDeletedEmail = async (
  email: string,
  name: string,
  walletAddressMasked: string,
  network: string,
  date: string,
  time: string
) => {
  try {
    const subject = "Wallet removed from your account";
    
    const content = `${p(`Hey ${name},`)}
    ${p(`A wallet has been removed from your Dynopay account.`)}
    ${infoBox(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${dataRow('Address', walletAddressMasked)}
        ${dataRow('Network', network)}
        ${dataRow('Removed', `${date} at ${time}`, true)}
      </table>
    `, '#ef4444')}
    ${p(`Payments will no longer be forwarded to this wallet.`)}
    ${p(`<strong>Didn't do this?</strong><br />If you didn't remove this wallet, please secure your account immediately and contact support.`)}`;

    const html = dynoPayEmailTemplate("Wallet Removed", content, true, "Manage Wallets", "https://dynopay.com/dashboard/wallets");
    await mailTransporter({ to: email, name, subject, body: html });
    
    console.log(`[Email] Wallet deleted notification sent to ${email} for ${network}`);
  } catch (e) {
    console.error("Wallet deleted email error:", e);
  }
};

/**
 * Template 28: Large Transaction Alert
 * Trigger: Payment above threshold (e.g., $1000+)
 * Recipient: Merchant
 */
export const sendLargeTransactionAlertEmail = async (
  email: string,
  name: string,
  amount: string,
  currency: string,
  cryptoAmount: string,
  cryptoCurrency: string,
  customerEmail: string | null,
  transactionId: string,
  companyName: string
) => {
  try {
    const subject = `Large payment received - ${amount} ${currency}`;
    
    const content = `${p(`Hey ${name},`)}
    ${p(`<strong>${companyName}</strong> received a large payment that may require your attention.`)}
    ${infoBox(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${dataRow('Amount', `<strong>${amount} ${currency}</strong>`)}
        ${dataRow('Crypto', `${cryptoAmount} ${cryptoCurrency}`)}
        ${customerEmail ? dataRow('Customer', customerEmail) : ''}
        ${dataRow('Transaction ID', `<span style="font-family: monospace; font-size: 13px;">${transactionId}</span>`, true)}
      </table>
    `, '#22c55e')}
    ${p(`This payment has been automatically processed and forwarded to your wallet.`)}
    ${p(`For large transactions, we recommend:<br />1. Verify the transaction in your dashboard<br />2. Confirm product/service delivery to customer<br />3. Keep records for accounting purposes`)}`;

    const html = dynoPayEmailTemplate("Large Payment Received", content, true, "View Transaction", "https://dynopay.com/dashboard/transactions");
    await mailTransporter({ to: email, name, subject, body: html });
    
    console.log(`[Email] Large transaction alert sent to ${email} - ${amount} ${currency}`);
  } catch (e) {
    console.error("Large transaction alert email error:", e);
  }
};

/**
 * Template 29: Subscription Created
 * Trigger: Customer subscribes to recurring plan
 * Recipients: Customer + Merchant
 */
export const sendSubscriptionCreatedEmail = async (
  customerEmail: string,
  customerName: string | null,
  merchantEmail: string,
  merchantName: string,
  planName: string,
  amount: string,
  currency: string,
  interval: string,
  nextBillingDate: string,
  companyName: string
) => {
  try {
    const displayName = customerName || customerEmail.split('@')[0];
    
    // Email to Customer
    const customerSubject = `Subscription confirmed - ${planName}`;
    const customerContent = `${p(`Hey ${displayName},`)}
    ${p(`Your subscription to <strong>${planName}</strong> from <strong>${companyName}</strong> is now active.`)}
    ${infoBox(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${dataRow('Plan', planName)}
        ${dataRow('Amount', `<strong>${amount} ${currency} / ${interval}</strong>`)}
        ${dataRow('Next Billing', nextBillingDate, true)}
      </table>
    `, '#22c55e')}
    ${p(`You'll be charged automatically on each billing date. You can manage or cancel your subscription anytime.`)}`;

    const customerHtml = dynoPayEmailTemplate("Subscription Active", customerContent);
    await mailTransporter({ to: customerEmail, name: displayName, subject: customerSubject, body: customerHtml });
    
    // Email to Merchant
    const merchantSubject = `New subscriber - ${planName}`;
    const merchantContent = `${p(`Hey ${merchantName},`)}
    ${p(`You have a new subscriber for <strong>${planName}</strong>.`)}
    ${infoBox(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${dataRow('Customer', customerEmail)}
        ${dataRow('Plan', planName)}
        ${dataRow('Revenue', `<strong>${amount} ${currency} / ${interval}</strong>`)}
        ${dataRow('Next Billing', nextBillingDate, true)}
      </table>
    `, '#22c55e')}`;

    const merchantHtml = dynoPayEmailTemplate("New Subscription", merchantContent, true, "View Subscriptions", "https://dynopay.com/dashboard/subscriptions");
    await mailTransporter({ to: merchantEmail, name: merchantName, subject: merchantSubject, body: merchantHtml });
    
    console.log(`[Email] Subscription created notifications sent for ${planName}`);
  } catch (e) {
    console.error("Subscription created email error:", e);
  }
};

/**
 * Template 30: Subscription Cancelled
 * Trigger: Subscription cancelled by customer or merchant
 * Recipients: Customer + Merchant
 */
export const sendSubscriptionCancelledEmail = async (
  customerEmail: string,
  customerName: string | null,
  merchantEmail: string,
  merchantName: string,
  planName: string,
  companyName: string,
  effectiveDate: string,
  cancelledBy: 'customer' | 'merchant'
) => {
  try {
    const displayName = customerName || customerEmail.split('@')[0];
    
    // Email to Customer
    const customerSubject = `Subscription cancelled - ${planName}`;
    const customerContent = `${p(`Hey ${displayName},`)}
    ${p(`Your subscription to <strong>${planName}</strong> from <strong>${companyName}</strong> has been cancelled.`)}
    ${infoBox(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${dataRow('Plan', planName)}
        ${dataRow('Effective', effectiveDate)}
        ${dataRow('Cancelled by', cancelledBy === 'customer' ? 'You' : companyName, true)}
      </table>
    `, '#f59e0b')}
    ${p(`You will continue to have access until ${effectiveDate}. After that, no further charges will be made.`)}
    ${p(`If you change your mind, you can always resubscribe.`)}`;

    const customerHtml = dynoPayEmailTemplate("Subscription Cancelled", customerContent);
    
    await mailTransporter({
      to: customerEmail,
      name: displayName,
      subject: customerSubject,
      body: customerHtml,
    });
    
    // Email to Merchant
    const merchantSubject = `Subscription cancelled - ${displayName}`;
    const merchantContent = `<p class="message">Hey ${merchantName},</p>
    <p class="message">A subscription to <strong>${planName}</strong> has been cancelled.</p>
    <div class="highlight-box">
      <p><strong>Cancellation Details:</strong></p>
      <p>Customer: ${customerEmail}<br />
      Plan: ${planName}<br />
      Effective: ${effectiveDate}<br />
      Cancelled by: ${cancelledBy === 'customer' ? 'Customer' : 'You'}</p>
    </div>`;

    const merchantHtml = dynoPayEmailTemplate("Subscription Cancelled", merchantContent, true, "View Subscriptions", "https://dynopay.com/dashboard/subscriptions");
    
    await mailTransporter({
      to: merchantEmail,
      name: merchantName,
      subject: merchantSubject,
      body: merchantHtml,
    });
    
    console.log(`[Email] Subscription cancelled notifications sent for ${planName}`);
  } catch (e) {
    console.error("Subscription cancelled email error:", e);
  }
};

/**
 * Template 31: Subscription Payment Failed
 * Trigger: Recurring payment fails (card declined, etc.)
 * Recipients: Customer + Merchant
 */
export const sendSubscriptionPaymentFailedEmail = async (
  customerEmail: string,
  customerName: string | null,
  merchantEmail: string,
  merchantName: string,
  planName: string,
  amount: string,
  currency: string,
  companyName: string,
  failureReason: string,
  retryDate: string | null
) => {
  try {
    const displayName = customerName || customerEmail.split('@')[0];
    
    // Email to Customer
    const customerSubject = `⚠️ Payment failed for ${planName}`;
    const customerContent = `<p class="message">Hey ${displayName},</p>
    <p class="message">We were unable to process your subscription payment for <strong>${planName}</strong> from <strong>${companyName}</strong>.</p>
    <div class="highlight-box" style="border-left-color: #ef4444;">
      <p><strong>Payment Issue:</strong></p>
      <p>Amount: ${amount} ${currency}<br />
      Reason: ${failureReason}<br />
      ${retryDate ? `Next Retry: ${retryDate}` : ''}</p>
    </div>
    <p class="message">To keep your subscription active, please:</p>
    <p class="message">1. Update your payment method<br />
    2. Ensure sufficient funds are available<br />
    3. Contact your bank if the issue persists</p>
    <p class="message">⚠️ Your subscription may be cancelled if payment is not received.</p>`;

    const customerHtml = dynoPayEmailTemplate("Payment Failed", customerContent, true, "Update Payment", "https://dynopay.com/dashboard/subscriptions");
    
    await mailTransporter({
      to: customerEmail,
      name: displayName,
      subject: customerSubject,
      body: customerHtml,
    });
    
    // Email to Merchant
    const merchantSubject = `Subscription payment failed - ${displayName}`;
    const merchantContent = `<p class="message">Hey ${merchantName},</p>
    <p class="message">A subscription payment has failed for <strong>${planName}</strong>.</p>
    <div class="highlight-box" style="border-left-color: #f59e0b;">
      <p><strong>Payment Failure:</strong></p>
      <p>Customer: ${customerEmail}<br />
      Plan: ${planName}<br />
      Amount: ${amount} ${currency}<br />
      Reason: ${failureReason}<br />
      ${retryDate ? `Retry Scheduled: ${retryDate}` : ''}</p>
    </div>
    <p class="message">The customer has been notified to update their payment method.</p>`;

    const merchantHtml = dynoPayEmailTemplate("Subscription Payment Failed", merchantContent, true, "View Subscription", "https://dynopay.com/dashboard/subscriptions");
    
    await mailTransporter({
      to: merchantEmail,
      name: merchantName,
      subject: merchantSubject,
      body: merchantHtml,
    });
    
    console.log(`[Email] Subscription payment failed notifications sent for ${planName}`);
  } catch (e) {
    console.error("Subscription payment failed email error:", e);
  }
};

export default {
  sendWelcomeEmail,
  sendUserProfileUpdatedEmail,
  sendCompanyProfileCreatedEmail,
  sendCompanyProfileUpdatedEmail,
  sendCompanyContactWelcomeEmail,
  sendWalletOTPEmail,
  sendWalletVerifiedEmail,
  sendWalletUpdateOTPEmail,
  sendPaymentReceivedEmail,
  sendAddWalletReminderEmail,
  sendEmailVerificationOTPEmail,
  sendLoginOTPEmail,
  sendForgotPasswordOTPEmail,
  sendPasswordChangedEmail,
  sendPaymentLinkCreatedEmail,
  sendKYCRequiredEmail,
  sendKYCApprovedEmail,
  sendKYCRejectedEmail,
  sendWeeklySummaryEmail,
  sendSecurityAlertEmail,
  sendInvoiceGeneratedEmail,
  sendCustomerPaymentConfirmationEmail,
  sendKYCStartedEmail,
  sendKYCResubmissionRequiredEmail,
  // New templates (22-31)
  sendPaymentExpiringEmail,
  sendNewDeviceLoginEmail,
  sendFailedLoginAttemptsEmail,
  sendPaymentFailedEmail,
  sendApiKeyCreatedEmail,
  sendWalletDeletedEmail,
  sendLargeTransactionAlertEmail,
  sendSubscriptionCreatedEmail,
  sendSubscriptionCancelledEmail,
  sendSubscriptionPaymentFailedEmail,
  dynoPayEmailTemplate,
};
