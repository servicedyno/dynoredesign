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

#### Fee Calculator Multi-Currency Support
- ✅ **Public Endpoint**: `POST /api/pay/calculateFees` (no auth required)
- ✅ **Multi-Currency**: Supports USD, EUR, GBP, AUD, CAD, CHF, CNY, JPY, and 30+ fiat currencies
- ✅ **60% Promotional Discount**: Displayed fees show 60% reduction
- ✅ **USD Conversion**: Automatically converts to USD for fee tier calculation
- ✅ **API Documentation**: Fully documented in Swagger with examples

**Example Response (100 AUD):**
```json
{
  "payment_amount": 100,
  "currency": "AUD",
  "fee_breakdown": {
    "platform_fee": 0.40,
    "blockchain_fee": 2.53,
    "total_fees": 2.93
  },
  "net_to_merchant": 97.07,
  "usd_equivalents": {
    "payment_amount_usd": 69.90,
    "total_fees_usd": 2.05,
    "exchange_rate": 0.699
  }
}
```

#### Non-USD Currency Fix (Critical)
- ✅ **Fee Tier Calculation**: Fixed to use USD equivalent for all currencies
- ✅ **createCryptoPayment**: Converts `base_amount` to USD before fee calculation
- ✅ **getCurrencyRates**: Converts source amount to USD for fee tier selection
- ✅ **Redis Storage**: Stores both `base_amount_original` and `base_amount_usd`

#### API Documentation & Currency Selection
- ✅ Consolidated tags, improved grouping
- ✅ Currency selection architecture fix
- ✅ Checkout repo compatibility verified

### Previous Sessions
- ✅ Webhook Enhancements
- ✅ Onboarding Status Endpoint
- ✅ KYC Enforcement Logic
- ✅ Code Cleaning (0 TypeScript errors)

## Key Public Endpoints (No Auth Required)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/pay/calculateFees` | POST | Calculate fee breakdown for any fiat currency |
| `/api/status` | GET | System health check |
| `/api/tax/rate/{countryCode}` | GET | Get VAT/GST rate for country |

## Fee Calculator Usage

```bash
# Calculate fees for $100 AUD in ETH
curl -X POST "https://api.dynopay.io/api/pay/calculateFees" \
  -H "Content-Type: application/json" \
  -d '{"amount": 100, "currency": "AUD", "cryptocurrency": "ETH"}'

# Calculate fees for €500 EUR in BTC  
curl -X POST "https://api.dynopay.io/api/pay/calculateFees" \
  -H "Content-Type: application/json" \
  -d '{"amount": 500, "currency": "EUR", "cryptocurrency": "BTC"}'
```

## Supported Currencies

**Fiat (for fee calculator):**
USD, EUR, GBP, AUD, CAD, CHF, CNY, JPY, NZD, SGD, HKD, NGN, KES, ZAR, BRL, MXN, INR, AED, SAR, PHP, THB, IDR, MYR, VND, KRW, TWD, SEK, NOK, DKK, PLN, CZK, HUF, RON, TRY, ILS, CLP, COP, PEN, ARS

**Cryptocurrencies:**
BTC, ETH, LTC, DOGE, TRX, BCH, USDT-TRC20, USDT-ERC20, USDC-ERC20

## Prioritized Backlog

### P0 (Critical)
- [x] ~~Fee calculator multi-currency support~~ ✅ COMPLETE
- [x] ~~Non-USD currency fee calculation fix~~ ✅ COMPLETE
- [x] ~~API documentation update~~ ✅ COMPLETE

### P1 (High)
- [ ] Frontend implementation for accepted_currencies selector
- [ ] Frontend for fee payer options
- [ ] Payment link management UI improvements

### P2 (Medium)
- [ ] High effort code cleaning
- [ ] Security monitoring dashboards

## Test Credentials
- Email: richard@dyno.pt
- Password: Katiekendra123@
- Company ID: 38

## Test Reports
- Latest: `/app/test_reports/iteration_4.json` (11 tests, 100% pass rate)
