import mailTransporter from "../utils/mailTransporter";

/**
 * DynoPay Email Service - Phase 9
 * Comprehensive email notification system with 17 templates
 * Provider: Brevo
 */

// Base email template wrapper
const dynoPayEmailTemplate = (
  heading: string,
  content: string,
  showButton: boolean = false,
  buttonText: string = "",
  buttonLink: string = ""
) => {
  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
  <html xmlns="http://www.w3.org/1999/xhtml">
    <head>
      <meta charset="UTF-8" />
      <meta content="width=device-width, initial-scale=1" name="viewport" />
      <meta name="x-apple-disable-message-reformatting" />
      <meta http-equiv="X-UA-Compatible" content="IE=edge" />
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <style>
        body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; line-height: 1.6; color: #1a1a2e; margin: 0; padding: 0; background-color: #f5f7fa; }
        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
        .header { background: linear-gradient(135deg, #1034a6 0%, #0d2570 100%); padding: 24px 32px; text-align: center; }
        .logo { font-size: 28px; font-weight: 700; color: #ffffff; text-decoration: none; letter-spacing: -0.5px; }
        .logo span { color: #f47323; }
        .content { padding: 40px 32px; }
        .heading { font-size: 24px; font-weight: 600; color: #1034a6; margin: 0 0 24px 0; }
        .message { font-size: 15px; color: #4a4a4a; margin-bottom: 16px; white-space: pre-line; }
        .highlight-box { background: linear-gradient(135deg, #f8f9ff 0%, #eef1ff 100%); border-left: 4px solid #1034a6; padding: 16px 20px; margin: 24px 0; border-radius: 0 8px 8px 0; }
        .otp-code { font-size: 32px; font-weight: 700; color: #1034a6; letter-spacing: 8px; text-align: center; margin: 20px 0; }
        .button { display: inline-block; background: linear-gradient(135deg, #f47323 0%, #e05a00 100%); color: #ffffff !important; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 15px; margin: 16px 0; }
        .footer { background: #1a1a2e; padding: 32px; text-align: center; color: #9ca3af; font-size: 13px; }
        .footer-logo { font-size: 20px; font-weight: 700; color: #ffffff; margin-bottom: 16px; }
        .footer-logo span { color: #f47323; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <a href="https://dynopay.com" class="logo">Dyno<span>Pay</span></a>
        </div>
        <div class="content">
          <h1 class="heading">${heading}</h1>
          ${content}
          ${showButton ? `<div style="text-align: center; margin: 24px 0;"><a href="${buttonLink}" class="button">${buttonText}</a></div>` : ''}
          <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
            <p>Best regards,<br /><strong>The DynoPay Team</strong></p>
          </div>
        </div>
        <div class="footer">
          <div class="footer-logo">Dyno<span>Pay</span></div>
          <p>Secure Crypto Payment Gateway</p>
          <p>© ${new Date().getFullYear()} DynoPay. All rights reserved.</p>
          <div style="margin-top: 16px;">
            <a href="https://dynopay.com/privacy" style="color: #9ca3af; text-decoration: none; margin: 0 12px;">Privacy</a>
            <a href="https://dynopay.com/terms" style="color: #9ca3af; text-decoration: none; margin: 0 12px;">Terms</a>
            <a href="https://dynopay.com/support" style="color: #9ca3af; text-decoration: none; margin: 0 12px;">Support</a>
          </div>
        </div>
      </div>
    </body>
  </html>`;
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
    const subject = "Welcome to Dynopay — Let's get you paid";
    const content = `<p class="message">Hey ${name},</p>
    <p class="message">Welcome to DynoPay! We're excited to have you on board. 🎉</p>
    <p class="message">DynoPay makes accepting crypto payments simple, secure, and fast. Whether you're a freelancer, business owner, or developer, we've got you covered.</p>
    <div class="highlight-box">
      <p><strong>Here's what you can do next:</strong></p>
      <p>✓ Complete your company profile<br />
      ✓ Add your payout wallet<br />
      ✓ Start accepting payments</p>
    </div>
    <p class="message">If you have any questions, our support team is here to help!</p>`;

    const html = dynoPayEmailTemplate("Welcome to DynoPay", content, true, "Get Started", "https://dynopay.com/dashboard");
    
    await mailTransporter({
      to: email,
      name,
      subject,
      body: html,
    });
    
    console.log(`Welcome email sent to ${email}`);
  } catch (e) {
    console.error("Welcome email error:", e);
  }
};

/**
 * Template 2: Company Profile Created
 * Trigger: Company created
 */
export const sendCompanyProfileCreatedEmail = async (
  email: string,
  name: string,
  companyName: string
) => {
  try {
    const subject = "Profile complete — One step left";
    const content = `<p class="message">Hey ${name},</p>
    <p class="message">Great job! Your company profile for <strong>${companyName}</strong> is now complete. 🎯</p>
    <p class="message">You're almost ready to start accepting payments. The last step is to add your payout wallet address.</p>
    <div class="highlight-box">
      <p><strong>Why add a wallet?</strong></p>
      <p>Your wallet is where we'll send the crypto payments you receive. It's quick and secure!</p>
    </div>`;

    const html = dynoPayEmailTemplate("Profile Complete", content, true, "Add Wallet", "https://dynopay.com/dashboard/wallets");
    
    await mailTransporter({
      to: email,
      name,
      subject,
      body: html,
    });
    
    console.log(`Company profile created email sent to ${email}`);
  } catch (e) {
    console.error("Company profile created email error:", e);
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
    const content = `<p class="message">Hey ${name},</p>
    <p class="message">You're adding a new payout wallet to your DynoPay account. Please verify this action with the OTP code below:</p>
    <div class="otp-code">${otpCode}</div>
    <div class="highlight-box">
      <p><strong>Wallet Details:</strong></p>
      <p>Address: ${walletAddressMasked}<br />
      Network: ${network}</p>
    </div>
    <p class="message">This code expires in 10 minutes. If you didn't request this, please ignore this email.</p>`;

    const html = dynoPayEmailTemplate("Confirm Your Wallet", content);
    
    await mailTransporter({
      to: email,
      name,
      subject,
      body: html,
    });
    
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
    const content = `<p class="message">Hey ${name},</p>
    <p class="message">Excellent! Your payout wallet has been verified and is now active. ✅</p>
    <div class="highlight-box">
      <p><strong>Wallet Details:</strong></p>
      <p>Address: ${walletAddressMasked}<br />
      Network: ${network}</p>
    </div>
    <p class="message">All payments you receive will be automatically forwarded to this wallet. You're all set to start accepting crypto payments!</p>`;

    const html = dynoPayEmailTemplate("Wallet Active", content, true, "View Dashboard", "https://dynopay.com/dashboard");
    
    await mailTransporter({
      to: email,
      name,
      subject,
      body: html,
    });
    
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
    const content = `<p class="message">Hey ${name},</p>
    <p class="message">You're updating your payout wallet. Please verify this change with the OTP code below:</p>
    <div class="otp-code">${otpCode}</div>
    <div class="highlight-box">
      <p><strong>Wallet Change:</strong></p>
      <p>Old: ${oldWalletMasked}<br />
      New: ${newWalletMasked}<br />
      Network: ${network}</p>
    </div>
    <p class="message">⚠️ This code expires in 10 minutes. If you didn't request this change, please secure your account immediately.</p>`;

    const html = dynoPayEmailTemplate("Confirm Wallet Update", content);
    
    await mailTransporter({
      to: email,
      name,
      subject,
      body: html,
    });
    
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
    const subject = `Payment received — ${amount} ${currency}`;
    const content = `<p class="message">Hey ${name},</p>
    <p class="message">Great news! Your company <strong>${companyName}</strong> has received a payment. 💰</p>
    <div class="highlight-box">
      <p><strong>Payment Details:</strong></p>
      <p>Amount: <strong>${amount} ${currency}</strong><br />
      Date: ${date} at ${time}<br />
      Transaction ID: ${transactionId}</p>
    </div>
    <p class="message">The funds have been forwarded to your payout wallet. You can view the full transaction details in your dashboard.</p>`;

    const html = dynoPayEmailTemplate("Payment Received", content, true, "View Transaction", "https://dynopay.com/dashboard/transactions");
    
    await mailTransporter({
      to: email,
      name,
      subject,
      body: html,
    });
    
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
    const content = `<p class="message">Hey ${name},</p>
    <p class="message">Please verify your email address to complete your DynoPay registration. Enter this code in the verification page:</p>
    <div class="otp-code">${otpCode}</div>
    <p class="message">This code expires in 10 minutes. If you didn't create a DynoPay account, please ignore this email.</p>`;

    const html = dynoPayEmailTemplate("Verify Your Email", content);
    
    await mailTransporter({
      to: email,
      name,
      subject,
      body: html,
    });
    
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
    const content = `<p class="message">Hey ${name},</p>
    <p class="message">Here's your one-time login code for DynoPay:</p>
    <div class="otp-code">${otpCode}</div>
    <p class="message">This code expires in 10 minutes. If you didn't request this code, please secure your account immediately.</p>`;

    const html = dynoPayEmailTemplate("Your Login Code", content);
    
    await mailTransporter({
      to: email,
      name,
      subject,
      body: html,
    });
    
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
    const content = `<p class="message">Hey ${name},</p>
    <p class="message">You requested to reset your DynoPay password. Use this code to continue:</p>
    <div class="otp-code">${otpCode}</div>
    <p class="message">This code expires in 10 minutes. If you didn't request a password reset, please ignore this email and your password will remain unchanged.</p>`;

    const html = dynoPayEmailTemplate("Reset Your Password", content);
    
    await mailTransporter({
      to: email,
      name,
      subject,
      body: html,
    });
    
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
    const content = `<p class="message">Hey ${name},</p>
    <p class="message">Your DynoPay password has been successfully updated. ✅</p>
    <div class="highlight-box">
      <p><strong>Change Details:</strong></p>
      <p>Date: ${date} at ${time}</p>
    </div>
    <p class="message">⚠️ If you didn't make this change, please contact our support team immediately to secure your account.</p>`;

    const html = dynoPayEmailTemplate("Password Updated", content, true, "View Account Settings", "https://dynopay.com/dashboard/settings");
    
    await mailTransporter({
      to: email,
      name,
      subject,
      body: html,
    });
    
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
    const content = `<p class="message">Hey ${name},</p>
    <p class="message">Your payment link has been created successfully! 🔗</p>
    <div class="highlight-box">
      <p><strong>Payment Link Details:</strong></p>
      <p>Amount: <strong>${amount} ${currency}</strong><br />
      Description: ${description}<br />
      ${expiresAt ? `Expires: ${expiresAt}` : 'Expires: Never'}</p>
    </div>
    <p class="message">Payment Link:<br /><a href="${paymentLink}" style="color: #1034a6; word-break: break-all;">${paymentLink}</a></p>
    <p class="message">Share this link with your customer to receive payment.</p>`;

    const html = dynoPayEmailTemplate("Payment Link Created", content, true, "Copy Link", paymentLink);
    
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
  totalVolume: string
) => {
  try {
    const subject = "Verification required — $5,000 volume reached";
    const content = `<p class="message">Hey ${name},</p>
    <p class="message">Congratulations on reaching <strong>$${totalVolume}</strong> in transaction volume! 🎉</p>
    <p class="message">To continue accepting payments above $5,000, we need to verify your identity. This is a regulatory requirement and helps us keep DynoPay secure.</p>
    <div class="highlight-box">
      <p><strong>What you need:</strong></p>
      <p>✓ Government-issued ID<br />
      ✓ Proof of address (utility bill, bank statement)<br />
      ✓ 5 minutes of your time</p>
    </div>
    <p class="message">Complete your verification now to keep accepting payments without interruption.</p>`;

    const html = dynoPayEmailTemplate("Verification Required", content, true, "Start Verification", "https://dynopay.com/dashboard/kyc");
    
    await mailTransporter({
      to: email,
      name,
      subject,
      body: html,
    });
    
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
    const subject = "Verification approved — You're all set";
    const content = `<p class="message">Hey ${name},</p>
    <p class="message">Great news! Your identity verification has been approved. ✅</p>
    <p class="message">You can now accept payments without limits and access all DynoPay features.</p>
    <div class="highlight-box">
      <p><strong>What's next?</strong></p>
      <p>Your account is fully verified. Keep growing your business with DynoPay!</p>
    </div>
    <p class="message">Thank you for completing the verification process.</p>`;

    const html = dynoPayEmailTemplate("Verification Approved", content, true, "View Dashboard", "https://dynopay.com/dashboard");
    
    await mailTransporter({
      to: email,
      name,
      subject,
      body: html,
    });
    
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
    ✓ Match the name on your DynoPay account</p>
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
  topCurrency: string
) => {
  try {
    const subject = "Your weekly Dynopay summary";
    const content = `<p class="message">Hey ${name},</p>
    <p class="message">Here's your weekly activity summary for ${periodStart} to ${periodEnd}:</p>
    <div class="highlight-box">
      <p><strong>📊 This Week's Stats:</strong></p>
      <p>Total Transactions: <strong>${transactionCount}</strong><br />
      Total Volume: <strong>$${totalVolume}</strong><br />
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
    <p class="message">We detected unusual activity on your DynoPay account.</p>
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

export default {
  sendWelcomeEmail,
  sendCompanyProfileCreatedEmail,
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
};
