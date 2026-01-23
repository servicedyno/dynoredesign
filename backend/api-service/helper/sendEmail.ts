import mailTransporter from "../utils/mailTransporter";

const emailTemplate = (
  name: string,
  message: string,
  heading: string,
  showImage: boolean
) => {
  const html = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
  <html
    xmlns="http://www.w3.org/1999/xhtml"
    xmlns:o="urn:schemas-microsoft-com:office:office"
  >
    <head>
      <meta charset="UTF-8" />
      <meta content="width=device-width, initial-scale=1" name="viewport" />
      <meta name="x-apple-disable-message-reformatting" />
      <meta http-equiv="X-UA-Compatible" content="IE=edge" />
      <meta content="telephone=no" name="format-detection" />
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
      <link
        href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;700&display=swap"
        rel="stylesheet"
      />
      <style>
      body {
        font-family: "Poppins", sans-serif !important;
        font-size: 14px;
        height: auto;
        margin: 0;
        padding: 0;
        display: flex;
        justify-content: center;
      }
      div {
        font-family: "Poppins", sans-serif !important;
      }
      p {
        font-family: "Poppins", sans-serif !important;
      }
      h1 {
        font-family: "Poppins", sans-serif !important;
      }
      a {
        font-family: "Poppins", sans-serif !important;
      }
      .box {
        max-width: 600px;
        width: 100%;
        margin-left: auto;
        margin-right: auto;
      }
      .header {
        background: #1034a6;
        display: flex;

        padding: 16px;
      }
      .button {
        border-radius: 30px;
        background: #f47323;
        text-decoration: none;
        padding: 10px 20px;
        margin-left: auto;
        font-weight: 500;
        font-size: 16px;
      }
      .body {
        padding: 24px;
      }
      .body h1 {
        padding-top: 16px;
        padding-bottom: 16px;
        text-align: center;
        margin: 0;
      }
      .img-outer {
        border: 1px solid #d2d2d2;
        padding: 24px;
        border-radius: 30px;
      }
      .body img {
        width: 100%;
        border-radius: 30px;
      }
      .footer {
        background: #1034a6;
        display: flex;

        padding: 24px 16px;
      }
      .flex-box {
        display: flex;
        align-items: center;
        margin-left: auto;
      }
      .flex-box a {
        padding-right: 12px;
      }
      .base {
        padding: 24px;
        text-align: center;
      }
      .social-box {
        display: flex;
        width: fit-content;
        margin-left: auto;
        margin-right: auto;
      }
      .social-box a {
        padding: 4px;
      }
      .social-heading img{
        width:fit-content;
      }
      .social-text img{
        width:fit-content;
      }
    </style>
    </head>
    <body>
      <div class="box">
        <div class="header">
          <a target="_blank" href="https://www.expeditesocial.com/">
            <img
              src="https://www.expeditesocial.com/_next/static/media/logoWhite.69ed444d.png"
              crossorigin="anonymous"
              alt="Logo"
              style="
                display: block;
                border: 0;
                outline: none;
                text-decoration: none;
              "
              height="auto"
              title="Logo"
              width="140"
            />
          </a>
          <a
            href="https://app.expeditesocial.com/auth/login"
            target="_blank"
            class="button"
            style="color: #ffffff !important;"
          >
            Login
          </a>
        </div>
        <div class="body">
          ${
            showImage
              ? `<div class="img-outer">
              <a target="_blank" href="https://www.expeditesocial.com/">
            <img
              src="https://www.expeditesocial.com/images/banner.gif"
              crossorigin="anonymous"
              alt="No image"
            />
          </a>
              </div>`
              : ""
          }
          <h1 class="social-heading">${heading}</h1>
          <p style="margin-bottom: 8px">Hey ${name ?? "User"},</p>
          <div class="social-text">${message}</div>
          <div style="margin-top: 8px">
            Best regards,<br />
            The <strong>Expedite Social</strong> Team
          </div>
        </div>
        <div class="footer">
          <a target="_blank" href="https://www.expeditesocial.com/">
            <img
              src="https://www.expeditesocial.com/_next/static/media/logoWhite.69ed444d.png"
              crossorigin="anonymous"
              alt="Logo"
              style="
                display: block;
                border: 0;
                outline: none;
                text-decoration: none;
              "
              height="auto"
              title="Logo"
              width="140"
            />
          </a>
          <div class="flex-box">
            <a target="_blank" href="https://www.expeditesocial.com/">
              <img
                src="https://www.expeditesocial.com/images/google_play.png"
                crossorigin="anonymous"
                alt="Logo"
                style="
                  display: block;
                  border: 0;
                  outline: none;
                  text-decoration: none;
                "
                height="auto"
                title="Logo"
                width="140"
              />
            </a>
            <a target="_blank" href="https://www.expeditesocial.com/">
              <img
                src="https://www.expeditesocial.com/images/apple_store.png"
                crossorigin="anonymous"
                alt="Logo"
                style="
                  display: block;
                  border: 0;
                  outline: none;
                  text-decoration: none;
                "
                height="auto"
                title="Logo"
                width="140"
              />
            </a>
          </div>
        </div>
        <div class="base">
          <div class="social-box">
            <a href="https://instagram.com/" target="_blank">
              <img
                src="https://www.expeditesocial.com/images/instagram.png"
                crossorigin="anonymous"
                alt="Logo"
                style="
                  display: block;
                  border: 0;
                  outline: none;
                  text-decoration: none;
                "
                height="auto"
                title="Logo"
                width="35"
            /></a>
            <a href="https://facebook.com/" target="_blank"
              ><img
                src="https://www.expeditesocial.com/images/facebook.png"
                crossorigin="anonymous"
                alt="Logo"
                style="
                  display: block;
                  border: 0;
                  outline: none;
                  text-decoration: none;
                "
                height="auto"
                title="Logo"
                width="30"
            /></a>
            <a href="https://youtube.com/" target="_blank"
              ><img
                src="https://www.expeditesocial.com/images/youtube.png"
                crossorigin="anonymous"
                alt="Logo"
                style="
                  display: block;
                  border: 0;
                  outline: none;
                  text-decoration: none;
                "
                height="auto"
                title="Logo"
                width="25"
            /></a>
            <a href="https://twitter.com/" target="_blank"
              ><img
                src="https://www.expeditesocial.com/images/twitter.png"
                crossorigin="anonymous"
                alt="Logo"
                style="
                  display: block;
                  border: 0;
                  outline: none;
                  text-decoration: none;
                "
                height="auto"
                title="Logo"
                width="30"
            /></a>
          </div>
          <div class="bottom-box">
            <a
              href="https://www.expeditesocial.com/privacy_policy"
              target="_blank"
              >Privacy Policy</a
            >
            |
            <a
              href="https://www.expeditesocial.com/terms_of_service"
              target="_blank"
              >Terms of Service</a
            >
          </div>
        </div>
      </div>
    </body>
  </html>
  `;
  return html;
};

const sendEmail = async (
  recipientEmail: string,
  name: string,
  subject: string,
  message: string,
  showImage = true
) => {
  try {
    // const getHtml = emailTemplate(name, message, subject, showImage);

    const info = await mailTransporter.sendMail({
      from: "Krushang <temp@krushang.dev>",
      to: recipientEmail,
      subject,
      text: message,
    });
    return info.messageId;
  } catch (e) {
    console.log(e);
  }
};

export default sendEmail;
