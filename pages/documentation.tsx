import React, { useState, useCallback, useMemo, useEffect, memo } from "react";
import { Box, Typography, useTheme, useMediaQuery, Grid, Divider } from "@mui/material";
import { styled, alpha } from "@mui/material/styles";
import Head from "next/head";
import { useRouter } from "next/router";
import HomeSectionTitle from "@/Components/UI/SectionTitle";
import HomeButton from "@/Components/Layout/HomeButton";
import useIsMobile from "@/hooks/useIsMobile";
import CodeIcon from "@mui/icons-material/Code";
import PaymentIcon from "@mui/icons-material/Payment";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import CurrencyExchangeIcon from "@mui/icons-material/CurrencyExchange";
import PersonAddAlt1Icon from "@mui/icons-material/PersonAddAlt1";
import ShieldOutlinedIcon from "@mui/icons-material/ShieldOutlined";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CheckIcon from "@mui/icons-material/Check";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { useTranslation } from "react-i18next";

/* ================================================================
   TYPES
   ================================================================ */

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
  icon: React.ReactNode;
  endpoints?: string[];
}

/* ================================================================
   STYLED COMPONENTS — BRAND-ALIGNED
   ================================================================ */

const PageWrapper = styled(Box)(({ theme }) => ({
  width: "100%",
  minHeight: "100vh",
  paddingTop: 65,
  [theme.breakpoints.down("md")]: { paddingTop: 76 },
}));

const Container = styled(Box)(({ theme }) => ({
  width: "100%",
  maxWidth: 1280,
  margin: "0 auto",
  paddingLeft: theme.spacing(2),
  paddingRight: theme.spacing(2),
}));

const ProductCard = styled(Box)(({ theme }) => {
  const dk = theme.palette.mode === "dark";
  return {
    padding: "24px",
    borderRadius: "16px",
    border: `1px solid ${dk ? "#2A2D42" : "#E7E8EF"}`,
    background: dk ? "#141625" : "#FFFFFF",
    cursor: "pointer",
    transition: "all 0.2s ease",
    height: "100%",
    display: "flex",
    flexDirection: "column" as const,
    "&:hover": {
      borderColor: dk ? "#6A7BFF" : "#0004FF",
      transform: "translateY(-2px)",
      boxShadow: dk
        ? "0 8px 32px rgba(106,123,255,0.15)"
        : "0 8px 32px rgba(0,4,255,0.08)",
    },
  };
});

const ProductIcon = styled(Box)(({ theme }) => {
  const dk = theme.palette.mode === "dark";
  return {
    width: 48,
    height: 48,
    borderRadius: "14px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: dk ? "rgba(106,123,255,0.1)" : "#0004FF0D",
    color: dk ? "#A5B4FC" : "#0004FF",
    marginBottom: "16px",
    "& svg": { fontSize: 24 },
  };
});

const SidebarWrapper = styled(Box)(({ theme }) => {
  const dk = theme.palette.mode === "dark";
  return {
    width: 240,
    flexShrink: 0,
    position: "sticky" as const,
    top: 80,
    alignSelf: "flex-start",
    maxHeight: "calc(100vh - 100px)",
    overflowY: "auto" as const,
    paddingRight: "16px",
    borderRight: `1px solid ${dk ? "#2A2D42" : "#E7E8EF"}`,
    "&::-webkit-scrollbar": { width: 4 },
    "&::-webkit-scrollbar-track": { background: "transparent" },
    "&::-webkit-scrollbar-thumb": {
      background: dk ? "#2A2D42" : "#E7E8EF",
      borderRadius: 4,
    },
  };
});

const SidebarItem = styled(Box, {
  shouldForwardProp: (prop) => prop !== "active",
})<{ active?: boolean }>(({ theme, active }) => {
  const dk = theme.palette.mode === "dark";
  return {
    padding: "8px 12px",
    borderRadius: "10px",
    fontSize: "14px",
    fontFamily: active ? "OutfitMedium" : "OutfitRegular",
    fontWeight: active ? 500 : 400,
    color: active ? (dk ? "#A5B4FC" : "#0004FF") : theme.palette.text.secondary,
    background: active ? (dk ? "rgba(106,123,255,0.1)" : "#0004FF08") : "transparent",
    cursor: "pointer",
    transition: "all 0.15s",
    "&:hover": {
      background: dk ? "rgba(106,123,255,0.06)" : "#F8F9FC",
      color: dk ? "#A5B4FC" : "#0004FF",
    },
  };
});

const SubItem = styled(SidebarItem)(() => ({
  paddingLeft: "28px",
  fontSize: "13px",
}));

const SidebarLabel = styled(Typography)(({ theme }) => ({
  fontSize: "11px",
  fontWeight: 600,
  fontFamily: "OutfitSemiBold",
  letterSpacing: "1.2px",
  textTransform: "uppercase" as const,
  color: theme.palette.text.secondary,
  padding: "16px 12px 6px",
}));

const EndpointCardWrapper = styled(Box)(({ theme }) => {
  const dk = theme.palette.mode === "dark";
  return {
    marginBottom: "24px",
    border: `1px solid ${dk ? "#2A2D42" : "#E7E8EF"}`,
    borderRadius: "16px",
    overflow: "hidden",
    transition: "box-shadow 0.2s",
    scrollMarginTop: "100px",
    "&:hover": {
      boxShadow: dk
        ? "0 4px 20px rgba(106,123,255,0.08)"
        : "0 4px 20px rgba(0,4,255,0.04)",
    },
  };
});

const EndpointHeader = styled(Box, {
  shouldForwardProp: (prop) => prop !== "expanded",
})<{ expanded?: boolean }>(({ theme, expanded }) => {
  const dk = theme.palette.mode === "dark";
  return {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "16px 20px",
    cursor: "pointer",
    background: expanded
      ? dk ? "rgba(106,123,255,0.04)" : "#FAFBFF"
      : dk ? "#141625" : "#FFFFFF",
    transition: "background 0.15s",
    "&:hover": {
      background: dk ? "rgba(106,123,255,0.06)" : "#F5F7FF",
    },
  };
});

const MethodBadgeStyled = styled("span", {
  shouldForwardProp: (prop) => prop !== "isGet",
})<{ isGet: boolean }>(({ isGet }) => ({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "3px 10px",
  borderRadius: "8px",
  fontSize: "11px",
  fontWeight: 700,
  letterSpacing: "0.5px",
  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
  color: "#FFFFFF",
  background: isGet ? "#22C55E" : "#0004FF",
  minWidth: 44,
}));

const AuthBadge = styled("span", {
  shouldForwardProp: (prop) => prop !== "authType",
})<{ authType: string }>(({ theme, authType }) => {
  const dk = theme.palette.mode === "dark";
  const isApiOnly = authType === "api-key";
  return {
    fontSize: "11px",
    padding: "3px 10px",
    borderRadius: "6px",
    fontWeight: 600,
    fontFamily: "OutfitMedium",
    whiteSpace: "nowrap" as const,
    background: isApiOnly
      ? dk ? "rgba(29,78,216,0.15)" : "#DBEAFE"
      : dk ? "rgba(109,40,217,0.15)" : "#EDE9FE",
    color: isApiOnly ? "#60A5FA" : "#A78BFA",
  };
});

const CodeBlockWrapper = styled(Box)(() => ({
  position: "relative",
  marginBottom: "16px",
}));

const Pre = styled("pre")(({ theme }) => {
  const dk = theme.palette.mode === "dark";
  return {
    background: dk ? "#0D0F1A" : "#1E1E2E",
    color: "#CDD6F4",
    borderRadius: "12px",
    padding: "20px 16px",
    fontSize: "13px",
    lineHeight: 1.65,
    overflowX: "auto" as const,
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    margin: 0,
    border: `1px solid ${dk ? "#1E2030" : "rgba(255,255,255,0.06)"}`,
  };
});

const CopyBtn = styled("button")(({ theme }) => ({
  position: "absolute" as const,
  top: 8,
  right: 8,
  background: "rgba(255,255,255,0.08)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: "8px",
  padding: "5px 12px",
  color: "#FFFFFF",
  fontSize: "12px",
  fontFamily: "OutfitRegular",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: "4px",
  transition: "all 0.15s",
  "&:hover": { background: "rgba(255,255,255,0.15)" },
}));

const TableWrapper = styled(Box)(({ theme }) => {
  const dk = theme.palette.mode === "dark";
  return {
    border: `1px solid ${dk ? "#2A2D42" : "#E7E8EF"}`,
    borderRadius: "12px",
    overflow: "hidden",
    marginBottom: "20px",
  };
});

const StepCard = styled(Box)(({ theme }) => {
  const dk = theme.palette.mode === "dark";
  return {
    display: "flex",
    gap: "16px",
    alignItems: "flex-start",
    padding: "20px",
    borderRadius: "14px",
    border: `1px solid ${dk ? "#2A2D42" : "#E7E8EF"}`,
    background: dk ? "#141625" : "#FFFFFF",
  };
});

const StepNumber = styled(Box)(({ theme }) => {
  const dk = theme.palette.mode === "dark";
  return {
    width: 36,
    height: 36,
    minWidth: 36,
    borderRadius: "10px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: dk ? "rgba(106,123,255,0.15)" : "#0004FF",
    color: "#FFFFFF",
    fontWeight: 700,
    fontSize: "15px",
    fontFamily: "OutfitSemiBold",
  };
});

const AuthCard = styled(Box, {
  shouldForwardProp: (prop) => prop !== "variant",
})<{ variant: "blue" | "purple" }>(({ theme, variant }) => {
  const dk = theme.palette.mode === "dark";
  const isBlue = variant === "blue";
  return {
    padding: "24px",
    borderRadius: "14px",
    border: `1px solid ${
      isBlue
        ? dk ? "rgba(29,78,216,0.3)" : "#BFDBFE"
        : dk ? "rgba(109,40,217,0.3)" : "#DDD6FE"
    }`,
    background: isBlue
      ? dk ? "rgba(29,78,216,0.06)" : "#EFF6FF"
      : dk ? "rgba(109,40,217,0.06)" : "#F5F3FF",
    height: "100%",
  };
});

const InfoBox = styled(Box)(({ theme }) => {
  const dk = theme.palette.mode === "dark";
  return {
    padding: "20px",
    borderRadius: "14px",
    background: dk
      ? "linear-gradient(135deg, rgba(106,123,255,0.06) 0%, rgba(109,40,217,0.06) 100%)"
      : "linear-gradient(135deg, #F0F5FF 0%, #F5F3FF 100%)",
    border: `1px solid ${dk ? "#2A2D42" : "#E7E8EF"}`,
  };
});

/* ================================================================
   ENDPOINT DATA
   ================================================================ */

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
      { name: "x-api-key", value: "your_api_key", description: "Your Dynopay API key" },
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
      { name: "x-api-key", value: "your_api_key", description: "Your Dynopay API key" },
      { name: "Authorization", value: "Bearer {customer_token}", description: "Token from Create Customer" },
      { name: "Content-Type", value: "application/json", description: "" },
    ],
    body: [
      { name: "amount", type: "number", required: true, description: "Payment amount in your base currency (min 5)" },
      { name: "redirect_uri", type: "string", required: true, description: "URL to redirect after payment completes" },
      { name: "fee_payer", type: "string", required: false, description: '"company" (default) or "customer"' },
      { name: "accepted_currencies", type: "string[]", required: false, description: 'Limit accepted cryptos, e.g. ["BTC","ETH"]' },
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
    "redirect_url": "https://checkout.dynopay.com/pay?d=abc123...",
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
      { name: "x-api-key", value: "your_api_key", description: "Your Dynopay API key" },
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
    description: "Add funds to a customer's wallet via a hosted checkout. Returns a redirect URL for the customer to complete the deposit.",
    auth: "api-key-bearer",
    headers: [
      { name: "x-api-key", value: "your_api_key", description: "Your Dynopay API key" },
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
    "redirect_url": "https://checkout.dynopay.com/pay?d=xyz789...",
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
      { name: "x-api-key", value: "your_api_key", description: "Your Dynopay API key" },
      { name: "Authorization", value: "Bearer {customer_token}", description: "Token from Create Customer" },
      { name: "Content-Type", value: "application/json", description: "" },
    ],
    body: [{ name: "amount", type: "number", required: true, description: "Amount to debit from wallet" }],
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
      { name: "x-api-key", value: "your_api_key", description: "Your Dynopay API key" },
      { name: "Authorization", value: "Bearer {customer_token}", description: "Token from Create Customer" },
    ],
    responseExample: `{
  "success": true,
  "message": "Balance retrieved",
  "data": [{ "wallet_type": "USD", "amount": 85.00 }]
}`,
  },
  {
    id: "get-transactions",
    method: "GET",
    path: "/getTransactions",
    title: "List Transactions",
    description: "Get paginated transaction history for a customer, including auto-conversion details.",
    auth: "api-key-bearer",
    headers: [
      { name: "x-api-key", value: "your_api_key", description: "Your Dynopay API key" },
      { name: "Authorization", value: "Bearer {customer_token}", description: "Token from Create Customer" },
    ],
    queryParams: [
      { name: "page", type: "number", required: false, description: "Page number (default: 1)" },
      { name: "limit", type: "number", required: false, description: "Results per page (default: 10)" },
    ],
    responseExample: `{
  "success": true,
  "data": [{
    "id": "txn_abc123...",
    "base_amount": "50.00",
    "paid_currency": "BTC",
    "payment_status": "completed",
    "auto_converted": true,
    "createdAt": "2025-03-06T12:00:00.000Z"
  }]
}`,
  },
  {
    id: "get-single-transaction",
    method: "GET",
    path: "/getSingleTransaction/:id",
    title: "Get Transaction Details",
    description: "Retrieve full details for a single transaction by its ID.",
    auth: "api-key-bearer",
    headers: [
      { name: "x-api-key", value: "your_api_key", description: "Your Dynopay API key" },
      { name: "Authorization", value: "Bearer {customer_token}", description: "Token from Create Customer" },
    ],
    pathParams: [{ name: "id", type: "string", description: "The transaction ID" }],
    responseExample: `{
  "success": true,
  "data": {
    "id": "txn_abc123...",
    "base_amount": "50.00",
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
    description: "Verify a crypto payment by its blockchain deposit address. Use this to poll payment status.",
    auth: "api-key-bearer",
    headers: [
      { name: "x-api-key", value: "your_api_key", description: "Your Dynopay API key" },
      { name: "Authorization", value: "Bearer {customer_token}", description: "Token from Create Customer" },
    ],
    pathParams: [{ name: "address", type: "string", description: "The deposit address from cryptoPayment response" }],
    responseExample: `{
  "success": true,
  "data": { "status": "completed", "amount": 0.00084, "currency": "BTC", "confirmations": 3 }
}`,
  },
  {
    id: "get-supported-currency",
    method: "GET",
    path: "/getSupportedCurrency",
    title: "Get Supported Currencies",
    description: "Get the list of cryptocurrencies configured for your merchant account.",
    auth: "api-key",
    headers: [{ name: "x-api-key", value: "your_api_key", description: "Your Dynopay API key" }],
    responseExample: `{
  "success": true,
  "data": {
    "currencies": ["BTC", "ETH", "USDT", "LTC"],
    "all_supported": ["BTC", "ETH", "USDT", "LTC", "XRP", "BCH", "RLUSD", "SOL"]
  }
}`,
  },
  {
    id: "admin-credit-wallet",
    method: "POST",
    path: "/admin/customers/:customerId/credit",
    title: "Credit Customer Wallet (Admin)",
    description:
      "Add funds to a customer's wallet. Available for admin dashboard users and merchants via API key for programmatic wallet management. Creates a CREDIT transaction record.",
    auth: "api-key",
    headers: [
      { name: "x-api-key", value: "your_api_key", description: "Your Dynopay API key OR admin JWT token" },
      { name: "Content-Type", value: "application/json", description: "" },
    ],
    pathParams: [{ name: "customerId", type: "number", description: "The customer ID (numeric customer_id, not UUID)" }],
    body: [
      { name: "amount", type: "number", required: true, description: "Amount to credit to wallet (must be positive)" },
      { name: "description", type: "string", required: true, description: "Reason or description for the credit" },
    ],
    requestExample: `{
  "amount": 50.00,
  "description": "Refund for order #12345"
}`,
    responseExample: `{
  "success": true,
  "message": "Wallet credited successfully",
  "data": {
    "customer_id": "123",
    "previous_balance": "100.00",
    "amount_credited": "50.00",
    "new_balance": "150.00",
    "currency": "USD"
  }
}`,
  },
  {
    id: "admin-debit-wallet",
    method: "POST",
    path: "/admin/customers/:customerId/debit",
    title: "Debit Customer Wallet (Admin)",
    description:
      "Deduct funds from a customer's wallet. Available for admin dashboard users and merchants via API key for programmatic wallet management. Validates sufficient balance before debiting. Creates a DEBIT transaction record.",
    auth: "api-key",
    headers: [
      { name: "x-api-key", value: "your_api_key", description: "Your Dynopay API key OR admin JWT token" },
      { name: "Content-Type", value: "application/json", description: "" },
    ],
    pathParams: [{ name: "customerId", type: "number", description: "The customer ID (numeric customer_id, not UUID)" }],
    body: [
      { name: "amount", type: "number", required: true, description: "Amount to debit from wallet (must be positive)" },
      { name: "description", type: "string", required: true, description: "Reason or description for the debit" },
    ],
    requestExample: `{
  "amount": 25.00,
  "description": "Service fee for premium support"
}`,
    responseExample: `{
  "success": true,
  "message": "Wallet debited successfully",
  "data": {
    "customer_id": "123",
    "previous_balance": "150.00",
    "amount_debited": "25.00",
    "new_balance": "125.00",
    "currency": "USD"
  }
}`,
  },
];

const SECTIONS: Section[] = [
  { id: "overview", title: "Overview", icon: <CodeIcon /> },
  { id: "getting-started", title: "Getting Started", icon: <CodeIcon /> },
  { id: "authentication", title: "Authentication", icon: <ShieldOutlinedIcon /> },
  { id: "customers", title: "Customers", icon: <PersonAddAlt1Icon />, endpoints: ["create-user"] },
  { id: "payments", title: "Payments", icon: <PaymentIcon />, endpoints: ["create-payment", "crypto-payment"] },
  { id: "wallets", title: "Wallets", icon: <AccountBalanceWalletIcon />, endpoints: ["add-funds", "use-wallet", "get-balance"] },
  { id: "transactions", title: "Transactions", icon: <ReceiptLongIcon />, endpoints: ["get-transactions", "get-single-transaction", "get-crypto-transaction"] },
  { id: "currencies", title: "Currencies", icon: <CurrencyExchangeIcon />, endpoints: ["get-supported-currency"] },
  { id: "admin-api", title: "Admin API", icon: <ShieldOutlinedIcon />, endpoints: ["admin-credit-wallet", "admin-debit-wallet"] },
  { id: "errors", title: "Error Handling", icon: <WarningAmberIcon /> },
];

/* ================================================================
   HELPER COMPONENTS
   ================================================================ */

const CopyButton = memo(({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [text]);
  return (
    <CopyBtn onClick={handleCopy} style={copied ? { background: "rgba(34,197,94,0.2)", borderColor: "#22C55E" } : undefined}>
      {copied ? <><CheckIcon sx={{ fontSize: 12 }} /> Copied</> : <><ContentCopyIcon sx={{ fontSize: 12 }} /> Copy</>}
    </CopyBtn>
  );
});
CopyButton.displayName = "CopyButton";

const CodeBlock = memo(({ code, lang }: { code: string; lang?: string }) => (
  <CodeBlockWrapper>
    <CopyButton text={code} />
    <Pre>
      {lang && <span style={{ color: "#6C7086", fontSize: 11, display: "block", marginBottom: 8 }}>{lang}</span>}
      <code>{code}</code>
    </Pre>
  </CodeBlockWrapper>
));
CodeBlock.displayName = "CodeBlock";

const ParamTable = memo(({ title, params }: { title: string; params: { name: string; type: string; required?: boolean; description: string }[] }) => {
  const theme = useTheme();
  const dk = theme.palette.mode === "dark";
  const borderClr = dk ? "#2A2D42" : "#E7E8EF";
  const headBg = dk ? "rgba(106,123,255,0.04)" : "#F8F9FC";
  return (
    <Box sx={{ mb: 2.5 }}>
      <Typography sx={{ fontSize: 13, fontWeight: 600, fontFamily: "OutfitSemiBold", color: "text.primary", mb: 1 }}>{title}</Typography>
      <TableWrapper>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: headBg }}>
              {["Parameter", "Type", "Description"].map((h) => (
                <th key={h} style={{ textAlign: "left", padding: "10px 16px", fontWeight: 500, fontFamily: "OutfitMedium", color: dk ? "#C8CAD5" : "#374151", borderBottom: `1px solid ${borderClr}`, fontSize: 12 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {params.map((p, i) => (
              <tr key={p.name} style={{ borderBottom: i < params.length - 1 ? `1px solid ${dk ? "#1E2030" : "#F3F4F6"}` : "none" }}>
                <td style={{ padding: "10px 16px" }}>
                  <code style={{ color: dk ? "#A5B4FC" : "#0004FF", fontWeight: 600, fontSize: 13, fontFamily: "'JetBrains Mono', monospace" }}>{p.name}</code>
                  {"required" in p && p.required && <span style={{ color: "#EF4444", fontSize: 11, marginLeft: 6, fontFamily: "OutfitMedium" }}>required</span>}
                </td>
                <td style={{ padding: "10px 16px" }}><code style={{ fontSize: 12, color: dk ? "#8B8FA0" : "#6B7280" }}>{p.type}</code></td>
                <td style={{ padding: "10px 16px", color: dk ? "#A0A3B1" : "#374151", fontFamily: "OutfitRegular", fontSize: 13 }}>{p.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableWrapper>
    </Box>
  );
});
ParamTable.displayName = "ParamTable";

const EndpointCard = memo(({ ep }: { ep: Endpoint }) => {
  const [expanded, setExpanded] = useState(false);
  const theme = useTheme();
  const dk = theme.palette.mode === "dark";
  return (
    <EndpointCardWrapper id={ep.id}>
      <EndpointHeader expanded={expanded} onClick={() => setExpanded((v) => !v)}>
        <MethodBadgeStyled isGet={ep.method === "GET"}>{ep.method}</MethodBadgeStyled>
        <Typography sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 500, color: "text.secondary", flex: 1 }}>
          {BASE_URL}{ep.path}
        </Typography>
        <Typography sx={{ fontSize: 14, fontWeight: 500, fontFamily: "OutfitMedium", color: "text.primary", mr: 1, display: { xs: "none", md: "block" } }}>
          {ep.title}
        </Typography>
        <AuthBadge authType={ep.auth}>{ep.auth === "api-key" ? "API Key" : "API Key + Bearer"}</AuthBadge>
        <ExpandMoreIcon sx={{ fontSize: 20, color: "text.secondary", transform: expanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }} />
      </EndpointHeader>
      {expanded && (
        <Box sx={{ px: 2.5, py: 2.5, borderTop: `1px solid ${dk ? "#2A2D42" : "#E7E8EF"}` }}>
          <Typography sx={{ fontSize: 14, fontFamily: "OutfitRegular", color: "text.secondary", mb: 2.5, lineHeight: 1.7 }}>{ep.description}</Typography>
          <ParamTable title="Headers" params={ep.headers.map((h) => ({ name: h.name, type: "string", description: h.description || h.value }))} />
          {ep.pathParams && ep.pathParams.length > 0 && <ParamTable title="Path Parameters" params={ep.pathParams} />}
          {ep.queryParams && ep.queryParams.length > 0 && <ParamTable title="Query Parameters" params={ep.queryParams} />}
          {ep.body && ep.body.length > 0 && <ParamTable title="Request Body" params={ep.body} />}
          {ep.requestExample && (
            <Box sx={{ mb: 2 }}>
              <Typography sx={{ fontSize: 13, fontWeight: 600, fontFamily: "OutfitSemiBold", color: "text.primary", mb: 1 }}>Request Example</Typography>
              <CodeBlock code={ep.requestExample} lang="json" />
            </Box>
          )}
          <Box>
            <Typography sx={{ fontSize: 13, fontWeight: 600, fontFamily: "OutfitSemiBold", color: "text.primary", mb: 1 }}>Response Example</Typography>
            <CodeBlock code={ep.responseExample} lang="json" />
          </Box>
        </Box>
      )}
    </EndpointCardWrapper>
  );
});
EndpointCard.displayName = "EndpointCard";

/* ================================================================
   MAIN PAGE
   ================================================================ */

const DocumentationPage = () => {
  const theme = useTheme();
  const isMobile = useIsMobile("md");
  const dk = theme.palette.mode === "dark";
  const router = useRouter();
  const [activeSection, setActiveSection] = useState("overview");

  const endpointMap = useMemo(() => {
    const map: Record<string, Endpoint> = {};
    ENDPOINTS.forEach((ep) => { map[ep.id] = ep; });
    return map;
  }, []);

  const scrollTo = useCallback((id: string) => {
    setActiveSection(id);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  // Track active section on scroll
  useEffect(() => {
    const handleScroll = () => {
      const sections = SECTIONS.map((s) => document.getElementById(s.id)).filter(Boolean);
      for (let i = sections.length - 1; i >= 0; i--) {
        const el = sections[i];
        if (el && el.getBoundingClientRect().top <= 120) {
          setActiveSection(SECTIONS[i].id);
          break;
        }
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const borderClr = dk ? "#2A2D42" : "#E7E8EF";
  const headBg = dk ? "rgba(106,123,255,0.04)" : "#F8F9FC";

  const productCards = [
    { title: "Checkout Payments", desc: "Hosted payment page — redirect customers to complete crypto payments in a few clicks.", icon: <PaymentIcon />, section: "payments" },
    { title: "Direct Crypto API", desc: "Full control over the UI. Get wallet addresses and QR codes via API and build your own flow.", icon: <CodeIcon />, section: "payments" },
    { title: "Customer Wallets", desc: "Create customer wallets, add funds, debit balances, and track transactions.", icon: <AccountBalanceWalletIcon />, section: "wallets" },
    { title: "Transaction History", desc: "List, filter, and verify transactions including auto-conversion details.", icon: <ReceiptLongIcon />, section: "transactions" },
  ];

  return (
    <>
      <Head>
        <title>API Documentation | Dynopay</title>
        <meta name="description" content="Integrate crypto payments into your application with the Dynopay API." />
      </Head>

      <PageWrapper>
        {/* ===== HERO ===== */}
        <Container>
          <section style={{ padding: isMobile ? "48px 0 32px" : "80px 0 48px" }}>
            <HomeSectionTitle
              type="large"
              badgeText="Developer Documentation"
              title="Dynopay API Reference"
              highlightText="API Reference"
              subtitle="Everything you need to accept crypto payments, manage customer wallets, and track transactions programmatically."
            />
            <Box sx={{ display: "flex", justifyContent: "center", mt: 3 }}>
              <Box sx={{ display: "inline-flex", gap: 1.5, background: dk ? "#0D0F1A" : "#1E1E2E", borderRadius: "12px", px: 2.5, py: 1.5, border: `1px solid ${dk ? "#2A2D42" : "rgba(255,255,255,0.06)"}` }}>
                <Typography sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: "rgba(255,255,255,0.5)" }}>Base URL</Typography>
                <Typography sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: "#CDD6F4", fontWeight: 600 }}>https://api.dynopay.com/api/user</Typography>
              </Box>
            </Box>
          </section>
        </Container>

        {/* ===== PRODUCT CARDS ===== */}
        <Container>
          <Grid container spacing={2.5} sx={{ mb: { xs: 6, md: 8 } }}>
            {productCards.map((card) => (
              <Grid key={card.title} item xs={12} sm={6} md={3}>
                <ProductCard onClick={() => scrollTo(card.section)}>
                  <ProductIcon>{card.icon}</ProductIcon>
                  <Typography sx={{ fontSize: "16px", fontWeight: 500, fontFamily: "OutfitMedium", color: "text.primary", mb: 1 }}>
                    {card.title}
                  </Typography>
                  <Typography sx={{ fontSize: "13px", fontFamily: "OutfitRegular", color: "text.secondary", lineHeight: "20px", flex: 1 }}>
                    {card.desc}
                  </Typography>
                  <Typography sx={{ fontSize: "13px", fontFamily: "OutfitMedium", color: dk ? "#A5B4FC" : "#0004FF", mt: 2 }}>
                    Learn more →
                  </Typography>
                </ProductCard>
              </Grid>
            ))}
          </Grid>
        </Container>

        {/* ===== SIDEBAR + CONTENT ===== */}
        <Container>
          <Box sx={{ display: "flex", gap: 5, pb: 10 }}>
            {/* Sidebar */}
            {!isMobile && (
              <SidebarWrapper>
                <SidebarLabel>Navigation</SidebarLabel>
                {SECTIONS.map((sec) => (
                  <Box key={sec.id}>
                    <SidebarItem active={activeSection === sec.id} onClick={() => scrollTo(sec.id)}>
                      {sec.title}
                    </SidebarItem>
                    {sec.endpoints?.map((epId) => (
                      <SubItem key={epId} onClick={() => scrollTo(epId)}>
                        {endpointMap[epId]?.title}
                      </SubItem>
                    ))}
                  </Box>
                ))}
              </SidebarWrapper>
            )}

            {/* Main Content */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              {/* Overview */}
              <Box id="overview" sx={{ mb: 8, scrollMarginTop: "100px" }}>
                <Typography sx={{ fontSize: { xs: 24, md: 30 }, fontWeight: 500, fontFamily: "OutfitMedium", color: "text.primary", mb: 1.5 }}>
                  Overview
                </Typography>
                <Typography sx={{ fontSize: 15, fontFamily: "OutfitRegular", color: "text.secondary", lineHeight: 1.8, mb: 3 }}>
                  Dynopay provides a simple API to accept cryptocurrency payments, manage customer wallets, and track transactions. Payments are instantly forwarded to your configured wallet with transparent fees.
                </Typography>
                <InfoBox>
                  <Typography sx={{ fontSize: 14, fontFamily: "OutfitMedium", color: "text.primary", mb: 1 }}>Quick Integration</Typography>
                  <Typography sx={{ fontSize: 13, fontFamily: "OutfitRegular", color: "text.secondary", lineHeight: 1.7 }}>
                    Most integrations only need two API calls: <strong>Create Customer</strong> → <strong>Create Payment</strong>. The customer pays in crypto, and funds are forwarded instantly to your wallet.
                  </Typography>
                </InfoBox>
              </Box>

              {/* Getting Started */}
              <Box id="getting-started" sx={{ mb: 8, scrollMarginTop: "100px" }}>
                <Typography sx={{ fontSize: { xs: 24, md: 30 }, fontWeight: 500, fontFamily: "OutfitMedium", color: "text.primary", mb: 1.5 }}>
                  Getting Started
                </Typography>
                <Typography sx={{ fontSize: 15, fontFamily: "OutfitRegular", color: "text.secondary", lineHeight: 1.8, mb: 3 }}>
                  Integrate Dynopay in three simple steps:
                </Typography>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mb: 4 }}>
                  {[
                    { step: "1", title: "Get your API Key", desc: 'Go to your Dynopay dashboard → API section → "Create New Key". You\'ll receive an API key for authenticating requests.' },
                    { step: "2", title: "Create a Customer", desc: "Use the Create Customer endpoint to register your users. You'll get back a bearer token for that customer." },
                    { step: "3", title: "Create a Payment", desc: "Use the Checkout Payment or Direct Crypto Payment endpoint. The customer pays in crypto, funds forward instantly to your wallet." },
                  ].map((s) => (
                    <StepCard key={s.step}>
                      <StepNumber>{s.step}</StepNumber>
                      <Box>
                        <Typography sx={{ fontWeight: 500, fontFamily: "OutfitMedium", fontSize: 15, color: "text.primary", mb: 0.3 }}>{s.title}</Typography>
                        <Typography sx={{ fontSize: 14, fontFamily: "OutfitRegular", color: "text.secondary", lineHeight: 1.6 }}>{s.desc}</Typography>
                      </Box>
                    </StepCard>
                  ))}
                </Box>
                <Typography sx={{ fontSize: 13, fontWeight: 600, fontFamily: "OutfitSemiBold", color: "text.primary", mb: 1 }}>Quick Example</Typography>
                <CodeBlock
                  lang="bash"
                  code={`# Step 1: Create a customer
curl -X POST https://api.dynopay.com/api/user/createUser \\
  -H "x-api-key: your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{"name": "Jane Smith", "email": "jane@example.com"}'

# Step 2: Create a checkout payment (use the token from Step 1)
curl -X POST https://api.dynopay.com/api/user/createPayment \\
  -H "x-api-key: your_api_key" \\
  -H "Authorization: Bearer eyJhbGciOi..." \\
  -H "Content-Type: application/json" \\
  -d '{"amount": 50, "redirect_uri": "https://yoursite.com/thanks"}'`}
                />
              </Box>

              {/* Authentication */}
              <Box id="authentication" sx={{ mb: 8, scrollMarginTop: "100px" }}>
                <Typography sx={{ fontSize: { xs: 24, md: 30 }, fontWeight: 500, fontFamily: "OutfitMedium", color: "text.primary", mb: 1.5 }}>
                  Authentication
                </Typography>
                <Typography sx={{ fontSize: 15, fontFamily: "OutfitRegular", color: "text.secondary", lineHeight: 1.8, mb: 3 }}>
                  Dynopay uses two levels of authentication depending on the endpoint:
                </Typography>
                <Grid container spacing={2.5} sx={{ mb: 3 }}>
                  <Grid item xs={12} md={6}>
                    <AuthCard variant="blue">
                      <Typography sx={{ fontWeight: 500, fontFamily: "OutfitMedium", fontSize: 15, color: "#60A5FA", mb: 1 }}>API Key Only</Typography>
                      <Typography sx={{ fontSize: 13, fontFamily: "OutfitRegular", color: "text.secondary", lineHeight: 1.7, mb: 2 }}>
                        Used for creating customers and listing supported currencies. Only requires the <code style={{ background: dk ? "#1E2030" : "#E5E7EB", padding: "1px 5px", borderRadius: 4, fontSize: 12 }}>x-api-key</code> header.
                      </Typography>
                      <CodeBlock code="x-api-key: your_api_key" />
                    </AuthCard>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <AuthCard variant="purple">
                      <Typography sx={{ fontWeight: 500, fontFamily: "OutfitMedium", fontSize: 15, color: "#A78BFA", mb: 1 }}>API Key + Bearer Token</Typography>
                      <Typography sx={{ fontSize: 13, fontFamily: "OutfitRegular", color: "text.secondary", lineHeight: 1.7, mb: 2 }}>
                        Required for all payment and wallet operations. Include both the API key and a customer bearer token.
                      </Typography>
                      <CodeBlock code={`x-api-key: your_api_key\nAuthorization: Bearer eyJhbGciOi...`} />
                    </AuthCard>
                  </Grid>
                </Grid>
              </Box>

              {/* Endpoint Sections */}
              {SECTIONS.filter((s) => s.endpoints).map((section) => (
                <Box key={section.id} id={section.id} sx={{ mb: 8, scrollMarginTop: "100px" }}>
                  <Typography sx={{ fontSize: { xs: 24, md: 30 }, fontWeight: 500, fontFamily: "OutfitMedium", color: "text.primary", mb: 2.5 }}>
                    {section.title}
                  </Typography>
                  {section.endpoints!.map((epId) => {
                    const ep = endpointMap[epId];
                    return ep ? <EndpointCard key={ep.id} ep={ep} /> : null;
                  })}
                </Box>
              ))}

              {/* Error Handling */}
              <Box id="errors" sx={{ mb: 8, scrollMarginTop: "100px" }}>
                <Typography sx={{ fontSize: { xs: 24, md: 30 }, fontWeight: 500, fontFamily: "OutfitMedium", color: "text.primary", mb: 1.5 }}>
                  Error Handling
                </Typography>
                <Typography sx={{ fontSize: 15, fontFamily: "OutfitRegular", color: "text.secondary", lineHeight: 1.8, mb: 2.5 }}>
                  All errors follow a consistent format. Check the <code style={{ background: dk ? "#1E2030" : "#F3F4F6", padding: "1px 5px", borderRadius: 4, fontSize: 12 }}>success</code> field and the HTTP status code.
                </Typography>
                <CodeBlock lang="json" code={`{
  "success": false,
  "message": "Amount must be greater than or equal to 5",
  "errors": [{ "key": "amount", "error": "Invalid amount" }]
}`} />
                <TableWrapper>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: headBg }}>
                        <th style={{ textAlign: "left", padding: "10px 16px", fontWeight: 500, fontFamily: "OutfitMedium", color: dk ? "#C8CAD5" : "#374151", borderBottom: `1px solid ${borderClr}`, fontSize: 12 }}>Status</th>
                        <th style={{ textAlign: "left", padding: "10px 16px", fontWeight: 500, fontFamily: "OutfitMedium", color: dk ? "#C8CAD5" : "#374151", borderBottom: `1px solid ${borderClr}`, fontSize: 12 }}>Meaning</th>
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
                        <tr key={code} style={{ borderBottom: i < 4 ? `1px solid ${dk ? "#1E2030" : "#F3F4F6"}` : "none" }}>
                          <td style={{ padding: "10px 16px" }}>
                            <code style={{ fontWeight: 700, color: Number(code) >= 500 ? "#EF4444" : "#F59E0B", fontFamily: "'JetBrains Mono', monospace" }}>{code}</code>
                          </td>
                          <td style={{ padding: "10px 16px", color: dk ? "#A0A3B1" : "#374151", fontFamily: "OutfitRegular" }}>{desc}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableWrapper>
              </Box>

              {/* CTA */}
              <InfoBox sx={{ textAlign: "center", py: 5 }}>
                <Typography sx={{ fontSize: { xs: 22, md: 28 }, fontWeight: 500, fontFamily: "OutfitMedium", color: "text.primary", mb: 1.5 }}>
                  Ready to get started?
                </Typography>
                <Typography sx={{ fontSize: 15, fontFamily: "OutfitRegular", color: "text.secondary", mb: 3 }}>
                  Join merchants worldwide accepting crypto with Dynopay
                </Typography>
                <Box sx={{ display: "flex", gap: 2, justifyContent: "center", flexWrap: "wrap" }}>
                  <HomeButton variant="primary" label="Get your API Key" navigateTo="/auth/register" />
                  <HomeButton variant="outlined" label="View Fees" navigateTo="/fees" showIcon />
                </Box>
              </InfoBox>
            </Box>
          </Box>
        </Container>
      </PageWrapper>
    </>
  );
};

export default memo(DocumentationPage);
