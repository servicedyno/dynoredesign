import React, { useState, useCallback, useMemo } from "react";
import { Box, Typography, useTheme, useMediaQuery } from "@mui/material";
import Head from "next/head";

// ─── Types ────────────────────────────────────────────────────
interface Endpoint {
  id: string;
  method: "GET" | "POST";
  path: string;
  title: string;
  description: string;
  auth: "api-key" | "api-key-bearer";
  headers: { name: string; value: string; description: string }[];
  body?: { name: string; type: string; required: boolean; description: string }[];
  queryParams?: { name: string; type: string; required: boolean; description: string }[];
  pathParams?: { name: string; type: string; description: string }[];
  responseExample: string;
  requestExample?: string;
}

interface Section {
  id: string;
  title: string;
  endpoints?: string[];
}

// ─── Endpoint Data ────────────────────────────────────────────
const BASE_URL = "/api/user";

const ENDPOINTS: Endpoint[] = [
  {
    id: "create-user",
    method: "POST",
    path: "/createUser",
    title: "Create Customer",
    description:
      "Register a new customer under your company. Returns a bearer token for subsequent authenticated requests. If the customer already exists (same email + company), returns their existing token.",
    auth: "api-key",
    headers: [
      { name: "x-api-key", value: "your_api_key", description: "Your DynoPay API key" },
      { name: "Content-Type", value: "application/json", description: "" },
    ],
    body: [
      { name: "name", type: "string", required: true, description: "Customer's full name" },
      { name: "email", type: "string", required: true, description: "Customer's email address" },
      { name: "mobile", type: "string", required: false, description: "Customer's phone number" },
    ],
    requestExample: `{
  "name": "Jane Smith",
  "email": "jane@example.com",
  "mobile": "+1234567890"
}`,
    responseExample: `{
  "success": true,
  "message": "Registered Successful!",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "customer_id": "a1b2c3d4-e5f6-..."
  }
}`,
  },
  {
    id: "create-payment",
    method: "POST",
    path: "/createPayment",
    title: "Create Checkout Payment",
    description:
      "Create a hosted checkout session. Returns a redirect URL where your customer selects their crypto and completes payment. Best for web integrations — similar to Stripe Checkout.",
    auth: "api-key-bearer",
    headers: [
      { name: "x-api-key", value: "your_api_key", description: "Your DynoPay API key" },
      { name: "Authorization", value: "Bearer {customer_token}", description: "Token from Create Customer" },
      { name: "Content-Type", value: "application/json", description: "" },
    ],
    body: [
      { name: "amount", type: "number", required: true, description: "Payment amount in your base currency (min 5)" },
      { name: "redirect_uri", type: "string", required: true, description: "URL to redirect after payment completes" },
      { name: "fee_payer", type: "string", required: false, description: '"company" (default) or "customer"' },
      { name: "accepted_currencies", type: "string[]", required: false, description: "Limit accepted cryptos, e.g. [\"BTC\",\"ETH\"]" },
      { name: "webhook_url", type: "string", required: false, description: "URL to receive payment status webhooks" },
      { name: "callback_url", type: "string", required: false, description: "Callback URL for payment updates" },
      { name: "meta_data", type: "object", required: false, description: "Custom metadata (order ID, notes, etc.)" },
    ],
    requestExample: `{
  "amount": 50.00,
  "redirect_uri": "https://yoursite.com/thank-you",
  "fee_payer": "company",
  "accepted_currencies": ["BTC", "ETH", "USDT"],
  "webhook_url": "https://yoursite.com/webhooks/dynopay",
  "meta_data": { "order_id": "ORD-12345" }
}`,
    responseExample: `{
  "success": true,
  "message": "Link Generated!",
  "data": {
    "redirect_url": "${process.env.NEXT_PUBLIC_BASE_URL || ''}pay?d=abc123...",
    "fee_payer": "company",
    "available_currencies": ["BTC", "ETH", "USDT"],
    "webhook_url": "configured"
  }
}`,
  },
  {
    id: "crypto-payment",
    method: "POST",
    path: "/cryptoPayment",
    title: "Create Direct Crypto Payment",
    description:
      "Create a direct crypto payment that returns a QR code and wallet address. Use this for in-app payment flows where you handle the UI — the customer sends crypto directly to the provided address.",
    auth: "api-key-bearer",
    headers: [
      { name: "x-api-key", value: "your_api_key", description: "Your DynoPay API key" },
      { name: "Authorization", value: "Bearer {customer_token}", description: "Token from Create Customer" },
      { name: "Content-Type", value: "application/json", description: "" },
    ],
    body: [
      { name: "amount", type: "number", required: true, description: "Amount in your base fiat currency" },
      { name: "currency", type: "string", required: true, description: 'Crypto to pay with, e.g. "BTC", "ETH", "USDT"' },
      { name: "redirect_uri", type: "string", required: false, description: "Redirect URL after completion" },
      { name: "fee_payer", type: "string", required: false, description: '"company" (default) or "customer"' },
      { name: "accepted_currencies", type: "string[]", required: false, description: "Limit accepted cryptos" },
      { name: "webhook_url", type: "string", required: false, description: "Webhook URL for payment events" },
      { name: "callback_url", type: "string", required: false, description: "Callback URL for updates" },
      { name: "meta_data", type: "object", required: false, description: "Custom metadata" },
      { name: "topUp", type: "boolean", required: false, description: "Set true for wallet top-up flow" },
    ],
    requestExample: `{
  "amount": 25.00,
  "currency": "BTC",
  "redirect_uri": "https://yoursite.com/done",
  "meta_data": { "invoice_id": "INV-789" }
}`,
    responseExample: `{
  "success": true,
  "message": "Payment Created!",
  "data": {
    "transaction_id": "txn_abc123...",
    "qr_code": "data:image/png;base64,...",
    "address": "bc1q...",
    "amount": 0.00042,
    "currency": "BTC",
    "base_amount": 25.00,
    "base_currency": "USD",
    "redirect_uri": "https://yoursite.com/done"
  }
}`,
  },
  {
    id: "add-funds",
    method: "POST",
    path: "/addFunds",
    title: "Add Funds to Wallet",
    description:
      "Add funds to a customer's wallet via a hosted checkout. Returns a redirect URL for the customer to complete the deposit.",
    auth: "api-key-bearer",
    headers: [
      { name: "x-api-key", value: "your_api_key", description: "Your DynoPay API key" },
      { name: "Authorization", value: "Bearer {customer_token}", description: "Token from Create Customer" },
      { name: "Content-Type", value: "application/json", description: "" },
    ],
    body: [
      { name: "amount", type: "number", required: true, description: "Deposit amount (min 5)" },
      { name: "redirect_uri", type: "string", required: true, description: "URL to redirect after deposit" },
      { name: "fee_payer", type: "string", required: false, description: '"company" (default) or "customer"' },
    ],
    requestExample: `{
  "amount": 100.00,
  "redirect_uri": "https://yoursite.com/wallet",
  "fee_payer": "company"
}`,
    responseExample: `{
  "success": true,
  "message": "Link Generated!",
  "data": {
    "redirect_url": "${process.env.NEXT_PUBLIC_BASE_URL || ''}pay?d=xyz789...",
    "fee_payer": "company",
    "available_currencies": ["BTC", "ETH", "USDT", "LTC"]
  }
}`,
  },
  {
    id: "use-wallet",
    method: "POST",
    path: "/useWallet",
    title: "Debit from Wallet",
    description: "Debit a specified amount from a customer's wallet balance. Creates a debit transaction record.",
    auth: "api-key-bearer",
    headers: [
      { name: "x-api-key", value: "your_api_key", description: "Your DynoPay API key" },
      { name: "Authorization", value: "Bearer {customer_token}", description: "Token from Create Customer" },
      { name: "Content-Type", value: "application/json", description: "" },
    ],
    body: [
      { name: "amount", type: "number", required: true, description: "Amount to debit from wallet" },
    ],
    requestExample: `{
  "amount": 15.00
}`,
    responseExample: `{
  "success": true,
  "message": "amount debited successfully!",
  "data": {
    "new_balance": "85.00",
    "transaction_id": "txn_def456..."
  }
}`,
  },
  {
    id: "get-balance",
    method: "GET",
    path: "/getBalance",
    title: "Get Wallet Balance",
    description: "Retrieve the current wallet balance for a customer.",
    auth: "api-key-bearer",
    headers: [
      { name: "x-api-key", value: "your_api_key", description: "Your DynoPay API key" },
      { name: "Authorization", value: "Bearer {customer_token}", description: "Token from Create Customer" },
    ],
    responseExample: `{
  "success": true,
  "message": "Balance retrieved",
  "data": [
    {
      "wallet_type": "USD",
      "amount": 85.00
    }
  ]
}`,
  },
  {
    id: "get-transactions",
    method: "GET",
    path: "/getTransactions",
    title: "List Transactions",
    description: "Get paginated transaction history for a customer, including auto-conversion details if applicable.",
    auth: "api-key-bearer",
    headers: [
      { name: "x-api-key", value: "your_api_key", description: "Your DynoPay API key" },
      { name: "Authorization", value: "Bearer {customer_token}", description: "Token from Create Customer" },
    ],
    queryParams: [
      { name: "page", type: "number", required: false, description: "Page number (default: 1)" },
      { name: "limit", type: "number", required: false, description: "Results per page (default: 10)" },
    ],
    responseExample: `{
  "success": true,
  "message": "Transactions retrieved",
  "display_currency": "USD",
  "data": [
    {
      "id": "txn_abc123...",
      "base_amount": "50.00",
      "base_currency": "USD",
      "paid_amount": "0.00084",
      "paid_currency": "BTC",
      "payment_status": "completed",
      "auto_converted": true,
      "auto_convert": {
        "conversion_id": "conv_...",
        "status": "completed",
        "target_currency": "USDT",
        "target_amount": 50.00
      },
      "createdAt": "2025-03-06T12:00:00.000Z"
    }
  ]
}`,
  },
  {
    id: "get-single-transaction",
    method: "GET",
    path: "/getSingleTransaction/:id",
    title: "Get Transaction Details",
    description: "Retrieve full details for a single transaction by its ID, including payment status and auto-conversion info.",
    auth: "api-key-bearer",
    headers: [
      { name: "x-api-key", value: "your_api_key", description: "Your DynoPay API key" },
      { name: "Authorization", value: "Bearer {customer_token}", description: "Token from Create Customer" },
    ],
    pathParams: [{ name: "id", type: "string", description: "The transaction ID" }],
    responseExample: `{
  "success": true,
  "message": "Transaction retrieved",
  "data": {
    "id": "txn_abc123...",
    "base_amount": "50.00",
    "base_currency": "USD",
    "paid_amount": "0.00084",
    "paid_currency": "BTC",
    "payment_status": "completed",
    "transaction_type": "CREDIT",
    "createdAt": "2025-03-06T12:00:00.000Z"
  }
}`,
  },
  {
    id: "get-crypto-transaction",
    method: "GET",
    path: "/getCryptoTransaction/:address",
    title: "Verify Crypto Payment",
    description:
      "Verify a crypto payment by its blockchain deposit address. Use this to poll payment status after creating a direct crypto payment.",
    auth: "api-key-bearer",
    headers: [
      { name: "x-api-key", value: "your_api_key", description: "Your DynoPay API key" },
      { name: "Authorization", value: "Bearer {customer_token}", description: "Token from Create Customer" },
    ],
    pathParams: [{ name: "address", type: "string", description: "The deposit address from cryptoPayment response" }],
    responseExample: `{
  "success": true,
  "message": "Transaction verified",
  "data": {
    "status": "completed",
    "amount": 0.00084,
    "currency": "BTC",
    "confirmations": 3
  }
}`,
  },
  {
    id: "get-supported-currency",
    method: "GET",
    path: "/getSupportedCurrency",
    title: "Get Supported Currencies",
    description: "Get the list of cryptocurrencies configured for your merchant account, plus all platform-supported currencies.",
    auth: "api-key",
    headers: [
      { name: "x-api-key", value: "your_api_key", description: "Your DynoPay API key" },
    ],
    responseExample: `{
  "success": true,
  "message": "Supported currencies retrieved",
  "data": {
    "currencies": ["BTC", "ETH", "USDT", "LTC"],
    "all_supported": ["BTC", "ETH", "USDT", "LTC", "XRP", "BCH", "RLUSD"]
  }
}`,
  },
];

const SECTIONS: Section[] = [
  { id: "getting-started", title: "Getting Started" },
  { id: "authentication", title: "Authentication" },
  {
    id: "customers",
    title: "Customers",
    endpoints: ["create-user"],
  },
  {
    id: "payments",
    title: "Payments",
    endpoints: ["create-payment", "crypto-payment"],
  },
  {
    id: "wallets",
    title: "Wallets",
    endpoints: ["add-funds", "use-wallet", "get-balance"],
  },
  {
    id: "transactions",
    title: "Transactions",
    endpoints: ["get-transactions", "get-single-transaction", "get-crypto-transaction"],
  },
  {
    id: "currencies",
    title: "Currencies",
    endpoints: ["get-supported-currency"],
  },
];

// ─── Helper Components ────────────────────────────────────────
const MethodBadge = ({ method }: { method: string }) => {
  const isGet = method === "GET";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2px 10px",
        borderRadius: 6,
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: 0.5,
        fontFamily: "monospace",
        color: "#fff",
        background: isGet ? "#22c55e" : "#0004FF",
        minWidth: 48,
      }}
    >
      {method}
    </span>
  );
};

const CopyButton = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [text]);
  return (
    <button
      onClick={handleCopy}
      style={{
        position: "absolute",
        top: 8,
        right: 8,
        background: copied ? "#22c55e" : "rgba(255,255,255,0.08)",
        border: "1px solid rgba(255,255,255,0.15)",
        borderRadius: 6,
        padding: "4px 12px",
        color: "#fff",
        fontSize: 12,
        cursor: "pointer",
        transition: "all 0.15s",
      }}
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
};

const CodeBlock = ({ code, lang }: { code: string; lang?: string }) => (
  <div style={{ position: "relative", marginBottom: 16 }}>
    <CopyButton text={code} />
    <pre
      style={{
        background: "#1e1e2e",
        color: "#cdd6f4",
        borderRadius: 10,
        padding: "20px 16px",
        fontSize: 13,
        lineHeight: 1.6,
        overflowX: "auto",
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        margin: 0,
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {lang && (
        <span style={{ color: "#6c7086", fontSize: 11, display: "block", marginBottom: 8 }}>
          {lang}
        </span>
      )}
      <code>{code}</code>
    </pre>
  </div>
);

const ParamTable = ({
  title,
  params,
}: {
  title: string;
  params: { name: string; type: string; required?: boolean; description: string }[];
}) => (
  <Box sx={{ mb: 2.5 }}>
    <Typography sx={{ fontSize: 14, fontWeight: 600, color: "#1e1e2e", mb: 1 }}>{title}</Typography>
    <Box
      sx={{
        border: "1px solid #e5e7eb",
        borderRadius: "10px",
        overflow: "hidden",
      }}
    >
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ background: "#f9fafb" }}>
            <th style={{ textAlign: "left", padding: "10px 14px", fontWeight: 600, color: "#374151", borderBottom: "1px solid #e5e7eb" }}>
              Parameter
            </th>
            <th style={{ textAlign: "left", padding: "10px 14px", fontWeight: 600, color: "#374151", borderBottom: "1px solid #e5e7eb" }}>
              Type
            </th>
            <th style={{ textAlign: "left", padding: "10px 14px", fontWeight: 600, color: "#374151", borderBottom: "1px solid #e5e7eb" }}>
              Description
            </th>
          </tr>
        </thead>
        <tbody>
          {params.map((p, i) => (
            <tr key={p.name} style={{ borderBottom: i < params.length - 1 ? "1px solid #f3f4f6" : "none" }}>
              <td style={{ padding: "10px 14px" }}>
                <code style={{ color: "#0004FF", fontWeight: 600, fontSize: 13 }}>{p.name}</code>
                {"required" in p && p.required && (
                  <span style={{ color: "#ef4444", fontSize: 11, marginLeft: 6 }}>required</span>
                )}
              </td>
              <td style={{ padding: "10px 14px", color: "#6b7280" }}>
                <code style={{ fontSize: 12 }}>{p.type}</code>
              </td>
              <td style={{ padding: "10px 14px", color: "#374151" }}>{p.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Box>
  </Box>
);

// ─── Endpoint Card ────────────────────────────────────────────
const EndpointCard = ({ ep }: { ep: Endpoint }) => {
  const [expanded, setExpanded] = useState(false);
  return (
    <Box
      id={ep.id}
      sx={{
        mb: 4,
        border: "1px solid #e5e7eb",
        borderRadius: "14px",
        overflow: "hidden",
        transition: "box-shadow 0.2s",
        "&:hover": { boxShadow: "0 2px 16px rgba(0,4,255,0.06)" },
        scrollMarginTop: "100px",
      }}
    >
      {/* Card Header */}
      <Box
        onClick={() => setExpanded((v) => !v)}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          px: 2.5,
          py: 2,
          cursor: "pointer",
          background: expanded ? "#fafbff" : "#fff",
          transition: "background 0.15s",
          "&:hover": { background: "#f5f7ff" },
        }}
      >
        <MethodBadge method={ep.method} />
        <Typography
          sx={{
            fontFamily: "monospace",
            fontSize: 14,
            fontWeight: 500,
            color: "#374151",
            flex: 1,
          }}
        >
          {BASE_URL}
          {ep.path}
        </Typography>
        <Typography sx={{ fontSize: 14, fontWeight: 600, color: "#1e1e2e", mr: 1, display: { xs: "none", md: "block" } }}>
          {ep.title}
        </Typography>
        <span
          style={{
            fontSize: 11,
            padding: "2px 8px",
            borderRadius: 4,
            background: ep.auth === "api-key" ? "#dbeafe" : "#ede9fe",
            color: ep.auth === "api-key" ? "#1d4ed8" : "#6d28d9",
            fontWeight: 600,
            whiteSpace: "nowrap",
          }}
        >
          {ep.auth === "api-key" ? "API Key" : "API Key + Bearer"}
        </span>
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          style={{
            transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s",
            flexShrink: 0,
          }}
        >
          <path d="M5 7.5L10 12.5L15 7.5" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Box>

      {/* Card Body */}
      {expanded && (
        <Box sx={{ px: 2.5, py: 2.5, borderTop: "1px solid #e5e7eb" }}>
          <Typography sx={{ fontSize: 14, color: "#4b5563", mb: 2.5, lineHeight: 1.7 }}>{ep.description}</Typography>

          {/* Headers */}
          <ParamTable
            title="Headers"
            params={ep.headers.map((h) => ({
              name: h.name,
              type: "string",
              description: h.description || h.value,
            }))}
          />

          {/* Path Params */}
          {ep.pathParams && ep.pathParams.length > 0 && (
            <ParamTable title="Path Parameters" params={ep.pathParams} />
          )}

          {/* Query Params */}
          {ep.queryParams && ep.queryParams.length > 0 && (
            <ParamTable title="Query Parameters" params={ep.queryParams} />
          )}

          {/* Body */}
          {ep.body && ep.body.length > 0 && <ParamTable title="Request Body" params={ep.body} />}

          {/* Request Example */}
          {ep.requestExample && (
            <Box sx={{ mb: 2 }}>
              <Typography sx={{ fontSize: 14, fontWeight: 600, color: "#1e1e2e", mb: 1 }}>
                Request Example
              </Typography>
              <CodeBlock code={ep.requestExample} lang="json" />
            </Box>
          )}

          {/* Response */}
          <Box>
            <Typography sx={{ fontSize: 14, fontWeight: 600, color: "#1e1e2e", mb: 1 }}>
              Response Example
            </Typography>
            <CodeBlock code={ep.responseExample} lang="json" />
          </Box>
        </Box>
      )}
    </Box>
  );
};

// ─── Main Page ────────────────────────────────────────────────
const DocumentationPage = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [activeSection, setActiveSection] = useState("getting-started");

  const scrollTo = useCallback((id: string) => {
    setActiveSection(id);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const endpointMap = useMemo(() => {
    const map: Record<string, Endpoint> = {};
    ENDPOINTS.forEach((ep) => {
      map[ep.id] = ep;
    });
    return map;
  }, []);

  return (
    <>
      <Head>
        <title>API Documentation | DynoPay</title>
        <meta
          name="description"
          content="Integrate crypto payments into your application with the DynoPay API. Create customers, accept payments, manage wallets and more."
        />
      </Head>

      <Box
        sx={{
          minHeight: "100vh",
          background: "#fff",
        }}
      >
        {/* Hero */}
        <Box
          sx={{
            background: "linear-gradient(135deg, #0004FF 0%, #1a1aff 50%, #3333ff 100%)",
            pt: { xs: 10, md: 14 },
            pb: { xs: 6, md: 8 },
            px: 3,
            textAlign: "center",
          }}
        >
          <Typography
            sx={{
              fontSize: { xs: 10, md: 12 },
              fontWeight: 700,
              letterSpacing: 2,
              color: "rgba(255,255,255,0.6)",
              textTransform: "uppercase",
              mb: 1.5,
            }}
          >
            Developer Documentation
          </Typography>
          <Typography
            sx={{
              fontSize: { xs: 32, md: 46 },
              fontWeight: 800,
              color: "#fff",
              mb: 2,
              lineHeight: 1.15,
            }}
          >
            DynoPay API Reference
          </Typography>
          <Typography
            sx={{
              fontSize: { xs: 15, md: 18 },
              color: "rgba(255,255,255,0.75)",
              maxWidth: 640,
              mx: "auto",
              lineHeight: 1.6,
            }}
          >
            Everything you need to accept crypto payments, manage customer wallets, and track transactions programmatically.
          </Typography>
          <Box
            sx={{
              display: "inline-flex",
              gap: 1.5,
              mt: 4,
              background: "rgba(0,0,0,0.2)",
              borderRadius: "10px",
              px: 2,
              py: 1.2,
            }}
          >
            <Typography sx={{ fontFamily: "monospace", fontSize: 14, color: "rgba(255,255,255,0.7)" }}>
              Base URL
            </Typography>
            <Typography sx={{ fontFamily: "monospace", fontSize: 14, color: "#fff", fontWeight: 600 }}>
              {"https://your-domain.com/api/user"}
            </Typography>
          </Box>
        </Box>

        {/* Content */}
        <Box
          sx={{
            display: "flex",
            maxWidth: 1280,
            mx: "auto",
            px: { xs: 2, md: 4 },
            py: { xs: 3, md: 5 },
            gap: 5,
          }}
        >
          {/* Sidebar Navigation */}
          {!isMobile && (
            <Box
              sx={{
                width: 220,
                flexShrink: 0,
                position: "sticky",
                top: 100,
                alignSelf: "flex-start",
                maxHeight: "calc(100vh - 120px)",
                overflowY: "auto",
              }}
            >
              <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: "#9ca3af", textTransform: "uppercase", mb: 1.5 }}>
                Navigation
              </Typography>
              {SECTIONS.map((sec) => (
                <Box key={sec.id} sx={{ mb: 0.5 }}>
                  <Box
                    onClick={() => scrollTo(sec.id)}
                    sx={{
                      px: 1.5,
                      py: 0.8,
                      borderRadius: "8px",
                      cursor: "pointer",
                      fontSize: 14,
                      fontWeight: activeSection === sec.id ? 600 : 400,
                      color: activeSection === sec.id ? "#0004FF" : "#4b5563",
                      background: activeSection === sec.id ? "#eff2ff" : "transparent",
                      transition: "all 0.15s",
                      "&:hover": { background: "#f3f4f6" },
                    }}
                  >
                    {sec.title}
                  </Box>
                  {sec.endpoints?.map((epId) => (
                    <Box
                      key={epId}
                      onClick={() => scrollTo(epId)}
                      sx={{
                        pl: 3,
                        pr: 1.5,
                        py: 0.5,
                        fontSize: 13,
                        color: "#6b7280",
                        cursor: "pointer",
                        borderRadius: "6px",
                        "&:hover": { color: "#0004FF", background: "#f9fafb" },
                      }}
                    >
                      {endpointMap[epId]?.title}
                    </Box>
                  ))}
                </Box>
              ))}
            </Box>
          )}

          {/* Main Content */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            {/* Getting Started */}
            <Box id="getting-started" sx={{ mb: 6, scrollMarginTop: "100px" }}>
              <Typography sx={{ fontSize: { xs: 24, md: 30 }, fontWeight: 800, color: "#1e1e2e", mb: 1.5 }}>
                Getting Started
              </Typography>
              <Typography sx={{ fontSize: 15, color: "#4b5563", lineHeight: 1.8, mb: 3 }}>
                Integrate DynoPay in three simple steps:
              </Typography>

              <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, mb: 4 }}>
                {[
                  {
                    step: "1",
                    title: "Get your API Key",
                    desc: 'Go to your DynoPay dashboard → API section → "Create New Key". You\'ll receive an API key for authenticating requests.',
                  },
                  {
                    step: "2",
                    title: "Create a Customer",
                    desc: "Use the Create Customer endpoint to register your users. You'll get back a bearer token for that customer.",
                  },
                  {
                    step: "3",
                    title: "Create a Payment",
                    desc: "Use the Checkout Payment or Direct Crypto Payment endpoint. The customer pays in crypto, you settle in stablecoins.",
                  },
                ].map((s) => (
                  <Box
                    key={s.step}
                    sx={{
                      display: "flex",
                      gap: 2,
                      alignItems: "flex-start",
                      p: 2.5,
                      borderRadius: "12px",
                      border: "1px solid #e5e7eb",
                      background: "#fafbff",
                    }}
                  >
                    <Box
                      sx={{
                        width: 36,
                        height: 36,
                        borderRadius: "10px",
                        background: "#0004FF",
                        color: "#fff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 800,
                        fontSize: 16,
                        flexShrink: 0,
                      }}
                    >
                      {s.step}
                    </Box>
                    <Box>
                      <Typography sx={{ fontWeight: 700, fontSize: 15, color: "#1e1e2e", mb: 0.3 }}>
                        {s.title}
                      </Typography>
                      <Typography sx={{ fontSize: 14, color: "#6b7280", lineHeight: 1.6 }}>{s.desc}</Typography>
                    </Box>
                  </Box>
                ))}
              </Box>

              <Typography sx={{ fontSize: 14, fontWeight: 600, color: "#1e1e2e", mb: 1 }}>Quick Example — Create a customer and payment</Typography>
              <CodeBlock
                lang="bash"
                code={`# Step 1: Create a customer
curl -X POST https://your-domain.com/api/user/createUser \\
  -H "x-api-key: your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{"name": "Jane Smith", "email": "jane@example.com"}'

# Step 2: Create a checkout payment (use the token from Step 1)
curl -X POST https://your-domain.com/api/user/createPayment \\
  -H "x-api-key: your_api_key" \\
  -H "Authorization: Bearer eyJhbGciOi..." \\
  -H "Content-Type: application/json" \\
  -d '{"amount": 50, "redirect_uri": "https://yoursite.com/thanks"}'`}
              />
            </Box>

            {/* Authentication */}
            <Box id="authentication" sx={{ mb: 6, scrollMarginTop: "100px" }}>
              <Typography sx={{ fontSize: { xs: 22, md: 26 }, fontWeight: 800, color: "#1e1e2e", mb: 1.5 }}>
                Authentication
              </Typography>
              <Typography sx={{ fontSize: 15, color: "#4b5563", lineHeight: 1.8, mb: 3 }}>
                DynoPay uses two levels of authentication depending on the endpoint:
              </Typography>

              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2.5, mb: 3 }}>
                <Box
                  sx={{
                    p: 2.5,
                    borderRadius: "12px",
                    border: "2px solid #dbeafe",
                    background: "#f0f5ff",
                  }}
                >
                  <Typography sx={{ fontWeight: 700, fontSize: 15, color: "#1d4ed8", mb: 1 }}>
                    API Key Only
                  </Typography>
                  <Typography sx={{ fontSize: 13, color: "#4b5563", lineHeight: 1.7, mb: 1.5 }}>
                    Used for creating customers and listing supported currencies. Only requires the <code style={{ background: "#e5e7eb", padding: "1px 5px", borderRadius: 4, fontSize: 12 }}>x-api-key</code> header.
                  </Typography>
                  <CodeBlock code={`x-api-key: your_api_key`} />
                </Box>
                <Box
                  sx={{
                    p: 2.5,
                    borderRadius: "12px",
                    border: "2px solid #ede9fe",
                    background: "#f5f3ff",
                  }}
                >
                  <Typography sx={{ fontWeight: 700, fontSize: 15, color: "#6d28d9", mb: 1 }}>
                    API Key + Bearer Token
                  </Typography>
                  <Typography sx={{ fontSize: 13, color: "#4b5563", lineHeight: 1.7, mb: 1.5 }}>
                    Required for all payment and wallet operations. Include both the API key and a customer bearer token from the Create Customer response.
                  </Typography>
                  <CodeBlock
                    code={`x-api-key: your_api_key
Authorization: Bearer eyJhbGciOi...`}
                  />
                </Box>
              </Box>
            </Box>

            {/* Endpoint Sections */}
            {SECTIONS.filter((s) => s.endpoints).map((section) => (
              <Box key={section.id} id={section.id} sx={{ mb: 6, scrollMarginTop: "100px" }}>
                <Typography sx={{ fontSize: { xs: 22, md: 26 }, fontWeight: 800, color: "#1e1e2e", mb: 2.5 }}>
                  {section.title}
                </Typography>
                {section.endpoints!.map((epId) => {
                  const ep = endpointMap[epId];
                  return ep ? <EndpointCard key={ep.id} ep={ep} /> : null;
                })}
              </Box>
            ))}

            {/* Error Responses */}
            <Box id="errors" sx={{ mb: 6, scrollMarginTop: "100px" }}>
              <Typography sx={{ fontSize: { xs: 22, md: 26 }, fontWeight: 800, color: "#1e1e2e", mb: 1.5 }}>
                Error Handling
              </Typography>
              <Typography sx={{ fontSize: 15, color: "#4b5563", lineHeight: 1.8, mb: 2.5 }}>
                All errors follow a consistent format. Check the <code style={{ background: "#f3f4f6", padding: "1px 5px", borderRadius: 4, fontSize: 13 }}>success</code> field and the HTTP status code.
              </Typography>
              <CodeBlock
                lang="json"
                code={`{
  "success": false,
  "message": "Amount must be greater than or equal to 5",
  "errors": [
    { "key": "amount", "error": "Invalid amount" }
  ]
}`}
              />
              <Box sx={{ border: "1px solid #e5e7eb", borderRadius: "10px", overflow: "hidden", mt: 2 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#f9fafb" }}>
                      <th style={{ textAlign: "left", padding: "10px 14px", fontWeight: 600, borderBottom: "1px solid #e5e7eb" }}>
                        Status
                      </th>
                      <th style={{ textAlign: "left", padding: "10px 14px", fontWeight: 600, borderBottom: "1px solid #e5e7eb" }}>
                        Meaning
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["400", "Bad Request — missing or invalid parameters"],
                      ["401", "Unauthorized — invalid or missing API key / token"],
                      ["403", "Forbidden — API key disabled or company inactive"],
                      ["404", "Not Found — resource does not exist"],
                      ["500", "Server Error — something went wrong on our side"],
                    ].map(([code, desc], i) => (
                      <tr key={code} style={{ borderBottom: i < 4 ? "1px solid #f3f4f6" : "none" }}>
                        <td style={{ padding: "10px 14px" }}>
                          <code style={{ fontWeight: 700, color: Number(code) >= 500 ? "#ef4444" : "#f59e0b" }}>{code}</code>
                        </td>
                        <td style={{ padding: "10px 14px", color: "#374151" }}>{desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Box>
            </Box>

            {/* Rate Limits / Support */}
            <Box
              sx={{
                p: 3,
                borderRadius: "14px",
                background: "linear-gradient(135deg, #f0f5ff 0%, #f5f3ff 100%)",
                border: "1px solid #dbeafe",
                mb: 6,
              }}
            >
              <Typography sx={{ fontWeight: 700, fontSize: 16, color: "#1e1e2e", mb: 1 }}>Need Help?</Typography>
              <Typography sx={{ fontSize: 14, color: "#4b5563", lineHeight: 1.7 }}>
                If you run into any issues integrating DynoPay, reach out to our support team through the dashboard&apos;s Help & Support section.
                We&apos;re here to help you get set up quickly.
              </Typography>
            </Box>
          </Box>
        </Box>
      </Box>
    </>
  );
};

export default DocumentationPage;
