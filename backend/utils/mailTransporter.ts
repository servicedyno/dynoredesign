import axios from "axios";

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
 * Send email using Brevo (formerly Sendinblue) API
 */
const mailTransporter = async ({ to, subject, body, name, attachments }: mailOptions) => {
  const payload: Record<string, unknown> = {
    sender: {
      name: "Dynopay",
      email: "notify@dynocash.com",
    },
    subject,
    to: [
      {
        email: to,
        name: name.trim().length > 0 ? name : to,
      },
    ],
    htmlContent: body,                    // Send as HTML for proper rendering
    textContent: stripHtml(body || ''),   // Plain text fallback for email clients that don't support HTML
  };

  // Add attachments if provided
  if (attachments && attachments.length > 0) {
    payload.attachment = attachments.map(att => ({
      name: att.name,
      content: att.content,
      contentType: att.contentType || 'application/pdf',
    }));
  }

  const { data } = await axios.post(
    "https://api.brevo.com/v3/smtp/email",
    payload,
    {
      headers: {
        "api-key": process.env.BREVO_API_KEY,
      },
    }
  );
  console.log(`[Email] Sent to ${to}: ${subject}${attachments ? ` (with ${attachments.length} attachment(s))` : ''}`);
  return data;
};

export default mailTransporter;
export type { mailOptions, Attachment };
