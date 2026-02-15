import axios from "axios";
import { captureError } from "../services/errorMonitoringService";
import { log } from "../utils/loggers";

interface Attachment {
  name: string;
  content: string; // Base64 encoded content
  contentType?: string;
}

interface mailOptions {
  to: string;
  name: string;
  subject: string;
  body?: string;
  attachments?: Attachment[];
}

/**
 * Strip HTML tags for plain text fallback
 */
const stripHtml = (html: string): string => {
  return html
    .replace(/<style[^>]*>.*?<\/style>/gi, '')
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Basic email validation (catches obvious bad inputs before hitting Brevo)
 */
const isValidEmail = (email: string): boolean => {
  if (!email || typeof email !== 'string') return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
};

/**
 * Send email using Brevo (formerly Sendinblue) API
 */
const mailTransporter = async ({ to, subject, body, name, attachments }: mailOptions) => {
  // --- Input validation (prevent Brevo 400s from bad data) ---
  if (!to || !isValidEmail(to)) {
    const err = new Error(`Invalid recipient email: "${to}"`);
    captureError(err, 'email', { extraContext: `mailTransporter validation | subject=${subject}` });
    throw err;
  }
  if (!subject || subject.trim().length === 0) {
    const err = new Error(`Empty subject for email to ${to}`);
    captureError(err, 'email', { extraContext: 'mailTransporter validation' });
    throw err;
  }
  if (!body || body.trim().length === 0) {
    const err = new Error(`Empty body for email to ${to} | subject=${subject}`);
    captureError(err, 'email', { extraContext: 'mailTransporter validation' });
    throw err;
  }

  // Sanitize name: Brevo rejects empty string names
  const safeName = (name && name.trim().length > 0) ? name.trim() : to;

  const payload: Record<string, unknown> = {
    sender: {
      name: "Dynopay",
      email: "notify@dynocash.com",
    },
    subject: subject.trim(),
    to: [
      {
        email: to.trim(),
        name: safeName,
      },
    ],
    htmlContent: body,
    textContent: stripHtml(body).substring(0, 50000), // Brevo textContent cap: prevent oversized payloads
  };

  // Add attachments if provided
  if (attachments && attachments.length > 0) {
    payload.attachment = attachments.map(att => ({
      name: att.name,
      content: att.content,
      contentType: att.contentType || 'application/pdf',
    }));
  }

  try {
    const { data } = await axios.post(
      "https://api.brevo.com/v3/smtp/email",
      payload,
      {
        headers: {
          "api-key": process.env.BREVO_API_KEY,
        },
        timeout: 15000,
      }
    );
    console.log(`[Email] Sent to ${to}: ${subject}${attachments ? ` (with ${attachments.length} attachment(s))` : ''}`);
    return data;
  } catch (apiError) {
    // Capture Brevo-specific error details for diagnostics
    captureError(apiError, 'email', {
      extraContext: `Brevo API call | to=${to} | subject=${subject.substring(0, 60)} | payloadSize=${JSON.stringify(payload).length}`,
    });
    throw apiError;
  }
};

export default mailTransporter;
export type { mailOptions, Attachment };
