import axios from "axios";
import * as fs from "fs";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: "/app/backend/.env" });

const sendDesignEmail = async () => {
  // Read the design document
  const designContent = fs.readFileSync("/app/UI_UX_DESIGN_REQUEST.md", "utf-8");

  // Convert markdown to HTML-friendly format (basic conversion)
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      line-height: 1.6;
      color: #333;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
    }
    h1 { color: #1034a6; border-bottom: 2px solid #1034a6; padding-bottom: 10px; }
    h2 { color: #1034a6; margin-top: 30px; }
    h3 { color: #333; margin-top: 20px; }
    pre {
      background: #f5f5f5;
      padding: 15px;
      border-radius: 5px;
      overflow-x: auto;
      font-family: 'Courier New', monospace;
      font-size: 12px;
      line-height: 1.4;
    }
    code {
      background: #f0f0f0;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: 'Courier New', monospace;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 15px 0;
    }
    th, td {
      border: 1px solid #ddd;
      padding: 10px;
      text-align: left;
    }
    th { background: #1034a6; color: white; }
    tr:nth-child(even) { background: #f9f9f9; }
    blockquote {
      border-left: 4px solid #1034a6;
      margin: 15px 0;
      padding: 10px 20px;
      background: #f8f9ff;
    }
    hr { border: none; border-top: 1px solid #ddd; margin: 30px 0; }
    ul, ol { padding-left: 25px; }
    li { margin: 5px 0; }
  </style>
</head>
<body>
  <div style="background: linear-gradient(135deg, #1034a6 0%, #0d2570 100%); padding: 20px; text-align: center; margin-bottom: 30px;">
    <span style="font-size: 28px; font-weight: 700; color: #ffffff;">Dyno<span style="color: #f47323;">Pay</span></span>
  </div>
  
  <h1>🎨 Design Request for UI/UX Team</h1>
  
  <p>Hi Design Team,</p>
  
  <p>Please find attached/below the complete design specifications for the new screens and features we need designed for DynoPay.</p>
  
  <p>This document includes:</p>
  <ul>
    <li><strong>Company Settings Page</strong> - Webhook notifications + Payment tolerance settings</li>
    <li><strong>Create Payment Link</strong> - Cryptocurrency selector + Tax toggle</li>
    <li><strong>Edit Payment Link</strong> - New screen for editing existing links</li>
    <li><strong>Payment Links List</strong> - Add Edit button with status-based visibility</li>
    <li><strong>Checkout Page</strong> - Tax breakdown display for customers</li>
  </ul>
  
  <p><strong>Key Note:</strong> Tax is automatically calculated based on the <em>customer's location</em> at checkout, not the merchant's location. Merchants only toggle tax ON or OFF.</p>
  
  <hr>
  
  <h2>📎 Full Design Document</h2>
  
  <pre style="white-space: pre-wrap; word-wrap: break-word;">${designContent.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
  
  <hr>
  
  <p>Please let us know if you have any questions or need clarification on any of the requirements.</p>
  
  <p>Best regards,<br>
  <strong>Development Team</strong></p>
  
  <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666;">
    <p>DynoPay - Crypto Payment Gateway<br>
    This is an automated message from the development team.</p>
  </div>
</body>
</html>
  `;

  const payload = {
    sender: {
      name: "DynoPay Development",
      email: "notify@dynocash.com",
    },
    subject: "🎨 UI/UX Design Request - New Screens & Features for DynoPay",
    to: [
      {
        email: "design@dyno.pt",
        name: "DynoPay Design Team",
      },
    ],
    htmlContent: htmlContent,
  };

  try {
    const { data } = await axios.post(
      "https://api.brevo.com/v3/smtp/email",
      payload,
      {
        headers: {
          "api-key": process.env.BREVO_API_KEY,
          "Content-Type": "application/json",
        },
      }
    );
    console.log("✅ Email sent successfully to design@dyno.pt");
    console.log("Response:", JSON.stringify(data, null, 2));
    return data;
  } catch (error: any) {
    console.error("❌ Failed to send email:", error.response?.data || error.message);
    throw error;
  }
};

// Run the function
sendDesignEmail();
