import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import { Express } from "express";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "DynoPay API Documentation",
      version: "1.0.0",
      description: "Crypto Payment Gateway API - Accept cryptocurrency payments with ease",
      contact: {
        name: "DynoPay Support",
        url: "https://dynopay.com/support",
        email: "support@dynopay.com",
      },
      license: {
        name: "Private",
        url: "https://dynopay.com/terms",
      },
    },
    servers: [
      {
        url: process.env.SERVER_URL || "http://localhost:8001",
        description: "API Server",
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Enter your JWT token",
        },
        ApiKeyAuth: {
          type: "apiKey",
          in: "header",
          name: "x-api-key",
          description: "Enter your API key",
        },
      },
      schemas: {
        // User Schemas
        User: {
          type: "object",
          properties: {
            user_id: { type: "integer" },
            name: { type: "string" },
            email: { type: "string", format: "email" },
            mobile: { type: "string" },
            photo: { type: "string" },
            login_type: { type: "string", enum: ["EMAIL", "GOOGLE", "TELEGRAM"] },
            status: { type: "string" },
          },
        },
        LoginRequest: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: { type: "string", format: "email" },
            password: { type: "string", minLength: 6 },
          },
        },
        LoginResponse: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            message: { type: "string" },
            data: {
              type: "object",
              properties: {
                token: { type: "string" },
                user: { $ref: "#/components/schemas/User" },
              },
            },
          },
        },
        // Company Schemas
        Company: {
          type: "object",
          properties: {
            company_id: { type: "integer" },
            company_name: { type: "string" },
            email: { type: "string" },
            website: { type: "string" },
            address_line1: { type: "string" },
            address_line2: { type: "string" },
            city: { type: "string" },
            state: { type: "string" },
            country: { type: "string" },
            zip_code: { type: "string" },
            vat_number: { type: "string" },
            vat_type: { type: "string" },
            vat_verified: { type: "boolean" },
          },
        },
        // Wallet Schemas
        WalletAddress: {
          type: "object",
          properties: {
            id: { type: "integer" },
            wallet_address: { type: "string" },
            currency: { type: "string" },
            label: { type: "string" },
            wallet_name: { type: "string" },
            company_id: { type: "integer" },
            user_id: { type: "integer" },
          },
        },
        AddWalletAddressRequest: {
          type: "object",
          required: ["wallet_address", "currency"],
          properties: {
            wallet_address: { type: "string" },
            currency: { type: "string", enum: ["BTC", "ETH", "LTC", "TRX", "USDT-TRC20", "USDT-ERC20", "DOGE", "BCH"] },
            label: { type: "string" },
            wallet_name: { type: "string" },
            company_id: { type: "integer" },
          },
        },
        // API Key Schemas
        ApiKey: {
          type: "object",
          properties: {
            api_id: { type: "integer" },
            api_name: { type: "string" },
            apiKey: { type: "string" },
            base_currency: { type: "string" },
            company_id: { type: "integer" },
            company_name: { type: "string" },
          },
        },
        CreateApiKeyRequest: {
          type: "object",
          required: ["company_id", "base_currency"],
          properties: {
            company_id: { type: "integer" },
            base_currency: { type: "string", enum: ["USD", "EUR", "NGN"] },
            api_name: { type: "string" },
            withdrawal_whitelist: { type: "array", items: { type: "string" } },
          },
        },
        // Dashboard Schemas
        DashboardStats: {
          type: "object",
          properties: {
            total_transactions: {
              type: "object",
              properties: {
                count: { type: "integer" },
                current_month: { type: "integer" },
                change_percent: { type: "number" },
              },
            },
            total_volume: {
              type: "object",
              properties: {
                amount: { type: "number" },
                currency: { type: "string" },
                change_percent: { type: "number" },
              },
            },
            active_wallets: {
              type: "object",
              properties: {
                count: { type: "integer" },
                wallets: { type: "array", items: { type: "string" } },
              },
            },
            fee_tier: {
              type: "object",
              properties: {
                current_tier: { type: "string" },
                monthly_volume: { type: "number" },
                tier_threshold: { type: "number" },
                percent_complete: { type: "number" },
              },
            },
          },
        },
        // Tax Schemas
        TaxRate: {
          type: "object",
          properties: {
            country_code: { type: "string" },
            country_name: { type: "string" },
            tax_acronym: { type: "string" },
            standard_rate: { type: "number" },
            cached: { type: "boolean" },
          },
        },
        // Notification Schemas
        Notification: {
          type: "object",
          properties: {
            notification_id: { type: "integer" },
            type: { type: "string" },
            title: { type: "string" },
            message: { type: "string" },
            is_read: { type: "boolean" },
            created_at: { type: "string", format: "date-time" },
          },
        },
        NotificationPreferences: {
          type: "object",
          properties: {
            transaction_updates: { type: "boolean" },
            payment_received: { type: "boolean" },
            weekly_summary: { type: "boolean" },
            security_alerts: { type: "boolean" },
            email_notifications: { type: "boolean" },
            sms_notifications: { type: "boolean" },
            browser_notifications: { type: "boolean" },
          },
        },
        // Error Response
        ErrorResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", default: false },
            message: { type: "string" },
            statusCode: { type: "integer" },
          },
        },
        // Success Response
        SuccessResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", default: true },
            message: { type: "string" },
            data: { type: "object" },
          },
        },
      },
    },
    tags: [
      { name: "Authentication", description: "User authentication endpoints" },
      { name: "User", description: "User management endpoints" },
      { name: "Company", description: "Company profile management" },
      { name: "Wallet", description: "Wallet and address management" },
      { name: "API Keys", description: "API key management" },
      { name: "Dashboard", description: "Dashboard statistics and charts" },
      { name: "Tax", description: "Tax rates and validation" },
      { name: "Notifications", description: "Notification management" },
      { name: "Payments", description: "Payment links and processing" },
      { name: "Transactions", description: "Transaction management and export" },
      { name: "Invoices", description: "Invoice generation and PDF download" },
      { name: "KYC", description: "Know Your Customer verification" },
      { name: "Status", description: "System status and infrastructure monitoring" },
    ],
  },
  apis: ["./swagger/paths/*.ts", "./routes/*.ts"],
};

const swaggerSpec = swaggerJsdoc(options);

export const setupSwagger = (app: Express) => {
  // Serve Swagger UI
  app.use("/api/docs", swaggerUi.serve as any, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: "DynoPay API Documentation",
  }) as any);

  // Serve raw OpenAPI spec
  app.get("/api/docs.json", (req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.send(swaggerSpec);
  });

  console.log("Swagger documentation available at /api/docs");
};

export default swaggerSpec;
