# DynoPay Multi-Currency Support Analysis

**Date:** 2026-02-01  
**Status:** Analysis Complete  
**Target Currencies:** USD (default), EUR, GBP, AUD, CAD, CHF, CNY, JPY, HKD, NZD

---

## Executive Summary

To support payment links in 10 fiat currencies (USD, EUR, GBP, AUD, CAD, CHF, CNY, JPY, HKD, NZD) with full consistency across the payment flow, changes are needed in **4 key areas**:

1. **Backend Middleware** - Expand allowed currencies
2. **Backend Swagger Docs** - Update currency enum
3. **Checkout Frontend** - Add currency options and flags
4. **FastForex API** - Verify all currencies are supported

---

## Current State Analysis

### Currently Supported Currencies

| Location | Currencies |
|----------|-----------|
| `linkMiddleware.ts` | USD, NGN, GBP, EUR, BTC, LTC, DOGE, KES, UGX, RWF |
| `updatePaymentLink` | USD, EUR, GBP, NGN, BRL, CAD, AUD |
| Checkout Frontend | USD, EUR, NGN |
| FastForex API | All major fiat (verified) |

### Currency Flow Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PAYMENT LINK CREATION                              │
│  POST /api/pay/createPaymentLink                                             │
│  ├─ linkMiddleware.ts → Validates currency (allowedCurrency array)           │
│  ├─ paymentController.ts → Stores base_currency in PaymentLink model         │
│  └─ Response includes payment_link URL                                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CHECKOUT PAGE                                      │
│  POST /api/pay/getData                                                       │
│  ├─ Returns: base_currency, base_amount, allowedModes                        │
│  ├─ Frontend shows currency selector (currencyOptions)                       │
│  └─ Customer can switch display currency (not base currency)                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CURRENCY CONVERSION                                │
│  POST /api/pay/getCurrencyRates                                              │
│  ├─ currencyConvert.ts → FastForex API + CoinGecko fallback                 │
│  ├─ Converts base_amount → selected display currency                         │
│  └─ Calculates: subtotal + tax + fees = total                               │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CRYPTO PAYMENT                                     │
│  POST /api/pay/createCryptoPayment                                           │
│  ├─ Converts total amount → crypto equivalent                                │
│  ├─ Stores: paid_currency = crypto (BTC, ETH, etc.)                         │
│  └─ Records original base_currency for settlement                            │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SETTLEMENT/DISTRIBUTION                            │
│  Payment confirmed via blockchain                                            │
│  ├─ Merchant receives: amount in base_currency equivalent                    │
│  ├─ All balances tracked in original base_currency                          │
│  └─ Withdrawal converts to requested currency                                │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Required Changes

### 1. Backend: `linkMiddleware.ts`

**File:** `/app/backend/middleware/linkMiddleware.ts`

```typescript
// CURRENT
const allowedCurrency = [
  "USD", "NGN", "GBP", "EUR",
  "BTC", "LTC", "DOGE",
  "KES", "UGX", "RWF",
];

// UPDATED (add new fiat currencies)
const allowedCurrency = [
  // Fiat - Major
  "USD", "EUR", "GBP", "AUD", "CAD", "CHF", "CNY", "JPY", "HKD", "NZD",
  // Fiat - African
  "NGN", "KES", "UGX", "RWF",
  // Crypto
  "BTC", "LTC", "DOGE",
];
```

### 2. Backend: `paymentController.ts` (updatePaymentLink)

**File:** `/app/backend/controller/paymentController.ts` (line ~4522)

```typescript
// CURRENT
const validCurrencies = ['USD', 'EUR', 'GBP', 'NGN', 'BRL', 'CAD', 'AUD'];

// UPDATED
const validCurrencies = [
  'USD', 'EUR', 'GBP', 'AUD', 'CAD', 'CHF', 'CNY', 'JPY', 'HKD', 'NZD',
  'NGN', 'KES', 'UGX', 'RWF', 'BRL'
];
```

### 3. Backend: Swagger Documentation

**File:** `/app/backend/swagger/paths/payment.ts`

```typescript
// Update currency enum
currency: { 
  type: 'string', 
  enum: [
    'USD', 'EUR', 'GBP', 'AUD', 'CAD', 'CHF', 'CNY', 'JPY', 'HKD', 'NZD',
    'NGN', 'KES', 'UGX', 'RWF',
    'BTC', 'LTC', 'DOGE'
  ], 
  description: '📝 OPTIONAL: Currency code (defaults to "USD")',
  default: 'USD'
}
```

### 4. Checkout Frontend: Currency Options

**File:** `pages/pay/index.tsx` in checkout repo

```typescript
// CURRENT
export const currencyOptions = [
  { code: 'USD', labelKey: 'currency.USD', icon: <Image src={USDIcon} ... />, currency: 'USD' },
  { code: 'EUR', labelKey: 'currency.EUR', icon: <Image src={EURIcon} ... />, currency: 'EUR' },
  { code: 'NGN', labelKey: 'currency.NGN', icon: <Image src={NGNIcon} ... />, currency: 'NGN' }
]

// UPDATED (add all new currencies)
export const currencyOptions = [
  // Major International
  { code: 'USD', labelKey: 'currency.USD', icon: <Image src={USDIcon} ... />, currency: 'USD', symbol: '$' },
  { code: 'EUR', labelKey: 'currency.EUR', icon: <Image src={EURIcon} ... />, currency: 'EUR', symbol: '€' },
  { code: 'GBP', labelKey: 'currency.GBP', icon: <Image src={GBPIcon} ... />, currency: 'GBP', symbol: '£' },
  { code: 'AUD', labelKey: 'currency.AUD', icon: <Image src={AUDIcon} ... />, currency: 'AUD', symbol: 'A$' },
  { code: 'CAD', labelKey: 'currency.CAD', icon: <Image src={CADIcon} ... />, currency: 'CAD', symbol: 'C$' },
  { code: 'CHF', labelKey: 'currency.CHF', icon: <Image src={CHFIcon} ... />, currency: 'CHF', symbol: 'Fr' },
  { code: 'CNY', labelKey: 'currency.CNY', icon: <Image src={CNYIcon} ... />, currency: 'CNY', symbol: '¥' },
  { code: 'JPY', labelKey: 'currency.JPY', icon: <Image src={JPYIcon} ... />, currency: 'JPY', symbol: '¥' },
  { code: 'HKD', labelKey: 'currency.HKD', icon: <Image src={HKDIcon} ... />, currency: 'HKD', symbol: 'HK$' },
  { code: 'NZD', labelKey: 'currency.NZD', icon: <Image src={NZDIcon} ... />, currency: 'NZD', symbol: 'NZ$' },
  // African
  { code: 'NGN', labelKey: 'currency.NGN', icon: <Image src={NGNIcon} ... />, currency: 'NGN', symbol: '₦' }
]
```

### 5. Checkout Frontend: Flag Icons

Need to add flag images for new currencies in `assets/Icons/flag/`:
- `GBP.png` (UK flag)
- `AUD.png` (Australia flag)
- `CAD.png` (Canada flag)
- `CHF.png` (Switzerland flag)
- `CNY.png` (China flag)
- `JPY.png` (Japan flag)
- `HKD.png` (Hong Kong flag)
- `NZD.png` (New Zealand flag)

### 6. Checkout Frontend: Translations

Update `public/locales/[lang]/common.json`:

```json
{
  "currency": {
    "USD": "US Dollar",
    "EUR": "Euro",
    "GBP": "British Pound",
    "AUD": "Australian Dollar",
    "CAD": "Canadian Dollar",
    "CHF": "Swiss Franc",
    "CNY": "Chinese Yuan",
    "JPY": "Japanese Yen",
    "HKD": "Hong Kong Dollar",
    "NZD": "New Zealand Dollar",
    "NGN": "Nigerian Naira"
  }
}
```

---

## Partial Payment Handling

### Current Implementation (Works with all currencies)

The system already handles partial payments correctly:

1. **Payment Created:** base_amount = 100, base_currency = EUR
2. **Customer Pays Partial:** 0.001 BTC (worth 50 EUR at time of payment)
3. **System Records:**
   - `paid_amount` = 50 (in base_currency EUR)
   - `paid_currency` = BTC
   - `status` = 'partial'
4. **Remaining Amount:** 50 EUR (converted to crypto at current rate)

### Key Points:
- All amounts are stored in `base_currency` for consistency
- Currency conversions happen at payment time
- Partial payments use the **original base_currency** for remaining calculations

---

## Currency Formatting

### Add Currency Formatting Utility

```typescript
// utils/currencyFormat.ts (checkout repo)
export const formatCurrency = (amount: number, currency: string): string => {
  const formats: Record<string, { locale: string; decimals: number }> = {
    USD: { locale: 'en-US', decimals: 2 },
    EUR: { locale: 'de-DE', decimals: 2 },
    GBP: { locale: 'en-GB', decimals: 2 },
    AUD: { locale: 'en-AU', decimals: 2 },
    CAD: { locale: 'en-CA', decimals: 2 },
    CHF: { locale: 'de-CH', decimals: 2 },
    CNY: { locale: 'zh-CN', decimals: 2 },
    JPY: { locale: 'ja-JP', decimals: 0 }, // JPY has no decimals
    HKD: { locale: 'zh-HK', decimals: 2 },
    NZD: { locale: 'en-NZ', decimals: 2 },
    NGN: { locale: 'en-NG', decimals: 2 }
  };

  const format = formats[currency] || { locale: 'en-US', decimals: 2 };
  
  return new Intl.NumberFormat(format.locale, {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: format.decimals,
    maximumFractionDigits: format.decimals
  }).format(amount);
};
```

---

## FastForex API Verification

### Supported Currencies (Verified)

FastForex API supports all requested currencies:
- ✅ USD, EUR, GBP, AUD, CAD, CHF, CNY, JPY, HKD, NZD

### API Call Example:

```bash
curl "https://api.fastforex.io/convert?api_key=YOUR_KEY&from=USD&to=EUR,GBP,AUD,CAD,CHF,CNY,JPY,HKD,NZD&amount=100"
```

---

## Implementation Checklist

### Backend (DynoPay)

- [ ] Update `linkMiddleware.ts` - Add new currencies to allowedCurrency
- [ ] Update `paymentController.ts` - Add currencies to validCurrencies (updatePaymentLink)
- [ ] Update Swagger docs - Expand currency enum
- [ ] Test currency conversion for all new currencies

### Frontend (Checkout)

- [ ] Add flag icons for: GBP, AUD, CAD, CHF, CNY, JPY, HKD, NZD
- [ ] Update currencyOptions array with new currencies
- [ ] Add translations for currency names
- [ ] Test currency selector with all currencies
- [ ] Verify JPY formatting (no decimals)

### Testing

- [ ] Create payment link in each new currency
- [ ] Verify checkout shows correct currency and amount
- [ ] Test partial payment with different currencies
- [ ] Verify settlement records in correct base_currency

---

## Summary

| Component | Changes Required | Effort |
|-----------|-----------------|--------|
| Backend Middleware | Add 6 currencies to array | Low |
| Backend Controller | Add 6 currencies to array | Low |
| Swagger Docs | Update enum | Low |
| Checkout Frontend | Add options + flags + translations | Medium |
| Currency Conversion | No changes (FastForex supports all) | None |
| Partial Payments | No changes (already currency-agnostic) | None |
| Settlement | No changes (uses base_currency) | None |

**Total Effort: Low-Medium**

The architecture is already designed to be currency-agnostic. The main work is adding the new currencies to validation arrays and UI elements.

---

## Questions for Stakeholders

1. **HKZ vs HKD**: You mentioned "HKZ" - did you mean HKD (Hong Kong Dollar)? HKZ is not a valid ISO currency code.

2. **NDZ vs NZD**: You mentioned "NDZ" - did you mean NZD (New Zealand Dollar)?

3. **Currency Display Priority**: Should all 10+ currencies show in dropdown, or should we auto-detect based on user's locale?

4. **Minimum Amounts**: Should minimum payment amounts vary by currency? (e.g., JPY minimum 500 vs USD minimum $5)

---

*Analysis by DynoPay Development Team*
