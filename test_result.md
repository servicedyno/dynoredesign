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

## Changes Made This Session

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
