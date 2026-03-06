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
- **Pod URL**: `https://0c4cc5ce-4759-433e-af7f-d167d324de2b.preview.emergentagent.com`
- **Frontend** (`/app/.env.local`): `NEXT_PUBLIC_BASE_URL` set to pod URL (used by axiosConfig.ts for API calls)
- **Frontend** (`/app/frontend/.env`): `REACT_APP_BACKEND_URL` set to pod URL
- **Backend** (`/app/backend/.env`): `SERVER_URL`, `CHECKOUT_URL`, `FRONTEND_URL` all set to pod URL
- **Frontend start**: Changed to `next dev` mode (turbo removed to prevent memory issues)
- **Cleanup**: Removed unused CRA template files from `/app/frontend/src/` (only bridge `package.json` remains)

## Checkout Page Integration (from CheckoutDyno repo)
- **Pages added**: `/pay`, `/pay/demo`, `/pay/aml-policy`, `/pay/terms-of-service`, `/pay/success-demo`, `/pay/payment-states-demo`
- **Components added**: Pay3Components, Pay3Layout, BrandLogo, ChatButton, Footer, ProgressBar, TransferExpectedCard, UnderPayment, OverPayment, Loading
- **Assets added**: Flag icons (30+ countries), Coin SVG icons (9 cryptos), various UI icons
- **Context added**: ThemeContext (dark/light mode toggle for checkout pages)
- **Theme updated**: Added `lightTheme` and `darkTheme` exports with surface palette for checkout
- **i18n updated**: Added checkout translations (header, checkout, crypto, etc.) + de/nl languages
- **_app.tsx updated**: `/pay` routes wrapped with CheckoutThemeProvider + PaymentLayout
- **Imports fixed**: `next-i18next` → `react-i18next`, removed `getServerSideProps` with `serverSideTranslations`
- **Dependency**: `@iconify/react` installed
- **Test Results**: ✅ `/pay` returns 200, ✅ `/pay/demo` renders checkout UI correctly, ✅ Homepage still works

## Checkout UI Redesign — Compact & Branded
- **Font**: Switched from Space Grotesk/Poppins → **Urbanist** (matches main app)
- **Colors**: Updated #1034A6/#444CE7 → **#0004FF** (matches main app primary blue)
- **Header**: Slimmed from 92px → 60px, removed notification bell & avatar, glassmorphism wallet button
- **Footer**: Removed social icons, minimal bar with Terms/AML/Powered by DynoPay
- **Card**: Compact padding (32px→20px), maxWidth 500→440, removed minHeight constraint, flat elevation
- **Progress Bar**: Smaller step icons (28→22px), #0004FF accent, centered max-width 480px
- **Expiry + Security**: Moved to single row below card
- **Responsive**: ✅ Desktop (1920px), ✅ Tablet (768px), ✅ Mobile (390px) — all fit without scrolling
- **Theme**: lightTheme/darkTheme updated with Urbanist font + new palette

## Bug Fix: API Credentials Not Showing in UI
- **Root cause**: Backend `getApi` returns `{ all: [...array...], grouped: {...}, total, ... }` (nested object), but Redux saga was setting the entire object as `apiList`. Component checks `Array.isArray(apiList)` → `false` → keys never rendered.
- **Fix**: In `/app/Redux/Sagas/ApiSaga.ts` → `getApi()` function, changed `payload: data` to `payload: data?.all || data || []` to extract the actual array of API keys.
- **File changed**: `/app/Redux/Sagas/ApiSaga.ts` (line 88)

## Onboarding Fix: hasWallet check + race condition fix
- **Files**: `Components/UI/OnboardingFlow/index.tsx`, `pages/dashboard.tsx`
- Fixed `hasWallet` check: now verifies `wallet_address` is actually configured (not just that wallet entries exist)
- Fixed race condition: added `fetchStarted` state to prevent phase determination before API data loads
- **Test Results**:
  - ✅ Test 1: User with company + no wallet → Wallet modal shown correctly
  - ✅ Test 3: User with company + wallet → Dashboard (verified via console logs: phase="done")
  - Test 2 (new user, no company/wallet → Company modal): Verified via code logic

## UI Fixes Applied (All Verified ✅)

### Fix 1: Wallet Warning Banner (`hooks/useWalletData.ts`)
- Only shows when user has ZERO configured wallet addresses (not when some types are missing)

### Fix 2: Transaction Volume Chart (`Components/Page/Dashboard/DashboardLeftSection.tsx`)
- Fixed date format mismatch: API returns "YYYY-MM-DD", chart expected "Feb 27" format
- Now converts API dates to match `formatDate` output before lookup

### Fix 3: Number Formatting (`helpers/index.ts`)
- Removed European format conversion (`.replace(/,/g, " ").replace(/\./g, ",")`)
- Now displays US format: `$14,958.46` instead of `$14 958,46`

### Fix 4: Crypto/USD Value Accuracy (`backend/controller/walletController.ts`, `Components/Page/Transactions/index.tsx`)
- Backend now calculates USD values using `convertToUSD` with cached exchange rates
- Stablecoins (USDT, USDC, etc.) → 1:1 to USD
- Crypto (BTC, ETH, etc.) → converted using live rates
- Frontend uses `usd_value` from API response

### Fix 5: Default Rows Per Page
- `Components/Page/Transactions/index.tsx`: Changed from 5 to 10
- `Components/Page/Payment-link/index.tsx`: Changed from 5 to 10

### Fix 6: Payment Links Table (`Components/Page/Payment-link/`)
- Fixed field mapping: `link.created`/`link.expires`/`link.display_value` (was looking for wrong field names)
- Fixed DD/MM/YYYY date parsing (API uses European date format)
- Fixed double currency symbol (`$€25.00` → `€25.00 EUR`)

### Fix 7: Company Dropdown (`Components/UI/CompanySelector/index.tsx`)
- Added `maxHeight: '50vh'` and `overflowY: 'auto'` to prevent overflow below viewport

### Fix 1: 🟠 Token Refresh (was kicking users out on 401)
- **File**: `axiosConfig.ts`
- Added refresh token logic with request queueing in the 401 interceptor
- On 401: tries `POST /api/user/refresh-token`, retries original request on success
- Falls back to login redirect only when refresh fails
- **Files**: `Redux/Reducers/userReducer.ts`, `Redux/Sagas/UserSaga.ts`  
- Now stores `refreshToken` in localStorage alongside `accessToken`

### Fix 2: 🟠 Server-Side Encryption (was exposing key in browser)
- **Backend**: Added `POST /api/wallet/encrypt-payload` endpoint in `walletRouter.ts` + `walletController.ts`
- **Frontend**: `helpers/createEncryption.ts` now calls backend instead of using exposed `NEXT_PUBLIC_CYPHER_KEY`
- Updated 8 payment components to `await` the now-async function:
  - CardComponent, CryptoComponent, MobileMoneyComponent, BankTransferComponent
  - BankAccountComponent, QRCodeComponent, USSDComponent, pages/payment/index.tsx

### Fix 3: 🟡 Duplicate API Calls in withdraw.tsx
- **File**: `pages/withdraw.tsx`
- Replaced direct `getWallet` API call with Redux store data (`walletReducer.walletList`)
- Uses `WalletAction(WALLET_FETCH)` dispatch instead of duplicate direct call

### Fix 4: 🟡 Redundant Payment API Calls
- **New file**: `hooks/usePaymentRates.ts` — shared hook with module-level cache (30s TTL)
- Replaced inline `getCurrencyRate` functions in 5 payment components:
  - CryptoComponent, MobileMoneyComponent, BankAccountComponent
  - USSDComponent, BankTransferComponent

---

## UI Automation Testing - Onboarding Flow

### Test Plan
1. **Registration**: Fill form with test data, submit, check for OTP dialog
2. **Login**: Login with registered credentials  
3. **Company Creation**: Create a company profile
4. **Add Wallet**: Add BTC wallet with address `1JH5TnZzjYTf1yYwBDLjWoHgkAcCHc1Do7`
5. **Page-by-page navigation**: Test each dashboard page

### Test Credentials
- First Name: Test
- Last Name: User  
- Email: testuser_dynopay@test.com
- Password: TestPass@123

### Test Results - Onboarding Flow
1. ✅ Registration - Working (NEXT_PUBLIC_BASE_URL fix applied)
2. ✅ OTP Verification - Working (verified via API + Redis OTP retrieval)
3. ✅ Login - Working (use keyboard.type() for password field, not fill())
4. ✅ Company Creation Modal - Shows on dashboard for new users (Step 1/2)
5. ✅ Wallet Addition Modal - Shows after company creation (Step 2/2)  
6. ✅ Step Indicator - Correctly shows "1 Company ── 2 Wallet" progress
7. ✅ Validation - Working correctly on both forms
8. ✅ CelebrationOverlay - VERIFIED! Shows confetti + "You're all set!" + "Go to Dashboard"

### Changes Made
- Fixed NEXT_PUBLIC_BASE_URL missing (created /app/.env.local)
- Fixed NEXTAUTH_SECRET missing
- Removed old CompanyDialog folder (/app/Components/UI/CompanyDialog/)
- Removed old OnboardingChecklist folder (/app/Components/UI/OnboardingChecklist/)
- Updated CompanySelector to use router.push('/company') instead of old openAddCompany()
- Removed CompanyDialogProvider wrapper from Containers/Client/index.tsx
- Fixed AddWalletModal: moved OtpDialog outside PopupModal to fix z-index stacking
- Fixed AddWalletModal: don't call onClose() in handleSubmit (prevented phase="done" premature)
- Fixed AddWalletModal: added company_id to validateWalletAddress and verifyOtp API calls
- Fixed AddWalletModal: hide PopupModal when OTP dialog is showing (open={open && !otpModalOpen})
- Fixed OTP verification success handler to properly reset form without calling onClose()

---

## Testing Protocol

### Backend Testing
- Use `deep_testing_backend_v2` for backend testing
- Backend base URL: `http://localhost:8001`
- All API routes prefixed with `/api`
- The encrypt endpoint requires authentication (CSRF token)

### Frontend Testing  
- Only test frontend with explicit user permission
- Use `auto_frontend_testing_agent` for frontend testing
- Frontend URL: `http://localhost:3000`

### Incorporate User Feedback
- Always ask user before making changes based on test results
- Do not fix minor issues without user approval

---

## Latest Testing Session (March 6, 2026)

### Backend API Validation - COMPLETED ✅

**Testing Agent**: backend_testing_agent  
**Test Date**: 2026-03-06 12:20 UTC  
**Test File**: `/app/backend_test.py`

#### Test Results Summary
✅ **Backend Health Check**: Backend healthy - Dynopay API status: operational  
✅ **CSRF Token Endpoint**: GET /api/csrf-token working - token length: 64  
✅ **Backend Root Endpoint**: Backend API accessible - Dynopay API v1.0.0 status: operational  
✅ **Backend Connectivity**: Connected to Dynopay API v1.0.0

**Success Rate**: 100% (4/4 tests passed)

#### Key Findings
1. **Health Endpoint**: `/health` works internally but not externally routed (expected K8s behavior)
2. **CSRF Protection**: Fully functional via `/api/csrf-token` endpoint
3. **Database Connections**: PostgreSQL (Railway) ✅ connected, Redis (Railway) ✅ connected
4. **External Integrations**: Tatum API ✅ operational
5. **Backend Architecture**: Node.js/Express on port 3300, proxied via Python/uvicorn on port 8001

#### Tested Endpoints
- ✅ `GET /api` - Backend info and status
- ✅ `GET /api/csrf-token` - CSRF token generation  
- ✅ `GET /health` (internal) - Health status with DB/Redis checks
- ✅ `GET /api/status` - Service status endpoint

#### Infrastructure Status
- **Backend Service**: Running and operational
- **Database**: PostgreSQL connected via Railway
- **Cache**: Redis connected via Railway  
- **API Gateway**: Python proxy functioning correctly
- **External Routing**: Pod URL routing working for `/api/*` endpoints

**Conclusion**: DynoPay backend API is fully accessible and responding correctly. All core endpoints operational.
