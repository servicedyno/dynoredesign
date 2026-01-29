import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import { Express } from "express";

// Import path definitions
import { customerPaths } from "./paths/customer";
import { paymentPaths } from "./paths/payment";
import { transactionPaths } from "./paths/transaction";

// Merge all paths
const allPaths = {
  ...customerPaths,
  ...paymentPaths,
  ...transactionPaths,
};

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "DynoPay Merchant API",
      version: "1.0.0",
      description: `
## 🚀 Quick Start

**Step 1:** Get your API key from [DynoPay Dashboard](https://dynopay.com/dashboard)

**Step 2:** Create a customer → Get customer token

**Step 3:** Create payment → Get crypto address → Customer pays

---

## 🔐 Authentication

| Header | Value | Required |
|--------|-------|----------|
| \`x-api-key\` | Your API key | ✅ Always |
| \`Authorization\` | \`Bearer {customer_token}\` | ✅ For payments |

---

## 📋 Common Flows

### Accept One-Time Payment
\`\`\`
1. POST /user/createUser     → Get customer token
2. POST /user/cryptoPayment  → Get crypto address
3. Customer sends crypto     → Payment confirmed
\`\`\`

### Redirect to Checkout
\`\`\`
1. POST /user/createUser     → Get customer token  
2. POST /user/createPayment  → Get checkout URL
3. Redirect customer         → Payment on hosted page
\`\`\`
      `,
      contact: {
        name: "DynoPay Support",
        email: "support@dynopay.com",
      },
    },
    servers: [
      {
        url: process.env.SERVER_URL ? process.env.SERVER_URL.replace(':8001', ':3301').replace('/api', '') + '/api' : "http://localhost:3301/api",
        description: "API Server",
      },
    ],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: "apiKey",
          in: "header",
          name: "x-api-key",
          description: "Your merchant API key",
        },
        CustomerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Customer token from /user/createUser",
        },
      },
      schemas: {
        // Simple Error
        Error: {
          type: "object",
          properties: {
            success: { type: "boolean", example: false },
            message: { type: "string" },
            statusCode: { type: "integer" },
          },
        },
      },
    },
    tags: [
      {
        name: "1. Customer",
        description: "Create and manage customers",
      },
      {
        name: "2. Payments",
        description: "Create crypto payments",
      },
      {
        name: "3. Status",
        description: "Check payment and balance status",
      },
    ],
    paths: allPaths,
  },
  apis: [],
};

const swaggerSpec = swaggerJsdoc(options);

// Custom CSS for cleaner UI
const customCss = `
  .swagger-ui .topbar { display: none }
  .swagger-ui .info { margin: 20px 0 }
  .swagger-ui .info .title { font-size: 2em }
  .swagger-ui .info .description { font-size: 14px }
  .swagger-ui .info .description p { margin: 8px 0 }
  .swagger-ui .info .description table { margin: 15px 0; font-size: 13px }
  .swagger-ui .info .description code { 
    background: #f4f4f4; 
    padding: 2px 6px; 
    border-radius: 3px;
    font-size: 12px;
  }
  .swagger-ui .info .description pre {
    background: #2d2d2d;
    color: #f8f8f2;
    padding: 15px;
    border-radius: 5px;
    font-size: 12px;
  }
  .swagger-ui .opblock-tag { font-size: 1.1em }
  .swagger-ui .opblock-summary-description { font-size: 13px }
  .swagger-ui .opblock .opblock-summary-operation-id { font-size: 12px }
  .swagger-ui table tbody tr td { padding: 8px 10px; font-size: 13px }
  .swagger-ui .response-col_description { font-size: 13px }
  .swagger-ui .parameters-col_description { font-size: 13px }
`;

export const setupMerchantSwagger = (app: Express) => {
  app.use("/docs", swaggerUi.serve);
  app.get("/docs", swaggerUi.setup(swaggerSpec, {
    customCss,
    customSiteTitle: "DynoPay Merchant API",
    customfavIcon: "https://dynopay.com/favicon.ico",
    swaggerOptions: {
      docExpansion: 'list',
      filter: true,
      showRequestDuration: true,
      persistAuthorization: true,
    },
  }));

  // Serve OpenAPI spec as JSON
  app.get("/docs.json", (req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.send(swaggerSpec);
  });

  console.log("📚 Merchant API docs available at /docs");
};

export default setupMerchantSwagger;
