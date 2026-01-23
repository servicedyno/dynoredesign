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

interface mailOptions {
  to: string;
  name: string;
  subject: string;
  body?: string;
}

const mailTransporter = async ({ to, subject, body, name }: mailOptions) => {
  const { data } = await axios.post(
    "https://api.brevo.com/v3/smtp/email",
    {
      sender: {
        name: "DynoPay",
        email: "notify@dynopay.com",
      },
      subject,
      to: [
        {
          email: to,
          name: name.trim().length > 0 ? name : to,
        },
      ],
      textContent: body,
    },
    {
      headers: {
        "api-key": process.env.BREVO_API_KEY,
      },
    }
  );
  console.log("Email sent via Brevo:", data);
  return data;
};

export default mailTransporter;
