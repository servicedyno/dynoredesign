# DynoPay - Crypto Payment Gateway PRD

## Original Problem Statement
Crypto payment processing system requiring:
1. Bug fixes (double withdrawal fee, deposit_tx_hash population)
2. Auto-conversion flow optimization
3. Fee structure refactoring (1.5% + $1.00 tier-based fixed fee)
4. Professional email template redesign
5. Consistent gas fee deduction across all chains

## Core Architecture
- **Backend**: Node.js / TypeScript
- **Database**: PostgreSQL
- **Proxy**: SSH SOCKS5 Tunneling with autossh
- **3rd Party APIs**: Binance (conversion), Tatum (webhooks/gas estimation), Brevo (email)

## What's Been Implemented

### Session 1-3: Core Fixes
- Double withdrawal fee bug fixed and verified
- Auto-conversion speed optimized (~8min faster)
- Fee structure refactored: 1.5% + $1.00 tier-based fixed fee
- Buffer logic removed from codebase

### Session 4 (Current - Feb 13, 2026): Email Template Redesign
- **Created shared email template system** (`utils/emailTemplate.ts`)
  - Professional base template with dark mode support, mobile responsive
  - Reusable components: `infoBox`, `dataRow`, `statusBadge`, `p`, `otpBlock`
  - Navy branded header with Dynopay logo
  - Dark footer with social links
- **Updated `services/emailService.ts`** - All 30+ templates redesigned:
  - Welcome, Company Profile, Wallet OTP, Email Verification OTP
  - Login OTP, Forgot Password OTP, Password Changed
  - KYC Required/Approved/Rejected/Started/Resubmission
  - Payment Received, Payment Link Created, Payment Expiring
  - Customer Payment Confirmation, Payment Failed
  - Security Alert, New Device Login, Failed Login Attempts
  - API Key Created, Wallet Verified/Deleted/Update
  - Weekly Summary, Large Transaction Alert
  - Subscription Created/Cancelled/Payment Failed
  - Invoice Generated
- **Updated `helper/sendEmail.ts`** - All templates redesigned:
  - Payment Received, Transaction Confirmed, Admin Fee Received
  - All emoji references removed from subjects/content
- **Added email preview gallery** at `/api/diagnostics/email-preview`
  - 5 preview templates: payment, otp, security, welcome, admin
  - Template switching via query parameter

## Pending Tasks

### P0: Verify deposit_tx_hash Fix (TESTING PENDING)
- Code fix in `services/addressService.ts` needs end-to-end verification
- Requires live blockchain transaction to test

### P1: Implement Consistent Gas Fee Deduction (NOT STARTED)
- Native/Token chains currently have platform paying gas
- Must modify `paymentController.ts` to deduct gas from merchant payout
- Impacts profitability

## Future/Backlog
- Refactor monolithic `paymentController.ts`
- Create persistent `autossh` tunnel service for Binance proxy
- Pre-existing TS error in `paymentController.ts` line 1115 (`transactionFeePercent` variable)

## Key Files
- `utils/emailTemplate.ts` - Shared email base template & components
- `services/emailService.ts` - 30+ merchant/user email templates
- `helper/sendEmail.ts` - Payment/admin email templates
- `routes/diagnosticsRouter.ts` - Email preview endpoint
- `controller/paymentController.ts` - Payment logic (needs gas fee fix)
- `services/addressService.ts` - deposit_tx_hash fix (needs verification)

## Test Credentials
- User: richard@dyno.pt (DB user_id: 28)
- VPS: 95.179.167.16 root / E9o,RRotPdX_d7fC
