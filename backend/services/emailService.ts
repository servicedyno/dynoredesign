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
    const subject = `Welcome to Dynopay — ${companyName} is now registered`;
    const content = `<p class="message">Hello,</p>
    <p class="message">Great news! <strong>${companyName}</strong> has been registered on Dynopay by ${accountHolderName}. 🎉</p>
    <p class="message">Dynopay is a secure crypto payment gateway that enables businesses to accept cryptocurrency payments easily and safely.</p>
    <div class="highlight-box">
      <p><strong>What this means for you:</strong></p>
      <p>✓ Your company can now accept crypto payments<br />
      ✓ Fast and secure transactions<br />
      ✓ Real-time payment notifications</p>
    </div>
    <p class="message">If you have any questions about this registration or need assistance, please contact our support team or reach out to ${accountHolderName}.</p>`;

    const html = dynoPayEmailTemplate("Welcome to Dynopay", content, true, "Learn More", "https://dynopay.com");
    
    await mailTransporter({
      to: companyContactEmail,
      name: companyName,
      subject,
      body: html,
    });
    
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
      ? `<ul>${updatedFields.map(field => `<li>${field}</li>`).join('')}</ul>`
      : '<p>General profile information</p>';
    
    const content = `<p class="message">Hey ${name},</p>
    <p class="message">Your account profile has been updated successfully. ✅</p>
    <div class="highlight-box">
      <p><strong>Updated Information:</strong></p>
      ${fieldsList}
      <p style="margin-top: 15px; font-size: 12px; color: #666;">
        <strong>Date:</strong> ${date}<br/>
        <strong>Time:</strong> ${time}
      </p>
    </div>
    <p class="message" style="color: #e74c3c;"><strong>⚠️ Security Notice:</strong> If you didn't make these changes, please reset your password immediately and contact our support team.</p>`;

    const html = dynoPayEmailTemplate("Profile Updated", content, true, "View Profile", "https://dynopay.com/dashboard/profile");
    
    // Send to current email
    await mailTransporter({
      to: email,
      name,
      subject,
      body: html,
    });
    
    // If email was changed, also notify the old email
    if (oldEmail && oldEmail !== email) {
      const oldEmailContent = `<p class="message">Hey ${name},</p>
      <p class="message">Your account email has been changed from <strong>${oldEmail}</strong> to <strong>${email}</strong>.</p>
      <div class="highlight-box" style="background-color: #fff3cd; border-color: #ffc107;">
        <p><strong>⚠️ Important:</strong></p>
        <p>If you did not make this change, your account may be compromised. Please contact our support team immediately.</p>
        <p style="margin-top: 15px; font-size: 12px; color: #666;">
          <strong>Date:</strong> ${date}<br/>
          <strong>Time:</strong> ${time}
        </p>
      </div>`;

      const oldEmailHtml = dynoPayEmailTemplate("Email Address Changed", oldEmailContent, true, "Contact Support", "https://dynopay.com/support");
      
      await mailTransporter({
        to: oldEmail,
        name,
        subject: "Your Dynopay Email Address Has Been Changed",
        body: oldEmailHtml,
      });
      
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
      ? `<ul>${updatedFields.map(field => `<li>${field}</li>`).join('')}</ul>`
      : '<p>General profile information</p>';
    
    const content = `<p class="message">Hey ${name},</p>
    <p class="message">Your company profile for <strong>${companyName}</strong> has been updated successfully. ✅</p>
    <div class="highlight-box">
      <p><strong>Updated Information:</strong></p>
      ${fieldsList}
    </div>
    <p class="message">If you didn't make these changes, please contact our support team immediately.</p>`;

    const html = dynoPayEmailTemplate("Profile Updated", content, true, "View Profile", "https://dynopay.com/dashboard/company");
    
    await mailTransporter({
      to: email,
      name,
      subject,
      body: html,
    });
    
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
    const content = `<p class="message">Hey ${name},</p>
    <p class="message">You're so close! Your <strong>${companyName}</strong> profile is set up, but you haven't added a payout wallet yet.</p>
    <div class="highlight-box">
      <p><strong>Why add a wallet?</strong></p>
      <p>Without a wallet, you can't receive payments. It takes less than 2 minutes to set up!</p>
    </div>
    <p class="message">Add your wallet now and start accepting crypto payments today.</p>`;

    const html = dynoPayEmailTemplate("Add Your Wallet", content, true, "Add Wallet Now", "https://dynopay.com/dashboard/wallets");
    
    await mailTransporter({
      to: email,
      name,
      subject,
      body: html,
    });
    
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
    
    const content = `<p class="message">Hey ${name},</p>
    <p class="message">Your payment link has been created successfully! 🔗</p>
    <div class="highlight-box">
      <p><strong>Payment Details:</strong></p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
        <tr>
          <td style="padding: 4px 0; color: #666;">Amount:</td>
          <td style="padding: 4px 0; font-weight: 600; color: #1034a6;">${amount} ${currency}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #666;">Description:</td>
          <td style="padding: 4px 0;">${description}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #666;">Expires:</td>
          <td style="padding: 4px 0;">${expiresAt || 'Never'}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #666;">Link:</td>
          <td style="padding: 4px 0;"><a href="${paymentLink}" style="color: #1034a6; text-decoration: none;">${shortDisplayUrl}</a></td>
        </tr>
      </table>
    </div>
    <p class="message">Share this link with your customer to receive payment. Click the button below to copy the full link.</p>`;

    const html = dynoPayEmailTemplate("Payment Link Created", content, true, "Open Payment Link", paymentLink);
    
    await mailTransporter({
      to: email,
      name,
      subject,
      body: html,
    });
    
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
    const content = `<p class="message">Hey ${name},</p>
    <p class="message">We were unable to verify your identity at this time.</p>
    <div class="highlight-box" style="border-left-color: #f47323;">
      <p><strong>Reason:</strong></p>
      <p>${rejectionReason}</p>
    </div>
    <p class="message">Don't worry! You can resubmit your verification documents. Make sure to:</p>
    <p class="message">✓ Use clear, high-quality images<br />
    ✓ Ensure all information is visible<br />
    ✓ Match the name on your Dynopay account</p>
    <p class="message">If you need help, our support team is here for you.</p>`;

    const html = dynoPayEmailTemplate("Verification Unsuccessful", content, true, "Resubmit Documents", "https://dynopay.com/dashboard/kyc");
    
    await mailTransporter({
      to: email,
      name,
      subject,
      body: html,
    });
    
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
    const content = `<p class="message">Hey ${name},</p>
    <p class="message">Here's your weekly activity summary for ${periodStart} to ${periodEnd}:</p>
    <div class="highlight-box">
      <p><strong>📊 This Week's Stats:</strong></p>
      <p>Total Transactions: <strong>${transactionCount}</strong><br />
      Total Volume: <strong>${currencySymbol}${totalVolume} ${baseCurrency}</strong><br />
      Completed: ${completedCount}<br />
      Pending: ${pendingCount}<br />
      Top Currency: ${topCurrency}</p>
    </div>
    <p class="message">Keep up the great work! Log in to your dashboard for detailed analytics and insights.</p>`;

    const html = dynoPayEmailTemplate("Your Weekly Summary", content, true, "View Full Analytics", "https://dynopay.com/dashboard/analytics");
    
    await mailTransporter({
      to: email,
      name,
      subject,
      body: html,
    });
    
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
    const subject = "🔒 Security alert on your account";
    const content = `<p class="message">Hey ${name},</p>
    <p class="message">We detected unusual activity on your Dynopay account.</p>
    <div class="highlight-box" style="border-left-color: #f47323;">
      <p><strong>⚠️ Alert Details:</strong></p>
      <p>Type: ${alertType}<br />
      Date: ${date} at ${time}<br />
      Details: ${details}</p>
    </div>
    <p class="message"><strong>Was this you?</strong><br />
    If you recognize this activity, you can ignore this message.</p>
    <p class="message"><strong>Didn't perform this action?</strong><br />
    Please secure your account immediately by:</p>
    <p class="message">1. Changing your password<br />
    2. Reviewing your recent activity<br />
    3. Contacting our support team</p>
    <p class="message">Your security is our top priority.</p>`;

    const html = dynoPayEmailTemplate("Security Alert", content, true, "Secure My Account", "https://dynopay.com/dashboard/security");
    
    await mailTransporter({
      to: email,
      name,
      subject,
      body: html,
    });
    
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
    const content = `<p class="message">Hello ${name},</p>
    <p class="message">Your invoice has been successfully generated for transaction #${invoiceData.transaction_id}.</p>
    <div class="highlight-box">
      <p><strong>Invoice Details:</strong></p>
      <p>
        <strong>Invoice Number:</strong> ${invoiceData.invoice_number}<br />
        <strong>Transaction ID:</strong> ${invoiceData.transaction_id}<br />
        <strong>Total Amount:</strong> ${currencySymbol}${amount.toFixed(2)} ${currency}<br />
        <strong>Invoice Date:</strong> ${new Date(invoiceData.invoice_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
      </p>
    </div>
    <p class="message">You can view and download your invoice using the button below.</p>`;

    const html = dynoPayEmailTemplate(
      "Invoice Generated",
      content,
      true,
      "View Invoice",
      invoiceData.invoice_url
    );

    await mailTransporter({
      to: email,
      name,
      subject,
      body: html,
    });

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
    
    const content = `<p class="message">Hey ${displayName},</p>
    <p class="message">Your payment to <strong>${companyName}</strong> has been successfully processed. 🎉</p>
    <div class="receipt-box">
      <strong>✓ Payment Complete</strong>
    </div>
    <div class="highlight-box">
      <p><strong>Payment Details:</strong></p>
      <p>
        <strong>Amount Paid:</strong> ${amount} ${currency}<br />
        ${cryptoAmount && cryptoCurrency ? `<strong>Crypto Amount:</strong> ${cryptoAmount} ${cryptoCurrency}<br />` : ''}
        ${description ? `<strong>Description:</strong> ${description}<br />` : ''}
        <strong>Transaction ID:</strong> ${transactionId}<br />
        ${transactionReference ? `<strong>Reference:</strong> ${transactionReference}<br />` : ''}
        <strong>Date:</strong> ${date} at ${time}
      </p>
    </div>
    ${pdfAttachment ? `<p class="message"><strong>📎 PDF Receipt Attached</strong><br />A detailed receipt is attached to this email for your records.</p>` : ''}
    <p class="message">If you have any questions about this payment, please contact <strong>${companyName}</strong> directly.</p>
    <p class="message" style="font-size: 13px; color: #6b7280; margin-top: 24px;">
      This payment was processed securely through Dynopay, a trusted crypto payment gateway.
    </p>`;

    const html = dynoPayEmailTemplate("Payment Successful", content);
    
    await mailTransporter({
      to: customerEmail,
      name: displayName,
      subject,
      body: html,
      attachments: pdfAttachment ? [pdfAttachment] : undefined,
    });
    
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
    const content = `<p class="message">Hey ${name},</p>
    <p class="message">Your identity verification session has been created. Please complete the verification to continue using Dynopay without restrictions. 📋</p>
    <div class="highlight-box">
      <p><strong>What you'll need:</strong></p>
      <p>✓ Government-issued ID (passport, driver's license, or national ID)<br />
      ✓ Proof of address (utility bill or bank statement from last 3 months)<br />
      ✓ A few minutes to complete a selfie verification</p>
    </div>
    <p class="message">The verification typically takes 5-10 minutes to complete and is reviewed within 24-48 hours.</p>
    <p class="message">Click the button below to continue your verification:</p>`;

    const html = dynoPayEmailTemplate("Identity Verification", content, true, "Complete Verification", verificationUrl);
    
    await mailTransporter({
      to: email,
      name,
      subject,
      body: html,
    });
    
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
    const content = `<p class="message">Hey ${name},</p>
    <p class="message">We need a bit more information to complete your identity verification. 📝</p>
    <div class="highlight-box" style="border-left-color: #f59e0b;">
      <p><strong>Reason:</strong></p>
      <p>${reason}</p>
    </div>
    <p class="message">Don't worry, this is a common request. To continue, please:</p>
    <p class="message">1. Ensure your documents are clear and all text is readable<br />
    2. Make sure the name matches your Dynopay account<br />
    3. Use documents that are not expired</p>
    <p class="message">Click below to resubmit your verification documents:</p>`;

    const html = dynoPayEmailTemplate("Resubmission Required", content, true, "Resubmit Documents", "https://dynopay.com/dashboard/kyc");
    
    await mailTransporter({
      to: email,
      name,
      subject,
      body: html,
    });
    
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
    const subject = `⏰ Payment link expires ${expiresIn} - ${amount} ${currency}`;
    
    const content = `<p class="message">Hey ${displayName},</p>
    <p class="message">This is a friendly reminder that your payment link from <strong>${companyName}</strong> will expire <strong>${expiresIn}</strong>.</p>
    <div class="highlight-box" style="border-left-color: #f59e0b;">
      <p><strong>Payment Details:</strong></p>
      <p>Amount: <strong>${amount} ${currency}</strong><br />
      ${description ? `Description: ${description}<br />` : ''}
      Expires: ${expiresIn}</p>
    </div>
    <p class="message">Complete your payment now to avoid missing this deadline.</p>`;

    const html = dynoPayEmailTemplate("Payment Expiring Soon", content, true, "Pay Now", paymentLink);
    
    await mailTransporter({
      to: customerEmail,
      name: displayName,
      subject,
      body: html,
    });
    
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
    const subject = "🔔 New login to your Dynopay account";
    
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
    
    const content = `<p class="message">Hey ${name},</p>
    <p class="message">We noticed a new login to your Dynopay account from a different location.</p>
    <div class="highlight-box">
      <p><strong>📍 Login Details:</strong></p>
      <p>
        <strong>Location:</strong> ${locationDisplay}<br />
        <strong>Device:</strong> ${deviceInfo}<br />
        <strong>IP Address:</strong> ${ipAddress}<br />
        <strong>Date:</strong> ${date} at ${time}
      </p>
    </div>
    <p class="message"><strong>Was this you?</strong><br />
    If you recognize this login, you can safely ignore this message.</p>
    <p class="message"><strong>Didn't log in?</strong><br />
    If you don't recognize this activity, please take action immediately:</p>
    <p class="message">1. Change your password immediately<br />
    2. Review your recent account activity<br />
    3. Contact our support team</p>`;

    const html = dynoPayEmailTemplate("New Login Detected", content, true, "Secure My Account", "https://dynopay.com/dashboard/settings");
    
    await mailTransporter({
      to: email,
      name,
      subject,
      body: html,
    });
    
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
    const subject = "🚨 Multiple failed login attempts on your account";
    
    const content = `<p class="message">Hey ${name},</p>
    <p class="message">We detected <strong>${attemptCount} failed login attempts</strong> on your Dynopay account.</p>
    <div class="highlight-box" style="border-left-color: #ef4444;">
      <p><strong>⚠️ Alert Details:</strong></p>
      <p>Failed Attempts: ${attemptCount}<br />
      Date: ${date} at ${time}<br />
      IP Address: ${ipAddress}</p>
    </div>
    <p class="message"><strong>Was this you?</strong><br />
    If you forgot your password, you can reset it using the button below.</p>
    <p class="message"><strong>Wasn't you?</strong><br />
    Someone may be trying to access your account. We recommend:</p>
    <p class="message">1. Change your password immediately<br />
    2. Enable two-factor authentication<br />
    3. Review your recent account activity</p>
    <p class="message">Your account is still secure - we blocked these login attempts.</p>`;

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
      ? `⚠️ Underpayment detected - ${paidAmount} of ${amount} ${currency} received`
      : `Payment unsuccessful - ${companyName}`;
    
    // Email to Customer
    const customerContent = `<p class="message">Hey ${displayName},</p>
    <p class="message">Unfortunately, your payment to <strong>${companyName}</strong> was not completed.</p>
    <div class="highlight-box" style="border-left-color: #ef4444;">
      <p><strong>Issue:</strong></p>
      <p>${reasonMessage}</p>
    </div>
    <div class="highlight-box">
      <p><strong>Payment Details:</strong></p>
      <p>Amount: ${amount} ${currency}<br />
      ${paidAmount ? `Amount Received: ${paidAmount} ${currency}<br />` : ''}
      Transaction ID: ${transactionId}</p>
    </div>
    ${reason === 'underpaid' ? `<p class="message">Please contact <strong>${companyName}</strong> to resolve this underpayment or request a refund.</p>` : ''}
    ${reason === 'expired' || reason === 'timeout' ? `<p class="message">Please contact <strong>${companyName}</strong> if you still wish to complete this payment.</p>` : ''}`;

    const customerHtml = dynoPayEmailTemplate("Payment Unsuccessful", customerContent);
    
    await mailTransporter({
      to: customerEmail,
      name: displayName,
      subject,
      body: customerHtml,
    });
    
    console.log(`[Email] Payment failed notification sent to customer ${customerEmail} - reason: ${reason}`);
    
    // Email to Merchant (if provided)
    if (merchantEmail) {
      const merchantDisplayName = merchantName || 'Merchant';
      const merchantSubject = reason === 'underpaid'
        ? `⚠️ Underpayment received - ${paidAmount} of ${amount} ${currency}`
        : `Payment failed - ${transactionId}`;
      
      const merchantContent = `<p class="message">Hey ${merchantDisplayName},</p>
      <p class="message">A payment from <strong>${displayName}</strong> was not completed.</p>
      <div class="highlight-box" style="border-left-color: #f59e0b;">
        <p><strong>Issue:</strong></p>
        <p>${reasonMessage}</p>
      </div>
      <div class="highlight-box">
        <p><strong>Payment Details:</strong></p>
        <p>Customer: ${customerEmail}<br />
        Amount: ${amount} ${currency}<br />
        ${paidAmount ? `Amount Received: ${paidAmount} ${currency}<br />` : ''}
        Transaction ID: ${transactionId}</p>
      </div>
      ${reason === 'underpaid' ? `<p class="message">The customer has been notified. You may need to issue a partial refund or request the remaining amount.</p>` : ''}`;

      const merchantHtml = dynoPayEmailTemplate("Payment Alert", merchantContent, true, "View Transaction", "https://dynopay.com/dashboard/transactions");
      
      await mailTransporter({
        to: merchantEmail,
        name: merchantDisplayName,
        subject: merchantSubject,
        body: merchantHtml,
      });
      
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
    const subject = `🔑 API key ${action} - ${keyType} environment`;
    const actionText = action === 'created' ? 'created' : 'regenerated';
    
    const content = `<p class="message">Hey ${name},</p>
    <p class="message">Your <strong>${keyType}</strong> API key has been ${actionText}.</p>
    <div class="highlight-box">
      <p><strong>API Key Details:</strong></p>
      <p>Environment: ${keyType === 'production' ? '🔴 Production' : '🟡 Development'}<br />
      Key Preview: ${keyPreview}...<br />
      ${action === 'regenerated' ? 'Note: Your old key is now invalid<br />' : ''}
      Date: ${date} at ${time}</p>
    </div>
    ${keyType === 'production' ? `<p class="message" style="color: #ef4444;"><strong>⚠️ Important:</strong> This is a production key. Keep it secure and never share it publicly.</p>` : ''}
    <p class="message"><strong>Didn't do this?</strong><br />
    If you didn't ${action === 'created' ? 'create' : 'regenerate'} this API key, please secure your account immediately.</p>`;

    const html = dynoPayEmailTemplate("API Key Update", content, true, "View API Keys", "https://dynopay.com/dashboard/api-keys");
    
    await mailTransporter({
      to: email,
      name,
      subject,
      body: html,
    });
    
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
    
    const content = `<p class="message">Hey ${name},</p>
    <p class="message">A wallet has been removed from your Dynopay account.</p>
    <div class="highlight-box">
      <p><strong>Removed Wallet:</strong></p>
      <p>Address: ${walletAddressMasked}<br />
      Network: ${network}<br />
      Removed: ${date} at ${time}</p>
    </div>
    <p class="message">⚠️ Payments will no longer be forwarded to this wallet.</p>
    <p class="message"><strong>Didn't do this?</strong><br />
    If you didn't remove this wallet, please secure your account immediately and contact support.</p>`;

    const html = dynoPayEmailTemplate("Wallet Removed", content, true, "Manage Wallets", "https://dynopay.com/dashboard/wallets");
    
    await mailTransporter({
      to: email,
      name,
      subject,
      body: html,
    });
    
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
    const subject = `💰 Large payment received - ${amount} ${currency}`;
    
    const content = `<p class="message">Hey ${name},</p>
    <p class="message">Great news! <strong>${companyName}</strong> received a large payment that may require your attention.</p>
    <div class="highlight-box" style="border-left-color: #10b981;">
      <p><strong>💰 Payment Details:</strong></p>
      <p>Amount: <strong>${amount} ${currency}</strong><br />
      Crypto: ${cryptoAmount} ${cryptoCurrency}<br />
      ${customerEmail ? `Customer: ${customerEmail}<br />` : ''}
      Transaction ID: ${transactionId}</p>
    </div>
    <p class="message">This payment has been automatically processed and forwarded to your wallet.</p>
    <p class="message">For large transactions, we recommend:</p>
    <p class="message">✓ Verify the transaction in your dashboard<br />
    ✓ Confirm product/service delivery to customer<br />
    ✓ Keep records for accounting purposes</p>`;

    const html = dynoPayEmailTemplate("Large Payment Received", content, true, "View Transaction", "https://dynopay.com/dashboard/transactions");
    
    await mailTransporter({
      to: email,
      name,
      subject,
      body: html,
    });
    
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
    const customerContent = `<p class="message">Hey ${displayName},</p>
    <p class="message">Your subscription to <strong>${planName}</strong> from <strong>${companyName}</strong> is now active! 🎉</p>
    <div class="highlight-box">
      <p><strong>Subscription Details:</strong></p>
      <p>Plan: ${planName}<br />
      Amount: ${amount} ${currency} / ${interval}<br />
      Next Billing: ${nextBillingDate}</p>
    </div>
    <p class="message">You'll be charged automatically on each billing date. You can manage or cancel your subscription anytime.</p>`;

    const customerHtml = dynoPayEmailTemplate("Subscription Active", customerContent);
    
    await mailTransporter({
      to: customerEmail,
      name: displayName,
      subject: customerSubject,
      body: customerHtml,
    });
    
    // Email to Merchant
    const merchantSubject = `New subscriber - ${planName}`;
    const merchantContent = `<p class="message">Hey ${merchantName},</p>
    <p class="message">Great news! You have a new subscriber for <strong>${planName}</strong>. 🎉</p>
    <div class="highlight-box">
      <p><strong>Subscription Details:</strong></p>
      <p>Customer: ${customerEmail}<br />
      Plan: ${planName}<br />
      Revenue: ${amount} ${currency} / ${interval}<br />
      Next Billing: ${nextBillingDate}</p>
    </div>`;

    const merchantHtml = dynoPayEmailTemplate("New Subscription", merchantContent, true, "View Subscriptions", "https://dynopay.com/dashboard/subscriptions");
    
    await mailTransporter({
      to: merchantEmail,
      name: merchantName,
      subject: merchantSubject,
      body: merchantHtml,
    });
    
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
    const customerContent = `<p class="message">Hey ${displayName},</p>
    <p class="message">Your subscription to <strong>${planName}</strong> from <strong>${companyName}</strong> has been cancelled.</p>
    <div class="highlight-box">
      <p><strong>Cancellation Details:</strong></p>
      <p>Plan: ${planName}<br />
      Effective: ${effectiveDate}<br />
      Cancelled by: ${cancelledBy === 'customer' ? 'You' : companyName}</p>
    </div>
    <p class="message">You will continue to have access until ${effectiveDate}. After that, no further charges will be made.</p>
    <p class="message">We're sorry to see you go! If you change your mind, you can always resubscribe.</p>`;

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
