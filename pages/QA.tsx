import React, { useState, useCallback, useEffect } from "react";
import Head from "next/head";
import {
  Box,
  Typography,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  LinearProgress,
  IconButton,
  Tooltip,
  Divider,
  TextField,
  InputAdornment,
} from "@mui/material";
import { styled, alpha, useTheme } from "@mui/material/styles";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import ErrorIcon from "@mui/icons-material/Error";
import SearchIcon from "@mui/icons-material/Search";
import useIsMobile from "@/hooks/useIsMobile";

/* ==================== TYPES ==================== */
type StepStatus = "pending" | "pass" | "fail";

interface TestStep {
  id: string;
  action: string;
  expected: string;
}

interface TestCase {
  id: string;
  title: string;
  priority: "Critical" | "High" | "Medium" | "Low";
  preconditions?: string;
  steps: TestStep[];
  notes?: string;
}

interface TestSection {
  id: string;
  title: string;
  icon: string;
  description: string;
  cases: TestCase[];
}

/* ==================== STYLED COMPONENTS ==================== */
const PageWrapper = styled(Box)(({ theme }) => ({
  width: "100%",
  minHeight: "100vh",
  backgroundColor: theme.palette.mode === "dark" ? "#0B0E11" : "#F8FAFC",
  paddingTop: 80,
  paddingBottom: 80,
}));

const Container = styled(Box)(({ theme }) => ({
  width: "100%",
  maxWidth: 1100,
  margin: "0 auto",
  paddingLeft: theme.spacing(2),
  paddingRight: theme.spacing(2),
}));

const SectionAccordion = styled(Accordion)(({ theme }) => ({
  background: theme.palette.mode === "dark" ? "#151921" : "#FFFFFF",
  borderRadius: "14px !important",
  border: `1px solid ${theme.palette.mode === "dark" ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}`,
  marginBottom: 12,
  "&:before": { display: "none" },
  overflow: "hidden",
  boxShadow: theme.palette.mode === "dark"
    ? "0 2px 8px rgba(0,0,0,0.3)"
    : "0 1px 4px rgba(0,0,0,0.04)",
}));

const StepRow = styled(Box)(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "36px 1fr 1fr 80px",
  gap: theme.spacing(1.5),
  alignItems: "flex-start",
  padding: "10px 0",
  borderBottom: `1px solid ${theme.palette.mode === "dark" ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)"}`,
  "&:last-child": { borderBottom: "none" },
  [theme.breakpoints.down("md")]: {
    gridTemplateColumns: "32px 1fr",
    gap: theme.spacing(1),
  },
}));


/* ==================== NOMADLY1 WALLET TEST DATA ==================== */
interface WalletTestData {
  walletId: number;
  type: string;
  address: string;
  balance: string;
  network: string;
}

const NOMADLY1_WALLETS: WalletTestData[] = [
  { walletId: 41,  type: "BTC",          address: "1JH5TnZzjYTf1yYwBDLjWoHgkAcCHc1Do7",                     balance: "0.0630 BTC",     network: "Bitcoin" },
  { walletId: 42,  type: "LTC",          address: "LM179QVx32QMtEzkhJZnvMdQgJfkAbf3fm",                      balance: "23.5502 LTC",    network: "Litecoin" },
  { walletId: 43,  type: "DOGE",         address: "DEReH1ES1zT8MUtkBQPqLqYGWrJhw2gCUL",                      balance: "84.2443 DOGE",   network: "Dogecoin" },
  { walletId: 45,  type: "ETH",          address: "0x9a7221b5e32d5f99e8da95585835442e29afb38f",                balance: "1.7800 ETH",     network: "Ethereum" },
  { walletId: 46,  type: "TRX",          address: "TTve8v6Y48ChsCTEiCjMRFSbjNtz4mAkxR",                      balance: "25.2750 TRX",    network: "Tron" },
  { walletId: 47,  type: "USDT-ERC20",   address: "0x9a7221b5e32d5f99e8da95585835442e29afb38f",                balance: "581.8425 USDT",  network: "Ethereum" },
  { walletId: 48,  type: "USDT-TRC20",   address: "TTve8v6Y48ChsCTEiCjMRFSbjNtz4mAkxR",                      balance: "1,809.6905 USDT", network: "Tron" },
  { walletId: 495, type: "USDC-ERC20",   address: "0x9a7221b5e32d5f99e8da95585835442e29afb38f",                balance: "0.0000 USDC",    network: "Ethereum" },
  { walletId: 518, type: "BCH",          address: "1JH5TnZzjYTf1yYwBDLjWoHgkAcCHc1Do7",                     balance: "0.0000 BCH",     network: "Bitcoin Cash" },
  { walletId: 519, type: "SOL",          address: "Gjjphdxe26tayH3PBQcqXYt3R2gt7phEdCAFfxZB63U8",             balance: "0.0000 SOL",     network: "Solana" },
  { walletId: 520, type: "XRP",          address: "rNxp4h8apvRis6mJf9Sh8C6iRxfrDWN7AV",                      balance: "0.0000 XRP",     network: "Ripple" },
  { walletId: 521, type: "POLYGON",      address: "0x9a7221b5e32d5f99e8da95585835442e29afb38f",                balance: "0.0000 MATIC",   network: "Polygon" },
  { walletId: 522, type: "RLUSD",        address: "rNxp4h8apvRis6mJf9Sh8C6iRxfrDWN7AV",                      balance: "0.0000 RLUSD",   network: "Ripple" },
  { walletId: 523, type: "USDT-POLYGON", address: "0x9a7221b5e32d5f99e8da95585835442e29afb38f",                balance: "0.0000 USDT",    network: "Polygon" },
  { walletId: 524, type: "RLUSD-ERC20",  address: "0x9a7221b5e32d5f99e8da95585835442e29afb38f",                balance: "0.0000 RLUSD",   network: "Ethereum" },
];


/* ==================== TEST DATA ==================== */
const TEST_SECTIONS: TestSection[] = [
  {
    id: "public",
    title: "Public Pages & Navigation",
    icon: "🌐",
    description: "Landing page, blog, fees, legal pages, SEO, system status",
    cases: [
      {
        id: "PUB-001",
        title: "Landing Page Load & Navigation",
        priority: "Critical",
        steps: [
          { id: "1", action: "Navigate to dynopay.com", expected: "Homepage loads with hero section, feature sections, pricing CTA, and footer. No console errors." },
          { id: "2", action: "Click all navbar links (Features, Pricing, Blog, Documentation, Login, Sign Up)", expected: "Each link navigates to the correct page without errors." },
          { id: "3", action: "Scroll through entire homepage", expected: "All sections render: Hero, Features, How It Works, Supported Cryptos, Pricing, CTA, Footer. Images load." },
          { id: "4", action: "Resize browser to mobile width (375px)", expected: "Mobile responsive layout activates. Hamburger menu appears. All sections stack vertically." },
          { id: "5", action: "Toggle dark/light mode (if available)", expected: "Theme switches correctly. All text remains readable. No broken contrast." },
        ],
      },
      {
        id: "PUB-002",
        title: "Blog Section",
        priority: "Medium",
        steps: [
          { id: "1", action: "Navigate to /blog", expected: "Blog listing page loads with all blog posts, each showing title, date, category, and excerpt." },
          { id: "2", action: "Click on a blog post", expected: "Blog detail page loads with full content, author info, published date, and social sharing buttons." },
          { id: "3", action: "Verify all blog dates", expected: "All dates show 2026 (not 2025). Example: 'Mar 7, 2026'." },
          { id: "4", action: "Click each social share button (X/Twitter, LinkedIn, Facebook, WhatsApp)", expected: "Each opens correct sharing URL in a new tab with pre-filled post title and URL." },
          { id: "5", action: "Navigate back to /blog from a post", expected: "Returns to blog listing. Browser back button also works." },
        ],
      },
      {
        id: "PUB-003",
        title: "Fees Page",
        priority: "Medium",
        steps: [
          { id: "1", action: "Navigate to /fees", expected: "Fees page loads with pricing tiers and fee calculator." },
          { id: "2", action: "Interact with fee calculator (enter amounts, select currencies)", expected: "Calculator shows correct fee breakdown (platform fee, blockchain fee, net amount)." },
          { id: "3", action: "Compare plan features table", expected: "All plan columns display correctly with check/cross icons." },
        ],
      },
      {
        id: "PUB-004",
        title: "SEO & Meta Tags",
        priority: "High",
        steps: [
          { id: "1", action: "View page source of homepage", expected: "Meta title, description, OG tags, and Twitter cards are present and correct." },
          { id: "2", action: "Navigate to /sitemap.xml", expected: "Valid XML sitemap with all public pages listed. Includes hreflang for i18n." },
          { id: "3", action: "Check /robots.txt", expected: "Robots.txt exists with proper Allow/Disallow rules and sitemap reference." },
        ],
      },
      {
        id: "PUB-005",
        title: "Legal & Policy Pages",
        priority: "Low",
        steps: [
          { id: "1", action: "Navigate to /privacy-policy", expected: "Privacy policy page loads with full content." },
          { id: "2", action: "Navigate to /terms-conditions", expected: "Terms & conditions page loads with full content." },
          { id: "3", action: "Navigate to /aml-policy", expected: "AML policy page loads with full content." },
        ],
      },
      {
        id: "PUB-006",
        title: "System Status Page",
        priority: "Medium",
        steps: [
          { id: "1", action: "Navigate to /system-status", expected: "Status page loads showing all service statuses (API Gateway, Payment Processing, Wallet, Webhook, Dashboard)." },
          { id: "2", action: "Verify real-time data", expected: "Statuses reflect actual service health from /api/status endpoint." },
        ],
      },
      {
        id: "PUB-007",
        title: "Help & Support / Knowledge Base",
        priority: "Low",
        steps: [
          { id: "1", action: "Navigate to /help-support", expected: "Help center loads with categorized articles." },
          { id: "2", action: "Click on an article", expected: "Article detail page loads with full content." },
        ],
      },
      {
        id: "PUB-008",
        title: "Documentation Page",
        priority: "Medium",
        steps: [
          { id: "1", action: "Navigate to /documentation", expected: "Developer documentation page loads with API reference sections." },
          { id: "2", action: "Verify code samples and endpoint descriptions", expected: "All code blocks render correctly. Endpoint paths match actual API routes." },
        ],
      },
    ],
  },
  {
    id: "auth",
    title: "Authentication & Onboarding",
    icon: "🔐",
    description: "Registration, login (email + OTP), Google sign-in, forgot password, 2FA, session management",
    cases: [
      {
        id: "AUTH-001",
        title: "Email + Password Registration",
        priority: "Critical",
        steps: [
          { id: "1", action: "Navigate to /auth/register", expected: "Registration form loads with Name, Email, Password fields, and Google sign-up option." },
          { id: "2", action: "Submit empty form", expected: "Validation errors shown for required fields." },
          { id: "3", action: "Enter invalid email format", expected: "'Invalid email' validation error shown." },
          { id: "4", action: "Enter weak password (< 8 chars)", expected: "Password strength validation error shown." },
          { id: "5", action: "Register with valid new email + password", expected: "OTP verification screen appears. Confirmation email sent." },
          { id: "6", action: "Enter correct OTP", expected: "Registration succeeds. User redirected to /dashboard. Welcome toast shown." },
          { id: "7", action: "Try registering with the same email again", expected: "'Email already registered' error message shown." },
        ],
      },
      {
        id: "AUTH-002",
        title: "Email + Password Login (with OTP)",
        priority: "Critical",
        steps: [
          { id: "1", action: "Navigate to /auth/login", expected: "Login form loads with Email and Password fields." },
          { id: "2", action: "Enter invalid credentials", expected: "Error message: 'Invalid email or password'." },
          { id: "3", action: "Enter valid credentials and submit", expected: "OTP verification screen appears. OTP sent to email." },
          { id: "4", action: "Enter wrong OTP", expected: "Error message: 'Invalid OTP'. Retry allowed." },
          { id: "5", action: "Enter correct OTP", expected: "Login succeeds. Redirected to /dashboard. Success toast shown." },
          { id: "6", action: "Click 'Resend OTP'", expected: "New OTP sent. Cooldown timer starts. Previous OTP invalidated." },
        ],
      },
      {
        id: "AUTH-003",
        title: "Google Sign-In (NEW USER)",
        priority: "Critical",
        preconditions: "Use a Google account not previously registered on DynoPay.",
        steps: [
          { id: "1", action: "Navigate to /auth/login and click 'Sign in with Google'", expected: "Google OAuth popup appears (or redirect to Google accounts)." },
          { id: "2", action: "Select/authenticate with Google account", expected: "Popup closes. Success toast appears. Brief success animation shown." },
          { id: "3", action: "Wait for redirect", expected: "User is redirected to /dashboard within ~1 second. Dashboard loads successfully." },
          { id: "4", action: "Verify dashboard loads fully (no redirect back to login)", expected: "Dashboard shows onboarding flow (no companies yet). Stats cards visible with 0 values. NO redirect back to /auth/login." },
          { id: "5", action: "Check browser console", expected: "No CSRF errors. No 403 cascades. Token stored in localStorage." },
          { id: "6", action: "Refresh the page", expected: "Dashboard reloads. User stays logged in." },
        ],
        notes: "This was a critical bug (CSRF cascade from business-logic 403). Verify fix thoroughly.",
      },
      {
        id: "AUTH-004",
        title: "Google Sign-In (EXISTING USER)",
        priority: "Critical",
        preconditions: "Use a Google account that has previously registered and set up a company.",
        steps: [
          { id: "1", action: "Navigate to /auth/login and click 'Sign in with Google'", expected: "Google OAuth popup appears." },
          { id: "2", action: "Authenticate with Google", expected: "Login succeeds. Redirected to /dashboard." },
          { id: "3", action: "Verify dashboard shows company data", expected: "Dashboard shows company stats, chart, recent transactions, fee tiers. All data loads." },
          { id: "4", action: "Navigate to other pages (Wallet, Transactions, Settings)", expected: "All pages load with user data. No auth errors." },
        ],
      },
      {
        id: "AUTH-005",
        title: "Forgot Password Flow",
        priority: "High",
        steps: [
          { id: "1", action: "Click 'Forgot Password' on login page", expected: "Forgot password form appears with email input." },
          { id: "2", action: "Enter registered email and submit", expected: "Password reset email sent. Success message shown." },
          { id: "3", action: "Click reset link in email", expected: "Redirected to /reset-password with valid token." },
          { id: "4", action: "Enter new password and confirm", expected: "Password reset succeeds. User can login with new password." },
        ],
      },
      {
        id: "AUTH-006",
        title: "Two-Factor Authentication (2FA) Setup",
        priority: "High",
        preconditions: "User is logged in. 2FA is not yet enabled.",
        steps: [
          { id: "1", action: "Go to Settings > Security > Enable 2FA", expected: "QR code displayed for authenticator app. Secret key shown." },
          { id: "2", action: "Scan QR code with Google Authenticator / Authy", expected: "App generates 6-digit TOTP codes." },
          { id: "3", action: "Enter generated code to verify setup", expected: "2FA enabled. Backup codes displayed. Prompt to save them." },
          { id: "4", action: "Log out and log back in", expected: "After password + OTP, additional 2FA prompt appears before dashboard access." },
          { id: "5", action: "Enter 2FA code", expected: "Login completes. Dashboard accessible." },
        ],
      },
      {
        id: "AUTH-007",
        title: "Session Management",
        priority: "Medium",
        preconditions: "User is logged in.",
        steps: [
          { id: "1", action: "Navigate to Settings > Sessions (or /api/user/sessions)", expected: "List of active sessions shown with device info, IP, and last active time." },
          { id: "2", action: "Revoke another session", expected: "Session removed from list. That device/browser is logged out." },
          { id: "3", action: "Click 'Revoke all other sessions'", expected: "All sessions except current one are revoked." },
        ],
      },
      {
        id: "AUTH-008",
        title: "Logout & Token Cleanup",
        priority: "High",
        steps: [
          { id: "1", action: "Click logout button", expected: "User is logged out. Redirected to /auth/login." },
          { id: "2", action: "Check localStorage", expected: "'token' and 'refreshToken' are removed." },
          { id: "3", action: "Try accessing /dashboard directly", expected: "Redirected to /auth/login (withAuth guard)." },
          { id: "4", action: "Press browser back button after logout", expected: "Does not show authenticated content. Redirected to login." },
        ],
      },
    ],
  },
  {
    id: "dashboard",
    title: "Dashboard",
    icon: "📊",
    description: "Main dashboard stats, charts, fee tiers, recent transactions, onboarding",
    cases: [
      {
        id: "DASH-001",
        title: "Dashboard Data Load",
        priority: "Critical",
        preconditions: "User is logged in with at least one company and wallet set up.",
        steps: [
          { id: "1", action: "Navigate to /dashboard", expected: "Dashboard loads with stat cards (Total Revenue, Transactions, Average, Pending)." },
          { id: "2", action: "Verify chart renders", expected: "Revenue/transaction chart displays with correct time period (default: 7d)." },
          { id: "3", action: "Change chart period (7d, 30d, 90d, etc.)", expected: "Chart updates with new data for selected period." },
          { id: "4", action: "Verify recent transactions table", expected: "Shows latest transactions with amount, status, date, crypto type." },
          { id: "5", action: "Verify fee tiers section", expected: "Current fee tier displayed based on transaction volume." },
        ],
      },
      {
        id: "DASH-002",
        title: "Company Switcher",
        priority: "High",
        preconditions: "User has multiple companies.",
        steps: [
          { id: "1", action: "Open company dropdown/switcher", expected: "All user's companies listed." },
          { id: "2", action: "Switch to a different company", expected: "Dashboard data refreshes for selected company. Stats, chart, transactions update." },
          { id: "3", action: "Verify URL/state persists on page refresh", expected: "Selected company remains active after refresh." },
        ],
      },
      {
        id: "DASH-003",
        title: "New User Onboarding Flow",
        priority: "High",
        preconditions: "Newly registered user with no companies or wallets.",
        steps: [
          { id: "1", action: "Login as new user", expected: "Dashboard shows onboarding wizard/checklist." },
          { id: "2", action: "Complete each onboarding step (Create company, Add wallet, etc.)", expected: "Each step marked as complete. Progress indicator updates." },
          { id: "3", action: "After all steps complete", expected: "Onboarding dismissed. Full dashboard shown with data." },
        ],
      },
    ],
  },
  {
    id: "company",
    title: "Company Management",
    icon: "🏢",
    description: "Create, edit, delete companies. Webhook settings, auto-convert, tax ID validation",
    cases: [
      {
        id: "COMP-001",
        title: "Create Company",
        priority: "Critical",
        steps: [
          { id: "1", action: "Navigate to /company (or 'Add Company' from sidebar)", expected: "Company creation form loads." },
          { id: "2", action: "Fill in company name, type, country, address", expected: "Form validates inputs in real-time." },
          { id: "3", action: "Submit the form", expected: "Company created successfully. Toast notification. Redirected to dashboard with new company selected." },
          { id: "4", action: "Verify company appears in company switcher", expected: "New company listed in dropdown." },
        ],
      },
      {
        id: "COMP-002",
        title: "Edit Company",
        priority: "High",
        steps: [
          { id: "1", action: "Navigate to company settings/edit page", expected: "Edit form pre-filled with current company data." },
          { id: "2", action: "Modify company name and save", expected: "Changes saved. Success toast. Updated name shown everywhere." },
        ],
      },
      {
        id: "COMP-003",
        title: "Webhook Settings",
        priority: "High",
        preconditions: "Company exists.",
        steps: [
          { id: "1", action: "Navigate to company webhook settings", expected: "Webhook configuration form loads (URL, secret, events)." },
          { id: "2", action: "Enter webhook URL and select events", expected: "Settings saved successfully." },
          { id: "3", action: "Click 'Test Webhook'", expected: "Test payload sent to webhook URL. Result shown (success/fail)." },
          { id: "4", action: "View webhook history", expected: "Webhook delivery log shows past deliveries with status, timestamp, response code." },
        ],
      },
      {
        id: "COMP-004",
        title: "Auto-Convert Settings",
        priority: "Medium",
        steps: [
          { id: "1", action: "Navigate to auto-convert settings for a company", expected: "Auto-convert toggle and configuration options load." },
          { id: "2", action: "Enable auto-convert to stablecoin (e.g., USDC)", expected: "Settings saved. Incoming crypto payments will auto-convert." },
          { id: "3", action: "View conversion history", expected: "Past conversions listed with amounts, rates, status." },
        ],
      },
      {
        id: "COMP-005",
        title: "Delete Company",
        priority: "Medium",
        steps: [
          { id: "1", action: "Click delete company", expected: "Confirmation dialog appears with warning." },
          { id: "2", action: "Confirm deletion", expected: "Company deleted. Removed from company list. Dashboard switches to another company or shows onboarding." },
        ],
      },
    ],
  },
  {
    id: "wallet",
    title: "Wallet Management",
    icon: "💰",
    description: "View wallets, add/edit/delete addresses (with OTP), transactions, network fees",
    cases: [
      {
        id: "WAL-001",
        title: "View Wallets",
        priority: "Critical",
        preconditions: "User has wallets set up.",
        steps: [
          { id: "1", action: "Navigate to /wallet", expected: "Wallet page loads showing FIAT and CRYPTO wallet balances." },
          { id: "2", action: "Click on a specific wallet (e.g., BTC, ETH)", expected: "Wallet detail view shows balance, addresses, and recent transactions." },
        ],
      },
      {
        id: "WAL-002",
        title: "Add Wallet Address (with OTP verification)",
        priority: "Critical",
        steps: [
          { id: "1", action: "Click 'Add Address' on a wallet", expected: "Address input form appears with crypto type selection." },
          { id: "2", action: "Enter a valid wallet address", expected: "Address validated (format check). Proceeds to OTP step." },
          { id: "3", action: "Enter OTP sent to email", expected: "Address added successfully. Appears in wallet address list." },
          { id: "4", action: "Enter an invalid wallet address format", expected: "Validation error: 'Invalid address format'." },
        ],
      },
      {
        id: "WAL-003",
        title: "Edit Wallet Address",
        priority: "High",
        steps: [
          { id: "1", action: "Click edit on an existing address", expected: "Edit form pre-filled with current address." },
          { id: "2", action: "Change the address and submit", expected: "OTP verification required. After OTP, address updated." },
        ],
      },
      {
        id: "WAL-004",
        title: "Delete Wallet Address",
        priority: "High",
        steps: [
          { id: "1", action: "Click delete on a wallet address", expected: "Confirmation prompt. OTP sent for verification." },
          { id: "2", action: "Enter OTP and confirm", expected: "Address deleted. Removed from list." },
        ],
      },
      {
        id: "WAL-005",
        title: "Transaction History & Export",
        priority: "High",
        steps: [
          { id: "1", action: "Navigate to /transactions", expected: "Full transaction list loads with filters (date range, status, crypto type)." },
          { id: "2", action: "Apply filters (e.g., last 30 days, only BTC)", expected: "List filters correctly. Count updates." },
          { id: "3", action: "Click on a transaction", expected: "Transaction detail modal/page shows full info (hash, confirmations, fees, timestamps)." },
          { id: "4", action: "Click 'Export' transactions", expected: "CSV/PDF download starts with filtered transaction data." },
        ],
      },
      {
        id: "WAL-006",
        title: "User Analytics (getUserAnalytics)",
        priority: "High",
        steps: [
          { id: "1", action: "Load dashboard after login", expected: "POST /api/wallet/getUserAnalytics returns 200 with analytics data." },
          { id: "2", action: "Check browser Network tab", expected: "Request includes Authorization: Bearer header. No CSRF errors." },
        ],
      },
    ],
  },
  {
    id: "paylinks",
    title: "Payment Links",
    icon: "🔗",
    description: "Create, view, manage, and share payment links",
    cases: [
      {
        id: "PAY-001",
        title: "Create Payment Link",
        priority: "Critical",
        preconditions: "Company and wallet set up.",
        steps: [
          { id: "1", action: "Navigate to /create-pay-link", expected: "Payment link creation form loads." },
          { id: "2", action: "Fill in amount, currency, description", expected: "Form validates inputs. Preview shown." },
          { id: "3", action: "Submit", expected: "Payment link created. Shareable URL generated. QR code displayed." },
          { id: "4", action: "Copy link to clipboard", expected: "Link copied. Toast notification." },
        ],
      },
      {
        id: "PAY-002",
        title: "View & Manage Payment Links",
        priority: "High",
        steps: [
          { id: "1", action: "Navigate to /pay-links", expected: "List of all payment links with status, amount, creation date." },
          { id: "2", action: "Click on a payment link", expected: "Detail page shows link info, QR code, payment status, and usage stats." },
          { id: "3", action: "Delete a payment link", expected: "Link deactivated. Confirmation dialog. Removed from list." },
        ],
      },
    ],
  },
  {
    id: "checkout",
    title: "Payment Checkout Flow (Customer-Facing)",
    icon: "💳",
    description: "Public checkout page, crypto selection, payment processing, success/failure states",
    cases: [
      {
        id: "CHK-001",
        title: "Checkout Page Load",
        priority: "Critical",
        preconditions: "Valid payment link exists.",
        steps: [
          { id: "1", action: "Open a payment link URL (as a customer)", expected: "Checkout page loads showing merchant name, amount, supported cryptocurrencies." },
          { id: "2", action: "Select a cryptocurrency (e.g., BTC)", expected: "Payment details shown: wallet address, amount in crypto, QR code, countdown timer." },
          { id: "3", action: "Verify fee display", expected: "Platform fee and blockchain fee clearly shown to customer." },
        ],
      },
      {
        id: "CHK-002",
        title: "Payment Processing States",
        priority: "Critical",
        steps: [
          { id: "1", action: "Navigate to /pay/payment-states-demo", expected: "Demo page loads showing all payment states." },
          { id: "2", action: "Verify each state renders: Waiting, Confirming, Underpaid, Overpaid, Completed, Expired, Failed", expected: "All state UIs render correctly with appropriate colors, icons, and messages." },
        ],
      },
      {
        id: "CHK-003",
        title: "Payment Success Flow",
        priority: "Critical",
        steps: [
          { id: "1", action: "Complete a test payment (or navigate to /payment/success)", expected: "Success page shows confirmation with transaction ID, amount, and merchant info." },
          { id: "2", action: "Check if webhook was triggered", expected: "Merchant webhook received payment confirmation payload." },
        ],
      },
      {
        id: "CHK-004",
        title: "Payment Failure / Expiry",
        priority: "High",
        steps: [
          { id: "1", action: "Let a payment expire (timeout)", expected: "Payment status changes to 'Expired'. Customer shown expiry message with retry option." },
          { id: "2", action: "Navigate to /payment/failed", expected: "Failure page loads with error details and retry/support options." },
        ],
      },
    ],
  },
  {
    id: "invoices",
    title: "Invoices",
    icon: "📄",
    description: "View, filter, and manage invoices",
    cases: [
      {
        id: "INV-001",
        title: "Invoice List & Details",
        priority: "High",
        preconditions: "User has invoices from past transactions.",
        steps: [
          { id: "1", action: "Navigate to /invoices", expected: "Invoice list loads with invoice number, date, amount, status." },
          { id: "2", action: "Click on an invoice", expected: "Invoice detail page/modal shows line items, tax, totals, payment status." },
          { id: "3", action: "Download invoice as PDF", expected: "PDF generated and downloaded with proper formatting." },
        ],
      },
    ],
  },
  {
    id: "devkeys",
    title: "Developer Keys & API Management",
    icon: "🔑",
    description: "API keys, rate limits, usage logs, customer management via API",
    cases: [
      {
        id: "DEV-001",
        title: "Create API Key",
        priority: "Critical",
        preconditions: "Company exists.",
        steps: [
          { id: "1", action: "Navigate to /developer-keys", expected: "API management page loads with existing keys (if any)." },
          { id: "2", action: "Click 'Create API Key'", expected: "Form appears for key name and permissions." },
          { id: "3", action: "Submit", expected: "API key generated. Secret shown ONCE. User prompted to copy/save it." },
          { id: "4", action: "Verify key appears in list", expected: "New key listed with name, creation date, and status (active)." },
        ],
      },
      {
        id: "DEV-002",
        title: "Manage API Keys",
        priority: "High",
        steps: [
          { id: "1", action: "Toggle API key status (enable/disable)", expected: "Key status changes. Disabled keys reject API requests." },
          { id: "2", action: "Regenerate API key", expected: "New secret generated. Old secret invalidated." },
          { id: "3", action: "Delete API key", expected: "Key revoked and removed from list." },
          { id: "4", action: "View API usage stats", expected: "Request counts, success/error rates, rate limit status shown." },
          { id: "5", action: "View API logs", expected: "Recent API calls listed with timestamp, endpoint, status code, IP." },
        ],
      },
      {
        id: "DEV-003",
        title: "Customer Management",
        priority: "Medium",
        steps: [
          { id: "1", action: "Navigate to /customers", expected: "Customer list loads with name, email, balance, transaction count." },
          { id: "2", action: "Click on a customer", expected: "Customer detail page shows profile, transaction history, balance." },
        ],
      },
    ],
  },
  {
    id: "notifications",
    title: "Notifications",
    icon: "🔔",
    description: "In-app notifications, read/unread, preferences, push notifications",
    cases: [
      {
        id: "NOTIF-001",
        title: "Notification List & Actions",
        priority: "Medium",
        steps: [
          { id: "1", action: "Navigate to /notifications (or click bell icon)", expected: "Notification list loads with recent notifications. Unread count badge shown." },
          { id: "2", action: "Click a notification", expected: "Notification marked as read. Detail or linked page opens." },
          { id: "3", action: "Click 'Mark All as Read'", expected: "All notifications marked as read. Unread count resets to 0." },
          { id: "4", action: "Delete a notification", expected: "Notification removed from list." },
        ],
      },
      {
        id: "NOTIF-002",
        title: "Notification Preferences",
        priority: "Low",
        steps: [
          { id: "1", action: "Navigate to notification preferences (Settings or /notifications preferences)", expected: "Preference toggles load for email, push, and in-app notifications by type." },
          { id: "2", action: "Toggle off a notification type", expected: "Preference saved. That notification type no longer sent." },
        ],
      },
    ],
  },
  {
    id: "settings",
    title: "Settings & Profile",
    icon: "⚙️",
    description: "Profile updates, email/phone changes, password, 2FA, account deletion",
    cases: [
      {
        id: "SET-001",
        title: "Profile Update",
        priority: "High",
        steps: [
          { id: "1", action: "Navigate to /profile or /settings", expected: "Profile page loads with current user info (name, email, phone, photo)." },
          { id: "2", action: "Update display name", expected: "Name saved. Updated in sidebar and profile page." },
          { id: "3", action: "Upload new profile photo", expected: "Photo uploaded and displayed." },
        ],
      },
      {
        id: "SET-002",
        title: "Change Email",
        priority: "High",
        steps: [
          { id: "1", action: "Click 'Change Email' in settings", expected: "Email change form appears." },
          { id: "2", action: "Enter new email and submit", expected: "OTP sent to new email for verification." },
          { id: "3", action: "Verify OTP", expected: "Email updated. Confirmation shown." },
        ],
      },
      {
        id: "SET-003",
        title: "Change Phone Number",
        priority: "Medium",
        steps: [
          { id: "1", action: "Click 'Change Phone' in settings", expected: "Phone change form appears." },
          { id: "2", action: "Enter new phone and verify via OTP", expected: "Phone updated successfully." },
        ],
      },
      {
        id: "SET-004",
        title: "Login History",
        priority: "Low",
        steps: [
          { id: "1", action: "Navigate to login history", expected: "List of past logins with date, IP, device, and location." },
        ],
      },
      {
        id: "SET-005",
        title: "Delete Account",
        priority: "Medium",
        steps: [
          { id: "1", action: "Navigate to account deletion in settings", expected: "Delete account option with warning message." },
          { id: "2", action: "Confirm deletion", expected: "Account deleted. User logged out. Cannot login again with same credentials." },
        ],
      },
    ],
  },
  {
    id: "referrals",
    title: "Referral Program",
    icon: "🎁",
    description: "Referral code, sharing, tracking referrals, earnings, leaderboard",
    cases: [
      {
        id: "REF-001",
        title: "Referral Code & Sharing",
        priority: "Medium",
        steps: [
          { id: "1", action: "Navigate to /referrals", expected: "Referral page loads with user's unique referral code and sharing options." },
          { id: "2", action: "Copy referral link", expected: "Link copied to clipboard. Toast notification." },
          { id: "3", action: "View referral list", expected: "List of referred users with status and reward info." },
          { id: "4", action: "Check referral earnings", expected: "Total earnings from referrals displayed." },
        ],
      },
      {
        id: "REF-002",
        title: "Apply Referral Code (During Registration)",
        priority: "Medium",
        steps: [
          { id: "1", action: "During registration, enter a valid referral code", expected: "Referral validated. Discount or bonus applied." },
          { id: "2", action: "Enter an invalid referral code", expected: "Error: 'Invalid referral code'." },
        ],
      },
    ],
  },
  {
    id: "subscriptions",
    title: "Subscriptions",
    icon: "🔄",
    description: "Create, view, update, and cancel recurring payment subscriptions",
    cases: [
      {
        id: "SUB-001",
        title: "Subscription CRUD",
        priority: "Medium",
        steps: [
          { id: "1", action: "Create a new subscription (set amount, interval, customer)", expected: "Subscription created. Listed in subscription management." },
          { id: "2", action: "View subscription details", expected: "Shows recurring amount, interval, next charge date, status." },
          { id: "3", action: "Update subscription (change amount or interval)", expected: "Changes saved. Next charge reflects update." },
          { id: "4", action: "Cancel subscription", expected: "Subscription cancelled. Status changes to 'cancelled'. No further charges." },
        ],
      },
    ],
  },
  {
    id: "merchantapi",
    title: "Merchant API (External Integration)",
    icon: "🔌",
    description: "Server-to-server API: create users, create payments, crypto payments, balances",
    cases: [
      {
        id: "MAPI-001",
        title: "Create User via API",
        priority: "High",
        preconditions: "Valid API key with appropriate permissions.",
        steps: [
          { id: "1", action: "POST /api/merchant/createUser with valid API key and user data", expected: "201 response with user ID and details." },
          { id: "2", action: "POST without API key", expected: "401 Unauthorized response." },
          { id: "3", action: "POST with invalid data", expected: "400 Bad Request with validation errors." },
        ],
      },
      {
        id: "MAPI-002",
        title: "Create Payment via API",
        priority: "Critical",
        steps: [
          { id: "1", action: "POST /api/merchant/createPayment with amount, currency, callback_url", expected: "200 response with payment_id, checkout_url, and payment address." },
          { id: "2", action: "Open checkout_url in browser", expected: "Customer checkout page loads for this payment." },
          { id: "3", action: "GET /api/merchant/getBalance with API key", expected: "200 response with current balances per currency." },
        ],
      },
      {
        id: "MAPI-003",
        title: "Webhook Delivery for API Payments",
        priority: "High",
        steps: [
          { id: "1", action: "Complete a payment created via API", expected: "Webhook fires to configured callback_url with payment status." },
          { id: "2", action: "Verify webhook payload signature", expected: "HMAC signature matches using webhook secret." },
        ],
      },
    ],
  },
  {
    id: "admin",
    title: "Admin Panel",
    icon: "🛡️",
    description: "Admin login, wallet management, fee configuration, withdrawals, analytics",
    cases: [
      {
        id: "ADM-001",
        title: "Admin Login",
        priority: "Critical",
        steps: [
          { id: "1", action: "Navigate to /admin/login", expected: "Admin login form loads." },
          { id: "2", action: "Enter admin credentials", expected: "Admin dashboard loads." },
          { id: "3", action: "Enter wrong credentials", expected: "Error message shown. Login denied." },
        ],
      },
      {
        id: "ADM-002",
        title: "Admin Dashboard & Management",
        priority: "High",
        steps: [
          { id: "1", action: "Navigate to /admin (admin dashboard)", expected: "Admin overview loads with system stats." },
          { id: "2", action: "Navigate to /admin/wallet", expected: "Wallet management page with all system wallets." },
          { id: "3", action: "Navigate to /admin/fee", expected: "Fee configuration page. Can view/edit fee tiers." },
          { id: "4", action: "Navigate to /admin/withdraw", expected: "Withdrawal management page." },
          { id: "5", action: "Navigate to /admin/transferSpeed", expected: "Transfer speed configuration page." },
        ],
      },
    ],
  },
  {
    id: "i18n",
    title: "Internationalization (i18n)",
    icon: "🌍",
    description: "Multi-language support, locale switching",
    cases: [
      {
        id: "I18N-001",
        title: "Language Switching",
        priority: "Medium",
        steps: [
          { id: "1", action: "Find language selector (footer or settings)", expected: "Dropdown/buttons for available languages." },
          { id: "2", action: "Switch to French (fr)", expected: "All UI text changes to French. Layout adjusts for text length." },
          { id: "3", action: "Switch to Spanish (es)", expected: "UI text in Spanish." },
          { id: "4", action: "Refresh page", expected: "Selected language persists across page refresh." },
          { id: "5", action: "Navigate between pages", expected: "Language stays consistent across all pages." },
        ],
      },
    ],
  },
  {
    id: "crosscut",
    title: "Cross-Cutting Concerns",
    icon: "🔀",
    description: "Error handling, rate limiting, CORS, CSRF, responsive design, accessibility",
    cases: [
      {
        id: "CC-001",
        title: "Error Handling & Edge Cases",
        priority: "High",
        steps: [
          { id: "1", action: "Navigate to a non-existent URL (e.g., /xyz123)", expected: "Custom 404 page displayed (not generic Next.js error)." },
          { id: "2", action: "Disconnect internet and try an API action", expected: "Graceful error message: 'Network error. Please check your connection.'" },
          { id: "3", action: "Send rapid repeated requests (button mashing)", expected: "UI debounces/disables button. Rate limiter responds with 429 if needed." },
        ],
      },
      {
        id: "CC-002",
        title: "CSRF Protection",
        priority: "High",
        steps: [
          { id: "1", action: "Verify POST requests include Authorization: Bearer header", expected: "All authenticated POST requests include the token. CSRF middleware skips them." },
          { id: "2", action: "Make a POST request without Bearer token (e.g., from curl)", expected: "403 CSRF token validation failed." },
        ],
      },
      {
        id: "CC-003",
        title: "Responsive Design",
        priority: "Medium",
        steps: [
          { id: "1", action: "Test on iPhone viewport (375x667)", expected: "All pages render correctly. No horizontal scroll. Touch targets >= 44px." },
          { id: "2", action: "Test on iPad viewport (768x1024)", expected: "Tablet layout activates. Sidebar collapses to hamburger." },
          { id: "3", action: "Test on desktop (1920x1080)", expected: "Full desktop layout. Sidebar visible. Charts scale properly." },
        ],
      },
      {
        id: "CC-004",
        title: "Performance Checks",
        priority: "Low",
        steps: [
          { id: "1", action: "Run Lighthouse audit on homepage", expected: "Performance > 80. No critical render-blocking resources." },
          { id: "2", action: "Check API response times in Network tab", expected: "API responses < 2s for dashboard, < 500ms for simple queries." },
        ],
      },
    ],
  },
];

/* ==================== PRIORITY COLORS ==================== */
const PRIORITY_COLORS: Record<string, string> = {
  Critical: "#EF4444",
  High: "#F59E0B",
  Medium: "#3B82F6",
  Low: "#6B7280",
};

/* ==================== COMPONENT ==================== */
const QAPage = () => {
  const theme = useTheme();
  const isMobile = useIsMobile("md");
  const isDark = theme.palette.mode === "dark";

  const [stepStatuses, setStepStatuses] = useState<Record<string, StepStatus>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedSections, setExpandedSections] = useState<string[]>([]);

  // Load saved progress from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("qa_progress");
      if (saved) {
        try { setStepStatuses(JSON.parse(saved)); } catch { /* ignore */ }
      }
    }
  }, []);

  // Save progress to localStorage
  useEffect(() => {
    if (typeof window !== "undefined" && Object.keys(stepStatuses).length > 0) {
      localStorage.setItem("qa_progress", JSON.stringify(stepStatuses));
    }
  }, [stepStatuses]);

  const toggleStepStatus = useCallback((key: string) => {
    setStepStatuses((prev) => {
      const current = prev[key] || "pending";
      const next: StepStatus = current === "pending" ? "pass" : current === "pass" ? "fail" : "pending";
      return { ...prev, [key]: next };
    });
  }, []);

  // Calculate progress
  const totalSteps = TEST_SECTIONS.reduce((acc, s) => acc + s.cases.reduce((a, c) => a + c.steps.length, 0), 0);
  const passedSteps = Object.values(stepStatuses).filter((s) => s === "pass").length;
  const failedSteps = Object.values(stepStatuses).filter((s) => s === "fail").length;
  const testedSteps = passedSteps + failedSteps;
  const progressPercent = totalSteps > 0 ? (testedSteps / totalSteps) * 100 : 0;

  // Search filtering
  const filteredSections = searchQuery.trim()
    ? TEST_SECTIONS.map((section) => ({
        ...section,
        cases: section.cases.filter(
          (c) =>
            c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.steps.some(
              (s) =>
                s.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
                s.expected.toLowerCase().includes(searchQuery.toLowerCase())
            )
        ),
      })).filter((s) => s.cases.length > 0)
    : TEST_SECTIONS;

  const totalCases = TEST_SECTIONS.reduce((acc, s) => acc + s.cases.length, 0);

  const renderStatusIcon = (key: string) => {
    const status = stepStatuses[key] || "pending";
    if (status === "pass") return <CheckCircleIcon sx={{ color: "#22C55E", fontSize: 22 }} />;
    if (status === "fail") return <ErrorIcon sx={{ color: "#EF4444", fontSize: 22 }} />;
    return <RadioButtonUncheckedIcon sx={{ color: isDark ? "#4B5563" : "#D1D5DB", fontSize: 22 }} />;
  };

  return (
    <>
      <Head>
        <title>QA Test Plan — DynoPay</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <PageWrapper>
        <Container>
          {/* Header */}
          <Box sx={{ textAlign: "center", mb: 5 }}>
            <Typography
              component="h1"
              sx={{
                fontSize: isMobile ? 28 : 42,
                fontFamily: "OutfitSemibold",
                color: "text.primary",
                mb: 1,
              }}
            >
              DynoPay QA Test Plan
            </Typography>
            <Typography sx={{ color: "text.secondary", fontSize: 15, mb: 3, maxWidth: 640, mx: "auto" }}>
              Comprehensive step-by-step functionality tests covering all features.
              Click the circle to toggle each step: ⚪ Pending → ✅ Pass → ❌ Fail. Progress is saved in your browser.
            </Typography>

            {/* Progress bar */}
            <Box
              sx={{
                maxWidth: 600,
                mx: "auto",
                p: 2.5,
                borderRadius: 3,
                bgcolor: isDark ? "#151921" : "#FFF",
                border: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}`,
              }}
            >
              <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
                <Typography sx={{ fontSize: 13, fontFamily: "UrbanistSemibold", color: "text.secondary" }}>
                  Overall Progress
                </Typography>
                <Typography sx={{ fontSize: 13, fontFamily: "UrbanistSemibold", color: "text.primary" }}>
                  {testedSteps} / {totalSteps} steps ({progressPercent.toFixed(0)}%)
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={progressPercent}
                sx={{
                  height: 8,
                  borderRadius: 4,
                  bgcolor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
                  "& .MuiLinearProgress-bar": {
                    borderRadius: 4,
                    background: failedSteps > 0
                      ? "linear-gradient(90deg, #22C55E, #F59E0B)"
                      : "linear-gradient(90deg, #22C55E, #3B82F6)",
                  },
                }}
              />
              <Box sx={{ display: "flex", gap: 3, mt: 1.5, justifyContent: "center" }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: "#22C55E" }} />
                  <Typography sx={{ fontSize: 12, color: "text.secondary" }}>{passedSteps} Passed</Typography>
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: "#EF4444" }} />
                  <Typography sx={{ fontSize: 12, color: "text.secondary" }}>{failedSteps} Failed</Typography>
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: isDark ? "#4B5563" : "#D1D5DB" }} />
                  <Typography sx={{ fontSize: 12, color: "text.secondary" }}>{totalSteps - testedSteps} Pending</Typography>
                </Box>
              </Box>
            </Box>

            {/* Stats chips */}
            <Box sx={{ display: "flex", gap: 1, justifyContent: "center", mt: 2, flexWrap: "wrap" }}>
              <Chip label={`${filteredSections.length} Sections`} size="small" sx={{ fontFamily: "UrbanistSemibold", fontSize: 12 }} />
              <Chip label={`${totalCases} Test Cases`} size="small" sx={{ fontFamily: "UrbanistSemibold", fontSize: 12 }} />
              <Chip label={`${totalSteps} Steps`} size="small" sx={{ fontFamily: "UrbanistSemibold", fontSize: 12 }} />
            </Box>

            {/* Search */}
            <Box sx={{ maxWidth: 460, mx: "auto", mt: 3 }}>
              <TextField
                fullWidth
                size="small"
                placeholder="Search test cases..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ color: "text.secondary", fontSize: 20 }} />
                    </InputAdornment>
                  ),
                  sx: {
                    borderRadius: 2.5,
                    fontSize: 14,
                    bgcolor: isDark ? "#1A1F2B" : "#F1F5F9",
                  },
                }}
              />
            </Box>
          </Box>

          {/* Nomadly1 Wallet Test Data Reference */}
          <SectionAccordion
            expanded={expandedSections.includes("wallet-data")}
            onChange={(_, expanded) => {
              setExpandedSections((prev) =>
                expanded ? [...prev, "wallet-data"] : prev.filter((id) => id !== "wallet-data")
              );
            }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, width: "100%" }}>
                <Typography sx={{ fontSize: 22 }}>🧪</Typography>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontFamily: "UrbanistSemibold", fontSize: 16, color: "text.primary" }}>
                    Test Data — Nomadly1 Wallet Addresses
                  </Typography>
                  <Typography sx={{ fontSize: 12, color: "text.secondary", mt: 0.2 }}>
                    15 saved wallet addresses for the Nomadly1 company (company_id: 3). Use these to verify wallet display, payment routing, and address management.
                  </Typography>
                </Box>
                <Chip
                  label="15 wallets"
                  size="small"
                  sx={{ fontSize: 11, fontFamily: "UrbanistSemibold", bgcolor: alpha("#8B5CF6", 0.12), color: "#8B5CF6", mr: 1 }}
                />
              </Box>
            </AccordionSummary>
            <AccordionDetails sx={{ pt: 0, overflowX: "auto" }}>
              {/* Table header */}
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: isMobile ? "1fr" : "60px 120px 1fr 130px 110px",
                  gap: 1,
                  py: 1,
                  borderBottom: `2px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`,
                  minWidth: isMobile ? "auto" : 750,
                }}
              >
                {!isMobile && (
                  <>
                    <Typography sx={{ fontSize: 10, color: "text.secondary", fontFamily: "UrbanistSemibold", textTransform: "uppercase" }}>ID</Typography>
                    <Typography sx={{ fontSize: 10, color: "text.secondary", fontFamily: "UrbanistSemibold", textTransform: "uppercase" }}>Type</Typography>
                    <Typography sx={{ fontSize: 10, color: "text.secondary", fontFamily: "UrbanistSemibold", textTransform: "uppercase" }}>Address</Typography>
                    <Typography sx={{ fontSize: 10, color: "text.secondary", fontFamily: "UrbanistSemibold", textTransform: "uppercase" }}>Balance</Typography>
                    <Typography sx={{ fontSize: 10, color: "text.secondary", fontFamily: "UrbanistSemibold", textTransform: "uppercase" }}>Network</Typography>
                  </>
                )}
              </Box>
              {/* Wallet rows */}
              {NOMADLY1_WALLETS.map((w) => (
                <Box
                  key={w.walletId}
                  sx={{
                    display: "grid",
                    gridTemplateColumns: isMobile ? "1fr" : "60px 120px 1fr 130px 110px",
                    gap: 1,
                    py: 1.2,
                    borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)"}`,
                    minWidth: isMobile ? "auto" : 750,
                    "&:hover": { bgcolor: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.015)" },
                  }}
                >
                  {isMobile ? (
                    <Box>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                        <Chip label={w.type} size="small" sx={{ fontSize: 11, fontFamily: "monospace", fontWeight: 700, height: 22 }} />
                        <Typography sx={{ fontSize: 11, color: "text.secondary" }}>{w.network}</Typography>
                        <Typography sx={{ fontSize: 11, fontFamily: "UrbanistSemibold", color: parseFloat(w.balance) > 0 ? "#22C55E" : "text.secondary", ml: "auto" }}>
                          {w.balance}
                        </Typography>
                      </Box>
                      <Typography
                        sx={{
                          fontSize: 11,
                          fontFamily: "monospace",
                          color: "text.secondary",
                          wordBreak: "break-all",
                          cursor: "pointer",
                          "&:hover": { color: "primary.main" },
                        }}
                        onClick={() => { navigator.clipboard?.writeText(w.address); }}
                      >
                        {w.address}
                      </Typography>
                    </Box>
                  ) : (
                    <>
                      <Typography sx={{ fontSize: 12, color: "text.secondary", fontFamily: "monospace" }}>{w.walletId}</Typography>
                      <Chip label={w.type} size="small" sx={{ fontSize: 11, fontFamily: "monospace", fontWeight: 700, height: 22, justifySelf: "start" }} />
                      <Tooltip title="Click to copy" arrow>
                        <Typography
                          sx={{
                            fontSize: 12,
                            fontFamily: "monospace",
                            color: "text.secondary",
                            wordBreak: "break-all",
                            cursor: "pointer",
                            "&:hover": { color: "primary.main" },
                          }}
                          onClick={() => { navigator.clipboard?.writeText(w.address); }}
                        >
                          {w.address}
                        </Typography>
                      </Tooltip>
                      <Typography
                        sx={{
                          fontSize: 12,
                          fontFamily: "UrbanistSemibold",
                          color: parseFloat(w.balance.replace(",", "")) > 0 ? "#22C55E" : "text.secondary",
                        }}
                      >
                        {w.balance}
                      </Typography>
                      <Typography sx={{ fontSize: 12, color: "text.secondary" }}>{w.network}</Typography>
                    </>
                  )}
                </Box>
              ))}
              <Box sx={{ mt: 2, p: 1.5, borderRadius: 2, bgcolor: isDark ? alpha("#3B82F6", 0.06) : alpha("#3B82F6", 0.04), border: `1px solid ${alpha("#3B82F6", 0.12)}` }}>
                <Typography sx={{ fontSize: 12, color: "#3B82F6", fontFamily: "UrbanistSemibold" }}>
                  💡 Click any address to copy it. Green balances indicate wallets with funds available for transaction testing.
                  Shared EVM addresses (ETH, USDT-ERC20, USDC-ERC20, POLYGON, USDT-POLYGON, RLUSD-ERC20) all use the same address: 0x9a72...b38f
                </Typography>
              </Box>
            </AccordionDetails>
          </SectionAccordion>

          {/* Test Sections */}
          {filteredSections.map((section) => (
            <SectionAccordion
              key={section.id}
              expanded={expandedSections.includes(section.id)}
              onChange={(_, expanded) => {
                setExpandedSections((prev) =>
                  expanded ? [...prev, section.id] : prev.filter((id) => id !== section.id)
                );
              }}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, width: "100%" }}>
                  <Typography sx={{ fontSize: 22 }}>{section.icon}</Typography>
                  <Box sx={{ flex: 1 }}>
                    <Typography sx={{ fontFamily: "UrbanistSemibold", fontSize: 16, color: "text.primary" }}>
                      {section.title}
                    </Typography>
                    <Typography sx={{ fontSize: 12, color: "text.secondary", mt: 0.2 }}>
                      {section.description} — {section.cases.length} test cases
                    </Typography>
                  </Box>
                  {/* Section mini progress */}
                  {(() => {
                    const sectionSteps = section.cases.flatMap((c) => c.steps.map((s) => `${c.id}-${s.id}`));
                    const sectionPassed = sectionSteps.filter((k) => stepStatuses[k] === "pass").length;
                    const sectionTested = sectionSteps.filter((k) => stepStatuses[k] === "pass" || stepStatuses[k] === "fail").length;
                    return sectionTested > 0 ? (
                      <Chip
                        label={`${sectionPassed}/${sectionSteps.length}`}
                        size="small"
                        sx={{
                          fontSize: 11,
                          fontFamily: "UrbanistSemibold",
                          bgcolor: sectionPassed === sectionSteps.length ? alpha("#22C55E", 0.15) : alpha("#3B82F6", 0.1),
                          color: sectionPassed === sectionSteps.length ? "#22C55E" : "#3B82F6",
                          mr: 1,
                        }}
                      />
                    ) : null;
                  })()}
                </Box>
              </AccordionSummary>
              <AccordionDetails sx={{ pt: 0 }}>
                {section.cases.map((testCase, caseIdx) => (
                  <Box key={testCase.id} sx={{ mb: caseIdx < section.cases.length - 1 ? 3 : 0 }}>
                    {/* Case header */}
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
                      <Chip
                        label={testCase.id}
                        size="small"
                        sx={{
                          fontFamily: "monospace",
                          fontSize: 11,
                          fontWeight: 700,
                          bgcolor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                        }}
                      />
                      <Typography sx={{ fontFamily: "UrbanistSemibold", fontSize: 14, color: "text.primary", flex: 1 }}>
                        {testCase.title}
                      </Typography>
                      <Chip
                        label={testCase.priority}
                        size="small"
                        sx={{
                          fontSize: 10,
                          fontFamily: "UrbanistSemibold",
                          bgcolor: alpha(PRIORITY_COLORS[testCase.priority], 0.12),
                          color: PRIORITY_COLORS[testCase.priority],
                          height: 22,
                        }}
                      />
                    </Box>

                    {/* Preconditions */}
                    {testCase.preconditions && (
                      <Box
                        sx={{
                          mb: 1.5,
                          p: 1.5,
                          borderRadius: 2,
                          bgcolor: isDark ? alpha("#F59E0B", 0.06) : alpha("#F59E0B", 0.05),
                          border: `1px solid ${alpha("#F59E0B", 0.15)}`,
                        }}
                      >
                        <Typography sx={{ fontSize: 12, color: "#F59E0B", fontFamily: "UrbanistSemibold" }}>
                          ⚠️ Preconditions: {testCase.preconditions}
                        </Typography>
                      </Box>
                    )}

                    {/* Notes */}
                    {testCase.notes && (
                      <Box
                        sx={{
                          mb: 1.5,
                          p: 1.5,
                          borderRadius: 2,
                          bgcolor: isDark ? alpha("#EF4444", 0.06) : alpha("#EF4444", 0.05),
                          border: `1px solid ${alpha("#EF4444", 0.15)}`,
                        }}
                      >
                        <Typography sx={{ fontSize: 12, color: "#EF4444", fontFamily: "UrbanistSemibold" }}>
                          📌 {testCase.notes}
                        </Typography>
                      </Box>
                    )}

                    {/* Column headers (desktop only) */}
                    {!isMobile && (
                      <StepRow sx={{ borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`, py: 0.5 }}>
                        <Typography sx={{ fontSize: 10, color: "text.secondary", fontFamily: "UrbanistSemibold", textTransform: "uppercase" }}>
                          #
                        </Typography>
                        <Typography sx={{ fontSize: 10, color: "text.secondary", fontFamily: "UrbanistSemibold", textTransform: "uppercase" }}>
                          Action
                        </Typography>
                        <Typography sx={{ fontSize: 10, color: "text.secondary", fontFamily: "UrbanistSemibold", textTransform: "uppercase" }}>
                          Expected Result
                        </Typography>
                        <Typography sx={{ fontSize: 10, color: "text.secondary", fontFamily: "UrbanistSemibold", textTransform: "uppercase", textAlign: "center" }}>
                          Status
                        </Typography>
                      </StepRow>
                    )}

                    {/* Steps */}
                    {testCase.steps.map((step) => {
                      const stepKey = `${testCase.id}-${step.id}`;
                      return isMobile ? (
                        <Box key={step.id} sx={{ display: "flex", gap: 1, py: 1.2, borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)"}` }}>
                          <Tooltip title="Click to toggle status" arrow>
                            <IconButton size="small" onClick={() => toggleStepStatus(stepKey)} sx={{ mt: 0.2 }}>
                              {renderStatusIcon(stepKey)}
                            </IconButton>
                          </Tooltip>
                          <Box sx={{ flex: 1 }}>
                            <Typography sx={{ fontSize: 13, color: "text.primary", fontFamily: "UrbanistSemibold", mb: 0.5 }}>
                              Step {step.id}: {step.action}
                            </Typography>
                            <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
                              → {step.expected}
                            </Typography>
                          </Box>
                        </Box>
                      ) : (
                        <StepRow key={step.id}>
                          <Typography sx={{ fontSize: 12, color: "text.secondary", fontFamily: "UrbanistSemibold", pt: 0.3 }}>
                            {step.id}
                          </Typography>
                          <Typography sx={{ fontSize: 13, color: "text.primary", lineHeight: 1.5 }}>
                            {step.action}
                          </Typography>
                          <Typography sx={{ fontSize: 13, color: "text.secondary", lineHeight: 1.5 }}>
                            {step.expected}
                          </Typography>
                          <Box sx={{ textAlign: "center" }}>
                            <Tooltip title="Click to toggle: Pending → Pass → Fail" arrow>
                              <IconButton size="small" onClick={() => toggleStepStatus(stepKey)}>
                                {renderStatusIcon(stepKey)}
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </StepRow>
                      );
                    })}

                    {caseIdx < section.cases.length - 1 && (
                      <Divider sx={{ mt: 2, borderColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)" }} />
                    )}
                  </Box>
                ))}
              </AccordionDetails>
            </SectionAccordion>
          ))}

          {/* Footer */}
          <Box sx={{ textAlign: "center", mt: 5 }}>
            <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
              DynoPay QA Test Plan • {totalCases} Test Cases • {totalSteps} Steps • Last Updated: March 2026
            </Typography>
            <Typography
              component="button"
              onClick={() => {
                if (confirm("Reset all test progress? This cannot be undone.")) {
                  setStepStatuses({});
                  localStorage.removeItem("qa_progress");
                }
              }}
              sx={{
                fontSize: 12,
                color: "#EF4444",
                mt: 1,
                cursor: "pointer",
                background: "none",
                border: "none",
                textDecoration: "underline",
                fontFamily: "inherit",
                "&:hover": { opacity: 0.8 },
              }}
            >
              Reset All Progress
            </Typography>
          </Box>
        </Container>
      </PageWrapper>
    </>
  );
};

export default QAPage;

// Make this page publicly accessible with the home layout (no auth required)
(QAPage as any).layout = "home";
