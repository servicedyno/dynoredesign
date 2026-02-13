/**
 * Shared professional email base template for Dynopay
 * Used by both services/emailService.ts and helper/sendEmail.ts
 */

// Public CDN-hosted PNG logo for maximum email client compatibility
const DYNOPAY_LOGO_CDN = "https://files.catbox.moe/9wq2et.png";

export const getDynopayLogoUrl = (): string => {
  const serverUrl = process.env.SERVER_URL;
  if (serverUrl) {
    return `${serverUrl}/api/static/dynopay-white-logo.png`;
  }
  return DYNOPAY_LOGO_CDN;
};

export const getCurrencySymbol = (currency: string): string => {
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
 * Professional base email template
 * Renders the outer shell: header, content area, footer
 */
export const baseEmailTemplate = (
  heading: string,
  bodyContent: string,
  options?: {
    showButton?: boolean;
    buttonText?: string;
    buttonLink?: string;
    preheader?: string;
  }
): string => {
  const LOGO_URL = getDynopayLogoUrl();
  const year = new Date().getFullYear();
  const { showButton = false, buttonText = '', buttonLink = '', preheader = '' } = options || {};

  const buttonBlock = showButton && buttonText && buttonLink
    ? `<tr><td align="center" style="padding: 28px 0 8px 0;">
        <a href="${buttonLink}" style="display: inline-block; background-color: #f47323; color: #ffffff; text-decoration: none; padding: 13px 36px; border-radius: 6px; font-weight: 600; font-size: 15px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; mso-padding-alt: 0; text-align: center;">
          <!--[if mso]><i style="mso-font-width: 150%; mso-text-raise: 26pt;">&nbsp;</i><![endif]-->
          <span style="mso-text-raise: 13pt;">${buttonText}</span>
          <!--[if mso]><i style="mso-font-width: 150%;">&nbsp;</i><![endif]-->
        </a>
      </td></tr>`
    : '';

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta charset="UTF-8" />
  <meta content="width=device-width, initial-scale=1" name="viewport" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta content="telephone=no" name="format-detection" />
  <meta name="color-scheme" content="light dark" />
  <meta name="supported-color-schemes" content="light dark" />
  <title>Dynopay</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td { font-family: Arial, Helvetica, sans-serif !important; }
  </style>
  <![endif]-->
  <style type="text/css">
    :root { color-scheme: light dark; supported-color-schemes: light dark; }
    body { margin: 0; padding: 0; -webkit-font-smoothing: antialiased; -webkit-text-size-adjust: 100%; }
    table { border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; }
    @media only screen and (max-width: 620px) {
      .outer { width: 100% !important; }
      .inner { padding: 28px 20px !important; }
      .hdr { padding: 20px !important; }
      .ftr { padding: 24px 20px !important; }
    }
    @media (prefers-color-scheme: dark) {
      body, .bg { background-color: #111827 !important; }
      .card { background-color: #1f2937 !important; }
      .hdr-bar { background-color: #0c1a3d !important; }
      h1.hdg { color: #93c5fd !important; }
      .msg, .msg p, .msg li, .msg td { color: #d1d5db !important; }
      .msg strong { color: #f3f4f6 !important; }
      .msg a:not(.btn) { color: #93c5fd !important; }
      .info-box { background-color: #1e293b !important; border-left-color: #3b82f6 !important; }
      .info-box td, .info-box p, .info-box strong { color: #d1d5db !important; }
      .info-box strong { color: #f3f4f6 !important; }
      .status-success { background-color: #064e3b !important; color: #6ee7b7 !important; }
      .status-pending { background-color: #78350f !important; color: #fcd34d !important; }
      .status-error { background-color: #7f1d1d !important; color: #fca5a5 !important; }
      .data-row { border-bottom-color: #374151 !important; }
      .sign { color: #9ca3af !important; }
      .sign strong { color: #d1d5db !important; }
      .sep { border-top-color: #374151 !important; }
      .ftr-bg { background-color: #0f172a !important; }
      .ftr-text { color: #6b7280 !important; }
      .ftr-link { color: #6b7280 !important; }
      .alert-box { background-color: #451a03 !important; border-left-color: #f59e0b !important; }
      .alert-box td, .alert-box p { color: #fcd34d !important; }
      .error-box { background-color: #450a0a !important; border-left-color: #ef4444 !important; }
      .error-box td, .error-box p { color: #fca5a5 !important; }
      .success-box { background-color: #052e16 !important; border-left-color: #22c55e !important; }
      .success-box td, .success-box p { color: #86efac !important; }
      u + .body .bg { background-color: #111827 !important; }
    }
  </style>
</head>
<body class="body" style="margin: 0; padding: 0; background-color: #f3f4f6;">
  ${preheader ? `<div style="display:none;font-size:1px;color:#f3f4f6;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${preheader}</div>` : ''}
  <table role="presentation" class="bg" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; table-layout: fixed;">
    <tr>
      <td align="center" style="padding: 32px 16px;">
        <table role="presentation" class="outer card" width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 12px; overflow: hidden;">
          <!-- Accent bar -->
          <tr><td class="hdr-bar" style="background-color: #0d1f5c; height: 4px; font-size: 0; line-height: 0;">&nbsp;</td></tr>
          <!-- Header -->
          <tr>
            <td class="hdr" style="padding: 28px 32px 20px 32px; text-align: center;">
              <a href="https://dynopay.com" style="text-decoration: none;">
                <img src="${LOGO_URL}" alt="Dynopay" width="120" height="40" style="display: inline-block; max-width: 120px; height: auto;" />
              </a>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td class="inner msg" style="padding: 8px 40px 40px 40px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">
              <h1 class="hdg" style="font-size: 22px; font-weight: 700; color: #0d1f5c; margin: 0 0 20px 0; line-height: 1.3;">${heading}</h1>
              ${bodyContent}
              ${buttonBlock}
              <!-- Sign-off -->
              <table role="presentation" class="sep" width="100%" cellpadding="0" cellspacing="0" style="margin-top: 32px; border-top: 1px solid #e5e7eb;">
                <tr>
                  <td class="sign" style="padding-top: 20px; font-size: 14px; color: #6b7280; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; line-height: 1.5;">
                    Best regards,<br /><strong style="color: #374151;">The Dynopay Team</strong>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td class="ftr ftr-bg" style="background-color: #111827; padding: 28px 32px; text-align: center; border-radius: 0 0 12px 12px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-bottom: 16px;">
                    <img src="${LOGO_URL}" alt="Dynopay" width="90" height="30" style="display: inline-block; max-width: 90px; height: auto; opacity: 0.8;" />
                  </td>
                </tr>
                <tr>
                  <td align="center" class="ftr-text" style="color: #6b7280; font-size: 12px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; padding-bottom: 16px; line-height: 1.5;">
                    Secure Crypto Payment Gateway
                  </td>
                </tr>
                <!-- Social icons -->
                <tr>
                  <td align="center" style="padding-bottom: 16px;">
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 0 5px;"><a href="https://www.facebook.com/dynopay" target="_blank"><img src="https://cdn-icons-png.flaticon.com/512/733/733547.png" alt="Facebook" width="22" height="22" style="display: block; border-radius: 50%; opacity: 0.7;" /></a></td>
                        <td style="padding: 0 5px;"><a href="https://www.instagram.com/dynopay" target="_blank"><img src="https://cdn-icons-png.flaticon.com/512/733/733558.png" alt="Instagram" width="22" height="22" style="display: block; border-radius: 50%; opacity: 0.7;" /></a></td>
                        <td style="padding: 0 5px;"><a href="https://x.com/dynopaycom" target="_blank"><img src="https://cdn-icons-png.flaticon.com/512/5969/5969020.png" alt="X" width="22" height="22" style="display: block; border-radius: 50%; opacity: 0.7;" /></a></td>
                        <td style="padding: 0 5px;"><a href="https://www.linkedin.com/company/dynopay/" target="_blank"><img src="https://cdn-icons-png.flaticon.com/512/733/733561.png" alt="LinkedIn" width="22" height="22" style="display: block; border-radius: 50%; opacity: 0.7;" /></a></td>
                        <td style="padding: 0 5px;"><a href="https://t.me/Dynopay_Announcements" target="_blank"><img src="https://cdn-icons-png.flaticon.com/512/2111/2111646.png" alt="Telegram" width="22" height="22" style="display: block; border-radius: 50%; opacity: 0.7;" /></a></td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td align="center" class="ftr-text" style="color: #4b5563; font-size: 11px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; padding-bottom: 12px;">
                    &copy; ${year} Dynopay. All rights reserved.
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 0 10px;"><a class="ftr-link" href="https://dynopay.com/privacy" style="color: #6b7280; text-decoration: none; font-size: 11px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">Privacy</a></td>
                        <td class="ftr-text" style="color: #4b5563; font-size: 11px;">|</td>
                        <td style="padding: 0 10px;"><a class="ftr-link" href="https://dynopay.com/terms" style="color: #6b7280; text-decoration: none; font-size: 11px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">Terms</a></td>
                        <td class="ftr-text" style="color: #4b5563; font-size: 11px;">|</td>
                        <td style="padding: 0 10px;"><a class="ftr-link" href="https://dynopay.com/support" style="color: #6b7280; text-decoration: none; font-size: 11px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">Support</a></td>
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
};

/**
 * Reusable email component: Info/data box
 * Used for payment details, transaction info, etc.
 */
export const infoBox = (content: string, borderColor: string = '#0d1f5c'): string => {
  return `<table role="presentation" class="info-box" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border-radius: 8px; border-left: 3px solid ${borderColor}; margin: 20px 0;">
    <tr><td style="padding: 16px 20px;">${content}</td></tr>
  </table>`;
};

/**
 * Reusable email component: Data row for tables
 */
export const dataRow = (label: string, value: string, isLast: boolean = false): string => {
  const border = isLast ? '' : 'border-bottom: 1px solid #f1f5f9;';
  return `<tr class="data-row" style="${border}">
    <td style="padding: 10px 0; color: #6b7280; font-size: 14px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">${label}</td>
    <td style="padding: 10px 0; color: #1f2937; font-size: 14px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; text-align: right;">${value}</td>
  </tr>`;
};

/**
 * Reusable email component: Status badge
 */
export const statusBadge = (label: string, type: 'success' | 'pending' | 'error' | 'info' = 'info'): string => {
  const styles: Record<string, { bg: string; color: string; cls: string }> = {
    success: { bg: '#dcfce7', color: '#166534', cls: 'status-success' },
    pending: { bg: '#fef3c7', color: '#92400e', cls: 'status-pending' },
    error: { bg: '#fee2e2', color: '#991b1b', cls: 'status-error' },
    info: { bg: '#dbeafe', color: '#1e40af', cls: 'status-success' },
  };
  const s = styles[type];
  return `<span class="${s.cls}" style="display: inline-block; background: ${s.bg}; color: ${s.color}; padding: 3px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">${label}</span>`;
};

/**
 * Standard paragraph style
 */
export const p = (text: string, extra: string = ''): string => {
  return `<p style="font-size: 15px; color: #374151; line-height: 1.65; margin: 0 0 14px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; ${extra}">${text}</p>`;
};

/**
 * OTP code display
 */
export const otpBlock = (code: string): string => {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
    <tr><td align="center">
      <div style="display: inline-block; background-color: #f0f4ff; border: 2px dashed #0d1f5c; border-radius: 8px; padding: 16px 40px; font-size: 32px; font-weight: 700; color: #0d1f5c; letter-spacing: 10px; font-family: 'SF Mono', 'Fira Code', monospace, Arial, sans-serif;">${code}</div>
    </td></tr>
  </table>`;
};
