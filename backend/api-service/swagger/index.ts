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
      title: "DynoPay Merchant API Documentation",
      version: "1.0.0",
      description: `
## Merchant Integration API

This API allows merchants to integrate DynoPay payment processing into their custom applications.

### Authentication

All endpoints require two authentication headers:

1. **x-api-key**: Your merchant API key (obtained from DynoPay Dashboard)
2. **Authorization**: Bearer token for the customer making the payment

### Flow Overview

1. **Create Customer** - Register end-users with your merchant account
2. **Create Payment** - Generate payment links or direct crypto payments
3. **Check Status** - Monitor transaction status and balances

### Key Differences from Dashboard API

| Feature | Dashboard API | Merchant API |
|---------|--------------|---------------|
| Port | 8001 | 3301 |
| Auth | JWT (user login) | API Key + Customer Token |
| Customers | Not tracked | Tracked with wallets |
| Use Case | Dashboard UI | Custom integrations |
      `,
      contact: {
        name: "DynoPay Support",
        url: "https://dynopay.com/support",
        email: "support@dynopay.com",
      },
    },
    servers: [
      {
        url: process.env.SERVER_URL ? process.env.SERVER_URL.replace(':8001', ':3301').replace('/api', '') + '/api' : "http://localhost:3301/api",
        description: "Merchant API Server",
      },
    ],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: "apiKey",
          in: "header",
          name: "x-api-key",
          description: "Your merchant API key from DynoPay Dashboard",
        },
        CustomerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Customer JWT token (obtained from /user/createUser)",
        },
      },
      schemas: {
        // Customer Schemas
        Customer: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid", description: "Unique customer UUID" },
            customer_id: { type: "integer", description: "Internal customer ID" },
            company_id: { type: "integer", description: "Associated company ID" },
            customer_name: { type: "string" },
            email: { type: "string", format: "email" },
            mobile: { type: "string" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        CreateCustomerRequest: {
          type: "object",
          required: ["name", "email"],
          properties: {
            name: { type: "string", description: "Customer's full name", example: "John Doe" },
            email: { type: "string", format: "email", description: "Customer's email address", example: "john@example.com" },
            mobile: { type: "string", description: "Customer's phone number", example: "+1234567890" },
          },
        },
        CreateCustomerResponse: {
          type: "object",
          properties: {
            message: { type: "string", example: "Registered Successful!" },
            data: {
              type: "object",
              properties: {
                token: { type: "string", description: "Customer JWT token for subsequent requests" },
                customer_id: { type: "string", format: "uuid", description: "Customer's unique ID" },
              },
            },
          },
        },
        // Payment Schemas
        CreatePaymentRequest: {
          type: "object",
          required: ["amount"],
          properties: {
            amount: { type: "number", description: "Payment amount in base currency", example: 100 },
            redirect_uri: { type: "string", format: "uri", description: "URL to redirect after payment", example: "https://yoursite.com/success" },
            meta_data: {
              type: "object",
              properties: {
                product_name: { type: "string", description: "Product/service name", example: "Premium Subscription" },
                order_id: { type: "string", description: "Your internal order ID", example: "ORD-12345" },
              },
            },
            fee_payer: { type: "string", enum: ["customer", "company"], default: "company", description: "Who pays blockchain fees" },
          },
        },
        CreatePaymentResponse: {
          type: "object",
          properties: {
            message: { type: "string", example: "Link Generated!" },
            data: {
              type: "object",
              properties: {
                redirect_url: { type: "string", format: "uri", description: "Checkout page URL" },
                fee_payer: { type: "string" },
                available_currencies: { type: "array", items: { type: "string" }, description: "Available crypto currencies" },
              },
            },
          },
        },
        CryptoPaymentRequest: {
          type: "object",
          required: ["amount", "currency"],
          properties: {
            amount: { type: "number", description: "Payment amount in base currency", example: 10 },
            currency: { type: "string", enum: ["BTC", "ETH", "LTC", "DOGE", "TRX", "BCH", "USDT-TRC20", "USDT-ERC20"], description: "Cryptocurrency to pay with", example: "ETH" },
            redirect_uri: { type: "string", format: "uri", description: "URL to redirect after payment" },
            meta_data: {
              type: "object",
              required: ["product_name"],
              properties: {
                product_name: { type: "string", description: "Product/service name (required)", example: "Digital Product" },
                order_id: { type: "string", description: "Your internal order ID" },
              },
            },
            fee_payer: { type: "string", enum: ["customer", "company"], default: "company" },
            topUp: { type: "boolean", default: false, description: "Whether this is a wallet top-up" },
          },
        },
        CryptoPaymentResponse: {
          type: "object",
          properties: {
            message: { type: "string", example: "Payment Created!" },
            data: {
              type: "object",
              properties: {
                transaction_id: { type: "string", format: "uuid", description: "Unique transaction ID" },
                qr_code: { type: "string", description: "Base64 encoded QR code image" },
                address: { type: "string", description: "Crypto wallet address to send payment" },
                crypto_amount: { type: "number", description: "Amount in cryptocurrency" },
              },
            },
          },
        },
        // Balance & Transaction Schemas
        BalanceResponse: {
          type: "object",
          properties: {
            message: { type: "string", example: "Balance Fetched Successfully!" },
            data: {
              type: "object",
              properties: {
                amount: { type: "string", description: "Current balance", example: "150.00" },
                currency: { type: "string", description: "Currency code", example: "USD" },
              },
            },
          },
        },
        Transaction: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            payment_mode: { type: "string", enum: ["CRYPTO", "CARD", "WALLET"] },
            base_amount: { type: "number" },
            base_currency: { type: "string" },
            paid_amount: { type: "number" },
            paid_currency: { type: "string" },
            transaction_reference: { type: "string" },
            transaction_details: { type: "string" },
            transaction_type: { type: "string", enum: ["CREDIT", "DEBIT", "PAYMENT"] },
            status: { type: "string", enum: ["pending", "successful", "failed"] },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        SupportedCurrenciesResponse: {
          type: "object",
          properties: {
            message: { type: "string" },
            data: {
              type: "array",
              items: { type: "string" },
              example: ["BTC", "ETH", "LTC", "DOGE", "TRX", "BCH", "USDT-TRC20", "USDT-ERC20"],
            },
          },
        },
        // Error Schemas
        ErrorResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: false },
            message: { type: "string" },
            statusCode: { type: "integer" },
          },
        },
        ValidationError: {
          type: "object",
          properties: {
            message: { type: "string", example: "Please enter proper values!" },
            errors: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  key: { type: "string" },
                  error: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
    tags: [
      {
        name: "Customer",
        description: "Customer registration and management",
      },
      {
        name: "Payment",
        description: "Payment creation and processing",
      },
      {
        name: "Transaction",
        description: "Transaction history and status",
      },
      {
        name: "Wallet",
        description: "Customer wallet operations",
      },
    ],
    paths: allPaths,
  },
  apis: [],
};

const swaggerSpec = swaggerJsdoc(options);

export const setupMerchantSwagger = (app: Express) => {
  app.use(
    "/docs",
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      customCss: '.swagger-ui .topbar { display: none }',
      customSiteTitle: "DynoPay Merchant API Docs",
    })
  );

  // Serve OpenAPI spec as JSON
  app.get("/docs.json", (req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.send(swaggerSpec);
  });

  console.log("Merchant API Swagger documentation available at /docs");
};

export default setupMerchantSwagger;
