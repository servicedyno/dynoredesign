# DynoPay - Crypto Payment Platform PRD

## Original Problem Statement
Build and maintain a full-stack cryptocurrency payment platform allowing merchants to accept crypto payments with multi-tenant support, payment links, and flexible fee structures.

## Core Requirements
1. Merchant dashboard for managing payments and wallets
2. Payment link creation with customizable options
3. Multi-cryptocurrency support (BTC, ETH, LTC, DOGE, TRX, BCH, USDT-TRC20, USDT-ERC20, USDC-ERC20)
4. Selectable currencies per payment link
5. Fee payer options (merchant or customer)
6. Webhook notifications for payment events
7. API key management for merchant integrations

## Architecture
- **Backend**: Express.js with TypeScript, PostgreSQL, Sequelize ORM
- **Frontend**: React (Merchant Dashboard)
- **Checkout**: Next.js (CheckoutDyno repo)
- **Services**: Redis for caching, Tatum for blockchain APIs
- **Security**: JWT authentication, rate limiting

## What's Been Implemented

### Session: February 4, 2026 (Latest)

#### Non-USD Currency Fix (Critical)
- ✅ **Fee Tier Calculation**: Fixed to use USD equivalent for all currencies
  - $100 AUD → $70 USD (Tier 1, not incorrectly Tier 2)
  - $100 EUR → $118 USD (Tier 2)
  - $100 GBP → $137 USD (Tier 2)
- ✅ **createCryptoPayment**: Converts `base_amount` to USD before fee calculation
- ✅ **getCurrencyRates**: Converts source amount to USD for fee tier selection
- ✅ **Redis Storage**: Now stores both `base_amount_original` and `base_amount_usd`
- ✅ **All 11 tests passing** (100% success rate)

#### API Documentation Improvements
- ✅ Consolidated tags from 25+ to 24 logical groups
- ✅ Added `available_currencies` documentation
- ✅ Updated `configured-currencies` endpoint documentation

#### Currency Selection Architecture Fix
- ✅ `getConfiguredCurrenciesForCheckout` respects `accepted_currencies`
- ✅ `getData` returns `available_currencies` in response
- ✅ Direct API endpoints support `accepted_currencies` parameter

#### Checkout Repo Compatibility (Verified)
- ✅ All API endpoints compatible with CheckoutDyno
- ✅ No changes required in checkout repo

### Previous Sessions
- ✅ Webhook Enhancements with detailed payloads
- ✅ Onboarding Status Endpoint
- ✅ KYC Enforcement Logic ($10K threshold, 90-day grace period)
- ✅ Code Cleaning (0 TypeScript errors)

## Payment Flow for Non-USD Currencies

### Example: $100 AUD Payment Link

```
1. CREATE LINK: base_amount=100, base_currency=AUD
   └─ Store in DB: 100 AUD

2. CHECKOUT (getCurrencyRates):
   └─ Convert: 100 AUD → ~$70 USD
   └─ Fee Tier: Tier 1 ($5-$100 USD) ✓
   └─ Calculate: 2% + $5 fixed + buffer
   └─ Return: processing_fee=$5.14, total_usd=$75.11

3. CREATE PAYMENT (createCryptoPayment):
   └─ Convert to crypto: 100 AUD → 0.032 ETH
   └─ Store in Redis: {
        base_amount_original: 100,
        base_currency: "AUD",
        base_amount_usd: 70,
        merchant_amount: 0.030 ETH
      }

4. SETTLEMENT (on payment confirmation):
   └─ Read merchant_amount from Redis
   └─ Transfer to merchant: 0.030 ETH
   └─ Admin fee stays for sweep: 0.002 ETH
```

## Fee Tier Structure (USD)

| Tier | Amount Range | Fixed Fee | Transaction Fee | Buffer |
|------|-------------|-----------|-----------------|--------|
| 1    | $5 - $100   | $5.00     | 2%             | Varies |
| 2    | $101 - $500 | $7.50     | 2%             | Varies |
| 3    | $501 - $1000| $10.00    | 2%             | Varies |
| 4    | $1001+      | $15.00    | 2%             | Varies |

## Prioritized Backlog

### P0 (Critical)
- [x] ~~Non-USD currency fee calculation fix~~ ✅ COMPLETE
- [x] ~~Currency selection architecture fix~~ ✅ COMPLETE
- [x] ~~API documentation update~~ ✅ COMPLETE

### P1 (High)
- [ ] Frontend implementation for accepted_currencies selector
- [ ] Frontend for fee payer options
- [ ] Payment link management UI improvements

### P2 (Medium)
- [ ] High effort code cleaning (standardize logger, refactor duplicated logic)
- [ ] Security monitoring dashboards

## Key API Endpoints
- `POST /api/pay/createPaymentLink` - Create payment link (any currency)
- `POST /api/pay/getCurrencyRates` - Get rates with USD conversion for fees
- `POST /api/pay/getData` - Get payment data with `available_currencies`
- `GET /api/pay/configured-currencies` - Get filtered currencies

## Test Credentials
- Email: richard@dyno.pt
- Password: Katiekendra123@
- Company ID: 38

## Test Reports
- Latest: `/app/test_reports/iteration_4.json` (11 tests, 100% pass rate)
- Currency conversion verified for AUD, EUR, GBP, CAD

## Key Files Modified (Non-USD Fix)
- `controller/paymentController.ts`:
  - `createCryptoPayment` (lines 1480-1700): Added USD conversion
  - `getCurrencyRates` (lines 4358-4550): Added USD conversion for fees
