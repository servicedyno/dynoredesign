// import { Infobip, AuthType } from "@infobip-api/sdk";

import axios from "axios";

// const mailTransporter = new Infobip({
//   baseUrl: "2v86nm.api.infobip.com",
//   apiKey: process.env.INFOBIP_API_KEY,
//   authType: AuthType.ApiKey,
// });

// const brevo = require("@getbrevo/brevo");
// const defaultClient = brevo.ApiClient.instance;

// const apiKey = defaultClient.authentications["api-key"];
// apiKey.apiKey = "xkeysib-YOUR_API_KEY";

// const mailTransporter = new brevo.TransactionalEmailsApi();
// const smtpTemplate = new brevo.SendSmtpEmail();

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

const mailTransporter = async ({ to, subject, body, name, attachments }: mailOptions) => {
  const payload: any = {
    sender: {
      name: "DynoPay",
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
