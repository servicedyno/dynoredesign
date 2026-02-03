import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import { Express } from "express";
import { log } from "../utils/loggers";

// Import path definitions
import { userPaths } from "./paths/user";
import { paymentPaths } from "./paths/payment";
import { walletPaths } from "./paths/wallet";
import { adminPaths } from "./paths/admin";
import { subscriptionPaths } from "./paths/subscription";
import { apiKeyPaths } from "./paths/apiKeys";
import { notificationPaths } from "./paths/notification";
import { referralPaths } from "./paths/referral";
import { knowledgeBasePaths } from "./paths/knowledgeBase";
import { apiUsagePaths } from "./paths/apiUsage";
import { companyPaths } from "./paths/company";
import { taxPaths } from "./paths/tax";
import { kycPaths } from "./paths/kyc";
import { directApiPaths } from "./paths/directApi";

// Merge all paths
const allPaths = {
  ...userPaths,
  ...paymentPaths,
  ...walletPaths,
  ...adminPaths,
  ...subscriptionPaths,
  ...apiKeyPaths,
  ...notificationPaths,
  ...referralPaths,
  ...knowledgeBasePaths,
  ...apiUsagePaths,
  ...companyPaths,
  ...taxPaths,
  ...kycPaths,
  ...directApiPaths,
};

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "DynoPay API Documentation",
      version: "1.0.0",
      description: `# DynoPay - Crypto Payment Gateway API

Accept cryptocurrency payments with ease using DynoPay's comprehensive API.

---

## 🔐 Authentication Guide

DynoPay uses **two types of authentication** depending on your use case:

### 1. JWT Token (Bearer Authentication)
**Use for:** Dashboard operations, managing your account, companies, payment links, wallets

| Operation | Auth Required |
|-----------|---------------|
| Create/Update Company | ✅ JWT Token |
| Create Payment Link | ✅ JWT Token |
| Manage Wallets | ✅ JWT Token |
| View Dashboard | ✅ JWT Token |
| Manage Profile | ✅ JWT Token |

**How to get JWT Token:**
\`\`\`
POST /api/user/login
{
  "email": "your@email.com",
  "password": "yourpassword"
}
\`\`\`
Response contains \`accessToken\` - use this in the \`Authorization: Bearer <token>\` header.

### 2. API Key (x-api-key Header)
**Use for:** Server-to-server integration, programmatic payment creation

| Operation | Auth Required |
|-----------|---------------|
| Create Customer | ✅ API Key |
| Direct Crypto Payment | ✅ API Key + Customer Token |

**How to get API Key:**
1. Login to dashboard
2. Go to API Keys section
3. Create new API key via \`POST /api/userApi/addApi\`

---

## 🚀 Quick Start

**For Dashboard Users (JWT Auth):**
1. Login: \`POST /api/user/login\` → Get JWT token
2. Create Company: \`POST /api/company/addCompany\` (if needed)
3. Create Payment Link: \`POST /api/pay/createPaymentLink\`
4. Share the payment link with your customers

**For Developers (API Key Auth):**
1. Get API Key from dashboard or \`POST /api/userApi/addApi\`
2. Create Customer: \`POST /api/user/createUser\` (with x-api-key)
3. Generate Payment: \`POST /api/user/cryptoPayment\` (with x-api-key + customer token)
4. Receive webhook when payment completes

---`,
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
          description: "JWT Token - Get from POST /api/user/login. Use for: Dashboard operations, company management, payment links, wallets.",
        },
        ApiKeyAuth: {
          type: "apiKey",
          in: "header",
          name: "x-api-key",
          description: "API Key - Get from dashboard or POST /api/userApi/addApi. Use for: Server-to-server integration, programmatic payments.",
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
        // Status Page Schemas
        ServiceStatus: {
          type: "object",
          properties: {
            id: { type: "string", example: "api_gateway" },
            name: { type: "string", example: "API Gateway" },
            status: { type: "string", enum: ["operational", "degraded", "outage"] },
            uptime: { type: "string", example: "99.99" },
            latency: { type: "integer", example: 45 },
            last_check: { type: "string", format: "date-time" },
          },
        },
        ServiceDetailedStatus: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            status: { type: "string", enum: ["operational", "degraded", "outage", "unknown"] },
            uptime: { type: "string", example: "99.99%" },
            uptime_value: { type: "number", example: 99.99 },
            latency_ms: { type: "integer" },
            total_checks: { type: "integer" },
            failed_checks: { type: "integer" },
            last_check: { type: "string", format: "date-time" },
          },
        },
        ServiceHealthResult: {
          type: "object",
          properties: {
            service_id: { type: "string" },
            service_name: { type: "string" },
            status: { type: "string", enum: ["operational", "degraded", "outage"] },
            latency_ms: { type: "integer" },
            last_check: { type: "string", format: "date-time" },
          },
        },
        ServiceUptimeHistory: {
          type: "object",
          properties: {
            service_id: { type: "string" },
            service_name: { type: "string" },
            period_days: { type: "integer" },
            uptime_percentage: { type: "string" },
            total_checks: { type: "integer" },
            summary: {
              type: "object",
              properties: {
                operational_days: { type: "integer" },
                degraded_days: { type: "integer" },
                outage_days: { type: "integer" },
                no_data_days: { type: "integer" },
              },
            },
            daily_status: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  date: { type: "string", format: "date" },
                  status: { type: "string", enum: ["operational", "degraded", "outage", "no_data"] },
                  checks: { type: "integer" },
                  avg_latency: { type: "integer" },
                },
              },
            },
          },
        },
        Incident: {
          type: "object",
          properties: {
            id: { type: "integer" },
            title: { type: "string" },
            description: { type: "string" },
            status: { type: "string", enum: ["resolved", "investigating", "identified", "monitoring"] },
            date: { type: "string", format: "date" },
            formatted_date: { type: "string" },
            services_affected: { type: "array", items: { type: "string" } },
          },
        },
        // Invoice Schemas
        Invoice: {
          type: "object",
          properties: {
            invoice_id: { type: "string" },
            invoice_number: { type: "string", example: "INV-2026-0001" },
            transaction_id: { type: "string" },
            company_id: { type: "integer" },
            customer_email: { type: "string" },
            customer_name: { type: "string" },
            subtotal: { type: "number" },
            fee_amount: { type: "number" },
            fee_percentage: { type: "number" },
            vat_rate: { type: "number" },
            vat_amount: { type: "number" },
            total_amount: { type: "number" },
            currency: { type: "string" },
            status: { type: "string", enum: ["draft", "sent", "paid", "cancelled"] },
            created_at: { type: "string", format: "date-time" },
          },
        },
        // Transaction Schema
        Transaction: {
          type: "object",
          properties: {
            id: { type: "string" },
            transaction_reference: { type: "string" },
            base_amount: { type: "number" },
            base_currency: { type: "string" },
            crypto_amount: { type: "number" },
            crypto_currency: { type: "string" },
            status: { type: "string", enum: ["pending", "done", "failed", "expired"] },
            payment_mode: { type: "string" },
            customer_email: { type: "string" },
            created_at: { type: "string", format: "date-time" },
          },
        },
        // Payment Link Schema
        PaymentLink: {
          type: "object",
          properties: {
            link_id: { type: "integer" },
            payment_link: { type: "string", format: "uri" },
            email: { type: "string" },
            base_amount: { type: "number" },
            base_currency: { type: "string" },
            description: { type: "string" },
            status: { type: "string", enum: ["pending", "paid", "expired"] },
            fee_payer: { type: "string", enum: ["customer", "company"] },
            expires_at: { type: "string", format: "date-time" },
            created_at: { type: "string", format: "date-time" },
          },
        },
        // KYC Schema
        KYCStatus: {
          type: "object",
          properties: {
            kyc_id: { type: "integer" },
            status: { type: "string", enum: ["not_started", "pending", "approved", "rejected"] },
            document_type: { type: "string" },
            submitted_at: { type: "string", format: "date-time" },
            reviewed_at: { type: "string", format: "date-time" },
            rejection_reason: { type: "string" },
          },
        },
        // Pagination Schema
        Pagination: {
          type: "object",
          properties: {
            total: { type: "integer" },
            page: { type: "integer" },
            limit: { type: "integer" },
            totalPages: { type: "integer" },
          },
        },
        // Subscription Schema
        Subscription: {
          type: "object",
          properties: {
            subscription_id: { type: "integer" },
            customer_email: { type: "string" },
            customer_name: { type: "string" },
            amount: { type: "number" },
            currency: { type: "string" },
            interval: { type: "string", enum: ["daily", "weekly", "monthly", "yearly"] },
            status: { type: "string", enum: ["active", "paused", "cancelled", "expired"] },
            description: { type: "string" },
            start_date: { type: "string", format: "date" },
            end_date: { type: "string", format: "date" },
            next_billing_date: { type: "string", format: "date" },
            created_at: { type: "string", format: "date-time" },
          },
        },
        // API Plan Schema
        ApiPlan: {
          type: "object",
          properties: {
            plan_id: { type: "integer" },
            plan_name: { type: "string" },
            description: { type: "string" },
            rate_limit: { type: "integer" },
            price: { type: "number" },
            currency: { type: "string" },
            features: { type: "array", items: { type: "string" } },
            is_active: { type: "boolean" },
            created_at: { type: "string", format: "date-time" },
          },
        },
        // Referral Schemas
        Referral: {
          type: "object",
          properties: {
            referral_id: { type: "integer" },
            referrer_user_id: { type: "integer" },
            referred_user_id: { type: "integer" },
            referral_code: { type: "string", example: "DYNO2025USR8A2B3C4D5" },
            status: { type: "string", enum: ["pending", "active", "rewarded", "expired"] },
            bonus_amount: { type: "number", example: 10.00 },
            bonus_currency: { type: "string", example: "USD" },
            referee_discount_percent: { type: "number", example: 50.00 },
            referee_discount_duration_days: { type: "integer", example: 30 },
            referred_at: { type: "string", format: "date-time" },
            activated_at: { type: "string", format: "date-time" },
            rewarded_at: { type: "string", format: "date-time" },
            expires_at: { type: "string", format: "date-time" },
            referred_user: {
              type: "object",
              properties: {
                user_id: { type: "integer" },
                name: { type: "string" },
                email: { type: "string", format: "email" },
                createdAt: { type: "string", format: "date-time" },
              },
            },
          },
        },
        ReferralReward: {
          type: "object",
          properties: {
            reward_id: { type: "integer" },
            referral_id: { type: "integer" },
            user_id: { type: "integer" },
            reward_type: { type: "string", example: "bonus_credit" },
            amount: { type: "number", example: 10.00 },
            currency: { type: "string", example: "USD" },
            status: { type: "string", enum: ["pending", "credited", "withdrawn"] },
            credited_at: { type: "string", format: "date-time" },
            created_at: { type: "string", format: "date-time" },
          },
        },
        // Knowledge Base Schemas
        KBCategory: {
          type: "object",
          properties: {
            category_id: { type: "integer" },
            category_name: { type: "string", example: "Getting Started" },
            category_slug: { type: "string", example: "getting-started" },
            category_icon: { type: "string", example: "rocket" },
            description: { type: "string" },
            article_count: { type: "integer" },
            display_order: { type: "integer" },
            is_active: { type: "boolean" },
          },
        },
        KBArticle: {
          type: "object",
          properties: {
            article_id: { type: "integer" },
            category_id: { type: "integer" },
            title: { type: "string", example: "How to Accept Crypto Payments" },
            slug: { type: "string", example: "how-to-accept-crypto-payments" },
            excerpt: { type: "string" },
            content: { type: "string" },
            content_html: { type: "string" },
            author_id: { type: "integer" },
            featured_image_url: { type: "string", format: "uri" },
            meta_title: { type: "string" },
            meta_description: { type: "string" },
            meta_keywords: { type: "string" },
            is_published: { type: "boolean" },
            views_count: { type: "integer" },
            helpful_count: { type: "integer" },
            not_helpful_count: { type: "integer" },
            reading_time_minutes: { type: "integer", example: 5 },
            published_at: { type: "string", format: "date-time" },
            created_at: { type: "string", format: "date-time" },
            updated_at: { type: "string", format: "date-time" },
            category: { $ref: "#/components/schemas/KBCategory" },
            author: {
              type: "object",
              properties: {
                name: { type: "string" },
                email: { type: "string" },
              },
            },
          },
        },
      },
    },
    paths: allPaths,
    tags: [
      { name: "Authentication", description: "User authentication endpoints" },
      { name: "User Management", description: "User profile and account management" },
      { name: "Email Unsubscribe", description: "Email unsubscribe endpoints (no auth required)" },
      { name: "Admin", description: "Platform administration endpoints" },
      { name: "Company", description: "Company profile management" },
      { name: "Wallet Address Management", description: "CRUD operations for merchant wallet addresses. Create, Update, and Delete require OTP verification." },
      { name: "API Keys", description: "API key management, usage statistics, and rate limits" },
      { 
        name: "Direct API - Merchant Integration", 
        description: `Programmatic API for server-to-server integration. Use these endpoints to create customers, generate payment addresses, and receive webhook notifications.

**Authentication:**
- \`x-api-key\` header: Your merchant API key (from /api/userApi/addApi)
- \`Authorization\` header: Bearer token for customer (from /api/user/createUser)

**Typical Flow:**
1. Create API key via dashboard or /api/userApi/addApi
2. Create customer: POST /api/user/createUser (with x-api-key)
3. Generate payment: POST /api/user/cryptoPayment (with x-api-key + customer token)
4. Receive webhook when payment completes

**URL Configuration (Priority Order):**
1. Per-payment URLs (callback_url, webhook_url in payment request)
2. API key's configured webhook_url
3. Company's default webhook settings` 
      },
      { name: "Dashboard", description: "Dashboard statistics and charts" },
      { name: "Tax", description: "Tax rates and validation" },
      { name: "Notifications", description: "Notification management" },
      { name: "Payments", description: "Payment links and processing" },
      { name: "Payment Processing", description: "Payment flow and verification" },
      { name: "Transactions", description: "Transaction management and export" },
      { name: "Invoices", description: "Invoice generation and PDF download" },
      { name: "Subscriptions", description: "Recurring payment subscriptions" },
      { name: "KYC Verification", description: "Know Your Customer identity verification with Veriff" },
      { name: "Status", description: "System status and infrastructure monitoring" },
      { name: "Referral - User Code", description: "User referral codes for organic growth (DYNO format)" },
      { name: "Referral - Referee Code", description: "Referee codes from payment link emails (REF format)" },
      { name: "Referral - Fee Discount", description: "Fee discount status from referral program" },
      { name: "Knowledge Base", description: "Help articles, categories, and search" },
      { 
        name: "Webhooks", 
        description: `Webhook integration for payment notifications.

**Merchant Webhooks**: Configure your webhook_url when creating payment links to receive payment status updates.

**Multi-Tenant Routing**: DynoPay uses a multi-tenant architecture where tenant info (company_id, user_id, address_id) is encoded in webhook URLs. This enables:
- Multi-tenant payment routing without per-company backends
- Synchronous URL updates when addresses are reserved
- Automatic tenant identification from URL query parameters` 
      },
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
    swaggerOptions: {
      persistAuthorization: true, // Keep authorization token on page refresh
    },
  }) as any);

  // Serve raw OpenAPI spec
  app.get("/api/docs.json", (req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.send(swaggerSpec);
  });

  log("Swagger documentation available at /api/docs", "info");
};

export default swaggerSpec;
