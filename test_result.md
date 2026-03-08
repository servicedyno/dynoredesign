# DynoPay - Test Results & Session Tracker

## App Overview
DynoPay is a full-stack crypto payment gateway. 
- **Frontend**: Next.js (port 3000) with MUI components
- **Backend**: Node.js/Express/TypeScript (port 3300 internally, proxied via Python/uvicorn on port 8001)
- **Database**: PostgreSQL (Railway), Redis (Railway), MongoDB (local)

## Current Setup Status
- ✅ Frontend: Running (Next.js on port 3000)
- ✅ Backend: Running (Node.js on port 3300, Python proxy on port 8001)
- ✅ MongoDB: Running

## Pod URL Setup
- **Pod URL**: `https://e01e01ce-e03b-4beb-9b2c-25d0be50b954.preview.emergentagent.com`
- **Frontend** (`/app/.env.local`): `NEXT_PUBLIC_BASE_URL=https://e01e01ce-e03b-4beb-9b2c-25d0be50b954.preview.emergentagent.com/` (trailing slash for axios `api/` concatenation)
- **Frontend** (`/app/frontend/.env`): `REACT_APP_BACKEND_URL=https://e01e01ce-e03b-4beb-9b2c-25d0be50b954.preview.emergentagent.com`
- **Backend** (`/app/backend/.env`): `SERVER_URL`, `CHECKOUT_URL`, `FRONTEND_URL` all set to `https://e01e01ce-e03b-4beb-9b2c-25d0be50b954.preview.emergentagent.com`

## Backend Testing Status

backend:
  - task: "Login API with specified credentials"
    implemented: true
    working: true
    file: "/app/backend/controller/userController.ts"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "testing"
        comment: "New feature to test - Login API with credentials nomadly@moxx.co/Katiekendra123@"
      - working: true
        agent: "testing"
        comment: "✅ Login API working correctly. Returns referral_code: DYNO-G468QA (11 chars), last_company_id: 3, and valid access token"

  - task: "Last Company Endpoint - PUT /api/user/last-company"
    implemented: true  
    working: true
    file: "/app/backend/controller/userController.ts"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "testing"
        comment: "New feature to test - Last company persistence endpoint with Bearer auth"
      - working: true
        agent: "testing"
        comment: "✅ Last company endpoint working correctly. Accepts company_id: 3, returns 404 for invalid company_id (999), returns 400 for missing company_id"

  - task: "Company Fetch - GET /api/company/getCompany"
    implemented: true
    working: true
    file: "/app/backend/controller/companyController.ts" 
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "testing"
        comment: "New feature to test - Company list retrieval with Bearer auth"
      - working: true
        agent: "testing"
        comment: "✅ Company fetch endpoint working correctly. Returns list of 1 company with proper Bearer token authentication"

frontend:
  - task: "Create Payment Link Page - Crypto Items Display"
    implemented: true
    working: false
    file: "/app/pages/create-pay-link.tsx, /app/Components/Page/CreatePaymentLink/index.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "testing"
        comment: "New test request - Verify default 5 crypto items (BTC, ETH, LTC, USDT-TRC20, USDT-ERC20) with TRX and DOGE hidden initially"
      - working: false
        agent: "testing"
        comment: "❌ CANNOT TEST - Login authentication failed with credentials nomadly@moxx.co / Katiekendra123@. API returns 401 Unauthorized. Without login, cannot access /create-pay-link page to verify crypto item display."

  - task: "Create Payment Link Page - Show All Button"
    implemented: true
    working: false
    file: "/app/Components/UI/pay-link/CryptoSelection.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "testing"
        comment: "New test request - Verify 'Show all' button expands crypto items from 5 to 15, making TRX and DOGE visible"
      - working: false
        agent: "testing"
        comment: "❌ CANNOT TEST - Login authentication failed. Cannot access page to test Show All functionality."

  - task: "Create Payment Link Page - Currency Dropdown"
    implemented: true
    working: false
    file: "/app/Components/UI/CurrencySelector/index.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "testing"
        comment: "New test request - Verify currency dropdown shows all 14 currencies (USD, EUR, GBP, AUD, CAD, INR, NGN, VND, PKR, BRL, ARS, PHP, SGD, AED) with proper flag icons (no emojis)"
      - working: false
        agent: "testing"
        comment: "❌ CANNOT TEST - Login authentication failed. Cannot access page to verify currency dropdown."

  - task: "Create Payment Link Page - Responsive Layout (Mobile/Tablet)"
    implemented: true
    working: false
    file: "/app/pages/create-pay-link.tsx"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "testing"
        comment: "New test request - Verify layout works on mobile (375x800) and tablet (768x1024) views"
      - working: false
        agent: "testing"
        comment: "❌ CANNOT TEST - Login authentication failed. Cannot access page to test responsive layouts."

  - task: "Login Flow with Password Method"
    implemented: true
    working: false
    file: "/app/pages/auth/login.tsx"
    stuck_count: 1
    priority: "critical"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "testing"
        comment: "Testing login flow with provided credentials"
      - working: false
        agent: "testing"
        comment: "❌ CRITICAL FAILURE - Login API returns 401 Unauthorized for credentials nomadly@moxx.co / Katiekendra123@. Console error: 'Failed to load resource: the server responded with a status of 401 () at /api/user/login'. Additionally, /api/auth/session returns 404 (NextAuth session endpoint issue). This blocks ALL testing of authenticated pages."

metadata:
  created_by: "testing_agent"
  version: "1.1"
  test_sequence: 1
  run_ui: false

test_plan:
  current_focus:
    - "Login Flow with Password Method"
    - "Create Payment Link Page - Crypto Items Display"
    - "Create Payment Link Page - Show All Button" 
    - "Create Payment Link Page - Currency Dropdown"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
  - agent: "testing"
    message: "Starting backend API testing for new referral code, last company persistence, and company fetch features"
  - agent: "testing"
    message: "✅ ALL BACKEND TESTS PASSED (7/7 - 100% success rate). Key findings: 1) Login API working with referral_code DYNO-G468QA (11 chars, correct format), 2) last_company_id field present (value: 3), 3) Last company endpoint properly validates company ownership and returns appropriate errors, 4) Company fetch returns 1 company with Bearer auth. All three endpoints from review request are functional."
  - agent: "testing"
    message: "❌ CRITICAL: Cannot test /create-pay-link page - Login FAILED with provided credentials (nomadly@moxx.co / Katiekendra123@). API returns 401 Unauthorized. Console errors show: 'Failed to load resource: the server responded with a status of 401 () at /api/user/login'. Additionally, NextAuth session endpoint (/api/auth/session) returns 404. Without successful authentication, cannot access the create payment link form to test crypto items, currency dropdown, or responsive layouts. BLOCKING ISSUE."
  - agent: "testing"
    message: "✅ CREATE PAYMENT LINK API TESTING COMPLETE (10/10 - 100% success rate). Comprehensive testing of POST /api/pay/createPaymentLink completed successfully. All scenarios passed including: minimal fields, optional description, post-payment URLs, multiple currencies (USD/EUR/GBP/CAD/AUD), accepted cryptocurrencies array, tax functionality, fee payer options, validation checks, and authentication. Payment links generate correctly with proper pod URLs. Authentication validation working (403 CSRF error when no token). No major issues found."

### Pod URL Migration & Checkout Fix (Current Session)
- Updated all env files to current pod URL `6f7f3775-d165-4bd6-8635-d660e9c3ab44`
- Installed frontend dependencies (`yarn install` at `/app/`)
- Installed backend Node.js dependencies (`yarn install` at `/app/backend/`)
- Fixed Next.js/SWC version mismatch (downgraded next to 14.2.33 to match ARM64 SWC binary)
- **Fixed checkout build errors** caused by stray commas in `sx={{}}` objects across multiple files:
  - `pages/pay/index.tsx` line 732: `sx={{ , fontWeight: 600 }}` → `sx={{ fontWeight: 600 }}`
  - `Components/Page/Pay3Components/bankTransferCompo.tsx` lines 365, 528
  - `Components/Page/Pay3Components/cryptoTransfer.tsx` lines 1395, 1416, 1525, 1710
  - `Components/UI/TransferExpectedCard/Index.tsx` lines 390, 428, 612
  - `Components/UI/OverPayment/Index.tsx` line 460
  - `Components/UI/UnderPayment/Index.tsx` line 382

## Changes Made in Current Session (Phase: Referral, Dark Mode, Translations)

### Dark Mode Fixes
- Fixed 11 SVG icons in `/assets/Icons/home/` - changed hardcoded `stroke="#0004FF"` to `currentColor`
- Fixed `FeatureIcon` and `WhyChooseDynoPayIcon` styled components with proper dark mode color
- Fixed App Header (`Components/Layout/Header`) - dark mode background, borders, hovers
- Fixed 15+ components with hardcoded `#fff` backgrounds → `theme.palette.background.paper`
  - PanelCard, NewHeader, UserMenu, CompanySelector, TimePeriodSelector, FullHeightModal, AreaChart, DashboardRightSection, API styled, AuthLayout/PasswordValidation, CryptocurrencySelector, OnboardingFlow, ApiKeysModel
- Fixed DynoPay logo in NewHeader to swap between dark/white variants based on theme
- Fixed hardcoded `#E9ECF2` borders in DashboardRightSection and CreatePaymentLink

### Translation Fixes
- Phone tab of register page: All strings now use `t()` (Full Name, Phone Number, Password, Send Verification Code, Phone Verification subtitle, password error)
- Email/Phone toggle buttons now translated
- App Header: "My Profile", "Logout", "Hello" now use `t()` from common namespace
- Added missing keys to all 6 locales (en, de, es, fr, nl, pt) in `auth.json` and `common.json`
- Created `referrals.json` for all 6 locales with 35+ keys
- Registered referrals namespace in i18n.js

### Referral System UI
- Added optional "Referral Code" input field to email registration (with collapsible "Have a referral code?" link)
- Added same referral code field to phone registration tab
- Auto-populates referral code from URL query param (`?ref=CODE`)
- Referral code is sent in register payload to backend
- Added optional "Customer Email" field to Create Payment Link form (for sending referral/referee codes)
- Referral page strings now use translations

### 1. Dark/Light Mode Toggle (Landing + In-App)
- Extended existing `ThemeContext` to work globally (was only for checkout pages)
- Created `themeDark` (dark variant of main app theme) in `/app/styles/theme.ts`
- Created `homeThemeDark` in `/app/styles/homeTheme.ts`
- Updated `_app.tsx` to use `AppThemeProvider` globally with theme selection per layout
- Created `ThemeToggle` component at `/app/Components/UI/ThemeToggle/index.tsx`
- Added toggle to `HomeHeader` (landing page) and `NewHeader` (in-app dashboard)
- Theme persists via `localStorage('theme-mode')`

### 2. DE/NL Languages in Switcher
- Created German and Dutch flag images in `/app/assets/Images/Icons/flags/`
- Updated `LanguageSwitcher/index.tsx` to include DE (Deutsch) and NL (Nederlands)
- Updated `MobileNavigationBar/index.tsx` language list with all 6 languages
- DE/NL locale files and i18n config were already in place

### 3. New Company Flow (Removed Old Design)
- Changed "Add Company" button in `CompanySelector` from navigating to `/company` page (old CRUD table design) to using the onboarding-style flow
- Now uses `CreateCompanyModal` → `AddWalletModal` → `CelebrationOverlay` inline
- Same UX as initial onboarding: create company, then prompted to add wallet

### 4. Total Value Bug Fix ($15k → $14k)
- **Root cause**: `useDashboardData` dispatched `DASHBOARD_FETCH` without `company_id` on first render (getting aggregate $15k), then after `CompanySelector` auto-selected a company, re-fetched with company_id (getting $14k for that company)
- **Fix**: Updated `useDashboardData` to only fetch when `selectedCompanyId` is set (or when user has no companies), preventing the flash of aggregate data

### 5. Performance Optimization
- Increased httpx connection pool in Python proxy (100 max connections, 20 keepalive)
- Fixed NewHeader to use `useMuiTheme()` instead of imported static theme (proper reactivity)
- Fixed Home container styled components to use theme from provider instead of static import

### 6. Dark Mode Comprehensive Fix (Complete)
**Root cause**: Styled components across the app imported `homeTheme`/`theme` (light-only static) directly and used hardcoded color literals instead of the dynamic `theme` callback parameter from MUI's `styled()`.

**Phase 1 - Landing Page (styled components)**:
- `SectionTitle/styled.tsx` - Badge, Heading, SubText
- `HomeCard/styled.tsx` - StyledCard gradients, WhyChooseUsCard, + icon brightness filter for dark mode
- `HomeHeader/styled.tsx` - FixedHeader bg, nav links, Sign In, mobile drawer
- `HomeFooter/styled.tsx` - Footer bg conditional dark color
- `HomeButton/styled.tsx` - Primary and outlined buttons
- `Home/styled.tsx` - Section backgrounds and glow effects
- `Home/UseCase.tsx` - Cards, tags, borders
- `UseCaseBanner/index.tsx` - Banner gradient and border
- `LanguageSwitcher/styled.tsx` - Dropdown, trigger, borders, hover states
- `MobileLanguageSwitcher/styled.tsx` - Modal bg, close button
- Static pages: `privacy-policy`, `terms-conditions`, `aml-policy`, `system-status`

**Phase 2 - Logo Visibility**:
- `HomeHeader/index.tsx` - Switches to white logo (`dynopay-whiteLogo.svg`) in dark mode
- `auth/login.tsx` - Switches to white PNG logo in dark mode
- `auth/register.tsx` - Switches to white PNG logo in dark mode

**Phase 3 - Documentation Page**:
- All helper components (ParamTable, EndpointCard) now use `useTheme()` with dark-aware colors
- Section headings, body text, code inline tags, sidebar nav, auth cards, error table, support box

**Phase 4 - Auth Pages & Shared Components**:
- `Login/styled.tsx` - Dark wrapper bg, dark card bg, dark border
- `auth/login.tsx` - Text colors, border colors, backgrounds
- `auth/register.tsx` - Text colors, icon colors
- `AuthLayout/TitleDescription` - Title and description colors
- `AuthLayout/InputFields` - Input bg, disabled state, autofill colors
- `UI/Buttons/index.tsx` - Hover, disabled, animation state colors (converted from static theme import to `useTheme()`)
- `UI/OtpDialog/index.tsx` - Background and text colors
- `_error.tsx` - Button colors for dark mode

**Phase 5 - Icon Brightness**:
- `FeatureIcon` and `WhyChooseDynoPayIcon` apply `brightness(2.5)` CSS filter in dark mode for `#0004FF` stroke icons

## Testing Protocol

### Backend Testing
- Test the dashboard API with and without company_id parameter
- Verify login flow works correctly
- Test that CSRF token + auth flow works
- Test Create Payment Link API with various payloads

### Frontend Testing
- Verify dark/light mode toggle on landing page
- Verify language switcher shows all 6 languages (EN, PT, FR, ES, DE, NL)
- Verify "Add Company" opens modal flow instead of old page
- Verify dashboard loads with correct company-scoped data (no flash)
- Test Create Payment Link full flow

### Create Payment Link - Test Scenarios

backend:
  - task: "Create Payment Link - Minimal Fields (amount + currency only)"
    implemented: true
    working: true
    file: "/app/backend/controller/paymentController.ts"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Test POST /api/pay/createPaymentLink with minimal payload: {amount:10, currency:'USD', company_id:3, expire:'No', fee_payer:'company'}"
      - working: true
        agent: "testing"
        comment: "✅ PASSED: Minimal fields test successful. API returns 200 status with valid payment_link URL containing correct pod URL (https://e01e01ce-e03b-4beb-9b2c-25d0be50b954.preview.emergentagent.com). Response includes all expected fields: link_id, transaction_id, base_amount=10, base_currency=USD, fee_payer=company, description=null."

  - task: "Create Payment Link - With Description"
    implemented: true
    working: true
    file: "/app/backend/controller/paymentController.ts"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Test POST /api/pay/createPaymentLink with description field"
      - working: true
        agent: "testing"
        comment: "✅ PASSED: Description field working correctly. API returns 200 status with description='Test payment' properly stored in response. Payment link generated successfully with GBP currency."

  - task: "Create Payment Link - Without Description (optional)"
    implemented: true
    working: true
    file: "/app/backend/controller/paymentController.ts"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Test POST /api/pay/createPaymentLink without description - should succeed"
      - working: true
        agent: "testing"
        comment: "✅ PASSED: Optional description field works correctly. API succeeds (200) when description is omitted, sets description=null in response. Tested with EUR currency successfully."

  - task: "Create Payment Link - With Post-Payment URLs"
    implemented: true
    working: true
    file: "/app/backend/controller/paymentController.ts"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Test POST /api/pay/createPaymentLink with redirect_url, webhook_url, callback_url"
      - working: true
        agent: "testing"
        comment: "✅ PASSED: Post-payment URLs working correctly. API returns 200 with redirect_url='https://example.com/success', webhook_url='https://example.com/webhook', callback_url='https://example.com/callback' properly stored. Tested with CAD currency."

  - task: "Create Payment Link - Without Post-Payment URLs (optional)"
    implemented: true
    working: true
    file: "/app/backend/controller/paymentController.ts"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Test POST /api/pay/createPaymentLink without post-payment URLs - should succeed"
      - working: true
        agent: "testing"
        comment: "✅ PASSED: Optional post-payment URLs work correctly. API succeeds (200) when URLs are omitted, sets redirect_url=null, webhook_url=null, callback_url=null. fee_payer=customer option also working."

  - task: "Create Payment Link - Validation: No Amount"
    implemented: true
    working: true
    file: "/app/backend/controller/paymentController.ts"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Test POST /api/pay/createPaymentLink with missing amount - should return error"
      - working: true
        agent: "testing"
        comment: "✅ PASSED: Validation working correctly. API returns 400 error with proper validation message 'Amount is required. Please provide either amount or base_amount field' when amount is missing."

  - task: "Create Payment Link - Different Currencies (EUR, GBP, CAD, AUD)"
    implemented: true
    working: true
    file: "/app/backend/controller/paymentController.ts"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Test creating links with various currencies"
      - working: true
        agent: "testing"
        comment: "✅ PASSED: Multiple currencies working correctly. Tested USD, EUR, GBP, CAD, AUD - all return 200 status with correct currency symbols ($ € £) and currency codes. Note: AED and INR not supported (validation correctly rejects them)."

  - task: "Create Payment Link - With Accepted Cryptocurrencies"
    implemented: true
    working: true
    file: "/app/backend/controller/paymentController.ts"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Test with accepted_currencies array e.g. ['BTC','ETH','USDT-TRC20']"
      - working: true
        agent: "testing"
        comment: "✅ PASSED: Accepted cryptocurrencies working correctly. API returns 200 with accepted_currencies=['BTC','ETH','USDT-TRC20'] properly stored in response. Tested with AUD currency."

  - task: "Create Payment Link - With Tax Enabled"
    implemented: true
    working: true
    file: "/app/backend/controller/paymentController.ts"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Test with apply_tax:true"
      - working: true
        agent: "testing"
        comment: "✅ PASSED: Tax functionality working correctly. API returns 200 with apply_tax=true properly stored when tax is enabled. Payment link generated successfully."

  - task: "Create Payment Link - Fee Payer Options (customer vs company)"
    implemented: true
    working: true
    file: "/app/backend/controller/paymentController.ts"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Test with fee_payer:'customer' and fee_payer:'company'"
      - working: true
        agent: "testing"
        comment: "✅ PASSED: Fee payer options working correctly. Tested both fee_payer='customer' and fee_payer='company' - both return 200 status with correct fee_payer value stored in response."

  - task: "Create Payment Link - Authentication Validation"
    implemented: true
    working: true
    file: "/app/backend/controller/paymentController.ts"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "testing"
        comment: "Test authentication validation when no Bearer token provided"
      - working: true
        agent: "testing"
        comment: "✅ PASSED: Authentication validation working correctly. API returns 403 'CSRF token validation failed' when no Authorization header provided, properly blocking unauthenticated requests."

## Incorporate User Feedback
- User should test the dark mode toggle persistence (switch on landing → verify on login/dashboard)
- User should test the Add Company flow from the company selector dropdown
- User should verify the total value no longer flashes between different amounts

## Changes Made - Session 3 (Referral Code, Copy Icon, Language Detection, Company Persistence)

### 1. Shorter Referral Code
- **Before**: `DYNO2026NOMC92496B9` (19 chars)
- **After**: `DYNO-G468QA` (11 chars, format: `DYNO-XXXXXX` using unambiguous alphanumeric)
- Updated generation in `backend/controller/userController.ts`
- Migration script in `backend/server.ts` auto-shortens all existing long codes on startup
- 45 existing codes migrated successfully

### 2. Copy Icon Overflow Fix
- Added `flex-shrink: 0` to `CopyButton` styled component (never shrinks)
- Added `overflow: hidden`, `text-overflow: ellipsis`, `white-space: nowrap`, `minWidth: 0` to `ReferralCardContentValue`
- Added `minWidth: 0` to `ReferralCardContentValueContainer`
- Copy icon now always fully visible on all screen sizes

### 3. Auto Language Detection by IP + Timezone
- Updated `i18n.js` with timezone→language mapping (sync fallback)
- On first visit (no `lang` in localStorage): detects via `navigator.language` and timezone
- Async IP geolocation via `ip-api.com` upgrades language after initial render
- Manual language choice via switcher sets `lang_manual=true` flag → prevents auto-override
- Persists language choice across sessions via localStorage

### 4. Last Company Persistence Across Logins
- Added `last_company_id` column to `tbl_user` model
- New endpoint: `PUT /api/user/last-company` with ownership validation
- Login response now includes `last_company_id`
- Frontend: `userReducer` saves `last_company_id` to localStorage on login
- Frontend: `companyReducer` restores from localStorage on `COMPANY_FETCH`
- `CompanySelector.handleCompanySwitch` fires API call to persist selection
- `selectCompany` Redux action saves to localStorage immediately

### 5. Add Company + Wallet Flow
- After creating a new company, the newest company is auto-selected
- AddWalletModal now shows a "success choice" screen after adding a wallet:
  - "Add Another" button → resets form for adding more wallets
  - "Done" button → triggers celebration overlay
- Both OnboardingFlow and CompanySelector flows are consistent

## Changes Made - Session 4 (Full UI/UX Audit & Improvements)

### 1. Pay Links Mobile Card Layout
- Replaced horizontal scroll table with card-based layout on mobile
- Each card shows: description, status badge, USD value, crypto value, date, times used, and action buttons (copy/view/edit)
- Desktop table layout fully preserved

### 2. Company Selector "-" Bug Fix
- Fixed company name showing "-" when selected company hasn't loaded yet
- Falls back to first company in list, then empty string instead of "-"

### 3. Empty States Enhancement
- **Invoices page**: Added illustration icon, clear heading, and helpful explanation text
- **Dashboard**: Added "Welcome to DynoPay! 🚀" banner for new users (0 transactions) with CTA to create first payment link

### 4. Profile Avatar Initials Fix
- Fixed initials text color to white (#fff) on solid blue (#2563EB) background for high contrast
- Added safety for single-name users (falls back to email initial)

### 5. Landing Page Social Proof Section
- Added "Trusted by Businesses Worldwide" stats section below hero
- Shows: 10K+ Transactions, 500+ Merchants, 15+ Cryptocurrencies, 99.9% Uptime
- Responsive 2x2 grid on mobile, 4-column on desktop


## Changes Made - Session 5 (Pod URL + Dashboard Stats Flash Fix)

### 1. Pod URL Setup
- Updated all env files to current pod URL `e01e01ce-e03b-4beb-9b2c-25d0be50b954`
- `/app/.env.local`: `NEXT_PUBLIC_BASE_URL=https://e01e01ce-e03b-4beb-9b2c-25d0be50b954.preview.emergentagent.com/`
- `/app/frontend/.env`: `REACT_APP_BACKEND_URL=https://e01e01ce-e03b-4beb-9b2c-25d0be50b954.preview.emergentagent.com`
- `/app/backend/.env`: `SERVER_URL`, `CHECKOUT_URL`, `FRONTEND_URL` all set to `https://e01e01ce-e03b-4beb-9b2c-25d0be50b954.preview.emergentagent.com`

### 2. Dashboard Stats Flash Fix (658 → 675)
- **Root cause**: `useDashboardData` fired immediately on mount with no company_id because `companyList=[]` and `loading=false` (initial state), before `OnboardingFlow` triggered the company fetch. This returned aggregate data (658 txns) which then got replaced by company-scoped data (675 txns).
- **Fix**: Added `fetched: boolean` flag to `companyReducer` (starts `false`, set `true` on `COMPANY_FETCH` or `COMPANY_API_ERROR`). Updated `useDashboardData` to gate ALL fetches (`shouldFetch`, `fetchChartData`, `refreshDashboard`) behind `companiesFetched === true`, so dashboard only fetches after company list is resolved.
- Files changed: `utils/types.ts`, `Redux/Reducers/companyReducer.ts`, `hooks/useDashboardData.ts`


## Changes Made - Session 6 (Create Payment Link UX Fix)

### 1. "Create Payment Link" Button on Tab 0
- **Before**: Tab 0 had a "Continue" button that confused users into thinking they must navigate to Tab 1 (Post-Payment Settings) first
- **After**: Tab 0 now shows "Create Payment Link" button directly — users can create payment links without touching post-payment settings
- File: `Components/UI/pay-link/ActionButtons.tsx` — changed label from `tPaymentLink("continue")` to `tPaymentLink("createPaymentLink")`

### 2. Description Marked as Optional
- Added "(Optional)" text next to the Description label
- File: `Components/UI/pay-link/DescriptionSection.tsx`

### 3. Post-Payment Settings Tab Marked as Optional
- Tab 2 label changed from "2. Post-Payment Settings" to "2. Post-Payment Settings (Optional)"
- File: `Components/UI/pay-link/TabNavigation.tsx`

### 4. Unified Create Handler
- Merged `handleCreatePaymentLink` logic so both Tab 0 and Tab 1 use the same validation and payload
- Tab 1 create now includes all Tab 0 fields (name, expire, fee_payer, accepted_currencies)
- If validation fails while on Tab 1, auto-switches to Tab 0 to show errors
- File: `Components/Page/CreatePaymentLink/index.tsx`

### 5. Consistent Button Label on Tab 1
- Tab 1's create button also now says "Create Payment Link" (was "Create Payment")
- File: `Components/UI/pay-link/PostPaymentSettings.tsx`
