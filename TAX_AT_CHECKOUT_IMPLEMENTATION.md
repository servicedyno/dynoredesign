# Tax at Checkout - Implementation Analysis

## Overview

This document outlines how to implement merchant-controlled tax calculation at checkout, where:
1. **Tax is OFF by default** - No tax applied unless merchant explicitly enables it
2. **Merchant enables during payment link creation** - A toggle/flag in the payment link form
3. **Tax calculated based on customer location** - Detected at checkout via IP geolocation
4. **Uses existing Tax API** - APILayer Tax Data API already configured

---

## Current System Analysis

### Existing Tax API ✅
The backend already has a complete tax system:

| Endpoint | Purpose |
|----------|---------|
| `GET /api/tax/rate/:countryCode` | Get VAT/tax rate for a country (cached) |
| `POST /api/tax/validate` | Validate Tax ID / VAT number |
| `GET /api/tax/acronyms` | Get tax acronyms by country |
| `GET /api/tax/lookup?country=Portugal` | Lookup by country name |

**Environment Variables:**
```
TAX_DATA_API_URL=https://api.apilayer.com/tax_data
TAX_DATA_API_KEY=If5U0zLLWBd3GKanYoE5H5zaSpLeQDGo
```

### What's Missing
1. **Payment Link Model** - No `apply_tax` field
2. **Geolocation** - No IP-to-country detection at checkout
3. **getData Endpoint** - Doesn't calculate/return tax info
4. **Checkout UI** - Doesn't display tax breakdown

---

## Implementation Plan

### Phase 1: Backend Schema Changes

#### 1.1 Add `apply_tax` field to Payment Link Model

**File:** `/app/backend/models/userModels/paymentLinkModel.ts`

```typescript
// Add after webhook_url field (around line 104)
apply_tax: {
  type: DataTypes.BOOLEAN,
  defaultValue: false,  // TAX OFF BY DEFAULT
  allowNull: false,
},
```

#### 1.2 Database Migration

```sql
ALTER TABLE tbl_payment_link 
ADD COLUMN IF NOT EXISTS apply_tax BOOLEAN DEFAULT false NOT NULL;
```

---

### Phase 2: Payment Link Creation

#### 2.1 Accept `apply_tax` in createPaymentLink

**File:** `/app/backend/controller/paymentController.ts`

In `createPaymentLink` function, add `apply_tax` to destructuring:

```typescript
const { 
  email, 
  base_currency,
  currency,
  modes, 
  amount,
  base_amount,
  description,
  expire,
  callback_url,
  redirect_url,
  webhook_url,
  fee_payer,
  company_id,
  apply_tax  // NEW: Tax toggle (default: false)
} = req.body;
```

And include in the payment link creation:

```typescript
const links = await paymentLinkModel.create({
  // ... existing fields
  apply_tax: apply_tax || false,  // Default to false
});
```

---

### Phase 3: Geolocation Service

#### 3.1 Create Geolocation Utility

**File:** `/app/backend/utils/geolocation.ts` (NEW)

```typescript
import axios from 'axios';

interface GeoLocationResult {
  country_code: string;
  country_name: string;
  city?: string;
  region?: string;
  ip: string;
  source: 'ip-api' | 'fallback';
}

/**
 * Detect customer country from IP address
 * Uses free ip-api.com service (no API key required, 45 req/min limit)
 * Falls back to request headers if API fails
 */
export const getCountryFromIP = async (ip: string, headers?: any): Promise<GeoLocationResult | null> => {
  try {
    // Skip for localhost/private IPs
    if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
      console.log('[Geolocation] Private IP detected, checking headers for country');
      
      // Try to get from Cloudflare headers (if using CF)
      const cfCountry = headers?.['cf-ipcountry'];
      if (cfCountry && cfCountry !== 'XX') {
        return {
          country_code: cfCountry,
          country_name: cfCountry,
          ip,
          source: 'fallback'
        };
      }
      
      return null;
    }

    // Use ip-api.com (free, no key required)
    const response = await axios.get(`http://ip-api.com/json/${ip}`, {
      timeout: 5000,
      params: {
        fields: 'status,countryCode,country,city,regionName'
      }
    });

    if (response.data.status === 'success') {
      return {
        country_code: response.data.countryCode,
        country_name: response.data.country,
        city: response.data.city,
        region: response.data.regionName,
        ip,
        source: 'ip-api'
      };
    }

    return null;
  } catch (error: any) {
    console.error('[Geolocation] Failed to detect country:', error.message);
    return null;
  }
};

/**
 * Extract client IP from request
 * Handles proxies, load balancers, Cloudflare, etc.
 */
export const getClientIP = (req: any): string => {
  // Priority order for IP detection
  const ip = 
    req.headers['cf-connecting-ip'] ||           // Cloudflare
    req.headers['x-real-ip'] ||                  // Nginx proxy
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||  // Standard proxy
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    req.ip ||
    '127.0.0.1';
  
  // Remove IPv6 prefix if present
  return ip.replace('::ffff:', '');
};
```

---

### Phase 4: Tax Calculation at Checkout

#### 4.1 Create Tax Calculation Endpoint

**File:** `/app/backend/controller/paymentController.ts`

Add new endpoint for calculating tax at checkout:

```typescript
/**
 * Calculate tax for checkout based on customer location
 * POST /api/pay/calculateTax
 * 
 * This is called by the checkout page after detecting customer location
 */
const calculateCheckoutTax = async (req: express.Request, res: express.Response) => {
  try {
    const { payment_reference, country_code } = req.body;
    
    if (!payment_reference) {
      return errorResponseHelper(res, 400, "payment_reference is required");
    }

    // Get payment data from Redis
    const redisData = await getRedisItem("customer-" + payment_reference);
    if (!redisData) {
      return errorResponseHelper(res, 404, "Payment not found");
    }

    const paymentData = JSON.parse(redisData);
    
    // Check if merchant enabled tax for this payment link
    if (!paymentData.apply_tax) {
      return successResponseHelper(res, 200, "Tax not applicable", {
        tax_enabled: false,
        tax_amount: 0,
        tax_rate: 0,
        subtotal: paymentData.base_amount,
        total: paymentData.base_amount
      });
    }

    // If no country detected, can't calculate tax
    if (!country_code) {
      return successResponseHelper(res, 200, "Country not detected", {
        tax_enabled: true,
        tax_amount: 0,
        tax_rate: 0,
        country_detected: false,
        subtotal: paymentData.base_amount,
        total: paymentData.base_amount
      });
    }

    // Get tax rate for customer's country
    const upperCountryCode = country_code.toUpperCase();
    
    // Check cache first
    let taxRate = 0;
    let taxAcronym = 'TAX';
    let countryName = country_code;
    
    const cachedRate = await taxRateModel.findOne({
      where: { country_code: upperCountryCode }
    });

    if (cachedRate) {
      taxRate = parseFloat(cachedRate.dataValues.standard_rate) || 0;
      taxAcronym = cachedRate.dataValues.tax_acronym || 'TAX';
      countryName = cachedRate.dataValues.country_name || country_code;
    } else {
      // Fetch from API
      try {
        const taxResponse = await axios.get(
          `${process.env.TAX_DATA_API_URL}/tax_rates`,
          {
            headers: { apikey: process.env.TAX_DATA_API_KEY },
            params: { country: upperCountryCode },
            timeout: 10000
          }
        );
        
        if (taxResponse.data && taxResponse.data.standard_rate) {
          taxRate = taxResponse.data.standard_rate;
        }
      } catch (taxError) {
        // Use fallback rates
        const FALLBACK_RATES: Record<string, number> = {
          PT: 23, ES: 21, FR: 20, DE: 19, IT: 22, GB: 20, US: 0, // etc.
        };
        taxRate = FALLBACK_RATES[upperCountryCode] || 0;
      }
    }

    // Calculate tax
    const subtotal = Number(paymentData.base_amount);
    const taxAmount = (subtotal * taxRate) / 100;
    const total = subtotal + taxAmount;

    return successResponseHelper(res, 200, "Tax calculated", {
      tax_enabled: true,
      tax_rate: taxRate,
      tax_acronym: taxAcronym,
      tax_amount: parseFloat(taxAmount.toFixed(2)),
      country_code: upperCountryCode,
      country_name: countryName,
      subtotal: parseFloat(subtotal.toFixed(2)),
      total: parseFloat(total.toFixed(2)),
      currency: paymentData.base_currency
    });

  } catch (error: any) {
    console.error('[calculateCheckoutTax] Error:', error.message);
    return errorResponseHelper(res, 500, "Failed to calculate tax");
  }
};
```

#### 4.2 Update getData to Include Tax Flag

In the `getData` function, include `apply_tax` in the response:

```typescript
payload = {
  // ... existing fields
  apply_tax: item.apply_tax || false,  // NEW: Tell checkout if tax should be calculated
};
```

---

### Phase 5: Checkout Integration Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                      CHECKOUT FLOW                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Customer visits payment link                                 │
│     └── Checkout calls: POST /api/pay/getData                    │
│         └── Response includes: { apply_tax: true/false, ... }    │
│                                                                  │
│  2. If apply_tax === true:                                       │
│     └── Checkout detects customer IP                             │
│     └── Checkout calls: POST /api/pay/calculateTax               │
│         └── Request: { payment_reference, country_code }         │
│         └── Response: { tax_rate, tax_amount, total, ... }       │
│                                                                  │
│  3. Checkout displays breakdown:                                 │
│     ┌─────────────────────────────────────┐                      │
│     │ Subtotal              €50.00        │                      │
│     │ VAT (23% - Portugal)  €11.50        │                      │
│     │ ─────────────────────────────────── │                      │
│     │ Total                 €61.50        │                      │
│     └─────────────────────────────────────┘                      │
│                                                                  │
│  4. Customer completes payment with tax-inclusive amount         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## API Reference

### 1. Create Payment Link (Updated)

**Endpoint:** `POST /api/paymentLink/createLink`

**New Parameter:**
| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `apply_tax` | boolean | `false` | Enable tax calculation based on customer location |

**Example Request:**
```json
{
  "amount": 50,
  "currency": "EUR",
  "modes": ["CRYPTO"],
  "description": "Pro Subscription",
  "apply_tax": true,
  "redirect_url": "https://merchant.com/success"
}
```

### 2. Get Payment Data (Updated Response)

**Endpoint:** `POST /api/pay/getData`

**New Response Field:**
```json
{
  "amount": 50,
  "base_currency": "EUR",
  "apply_tax": true,
  "description": "Pro Subscription",
  // ... other fields
}
```

### 3. Calculate Checkout Tax (NEW)

**Endpoint:** `POST /api/pay/calculateTax`

**Request:**
```json
{
  "payment_reference": "abc123...",
  "country_code": "PT"
}
```

**Response (Tax Enabled):**
```json
{
  "success": true,
  "data": {
    "tax_enabled": true,
    "tax_rate": 23,
    "tax_acronym": "VAT",
    "tax_amount": 11.50,
    "country_code": "PT",
    "country_name": "Portugal",
    "subtotal": 50.00,
    "total": 61.50,
    "currency": "EUR"
  }
}
```

**Response (Tax Disabled):**
```json
{
  "success": true,
  "data": {
    "tax_enabled": false,
    "tax_amount": 0,
    "tax_rate": 0,
    "subtotal": 50.00,
    "total": 50.00
  }
}
```

### 4. Detect Customer Location (NEW)

**Endpoint:** `POST /api/pay/detectLocation`

This is called by checkout to get customer's country from their IP.

**Response:**
```json
{
  "success": true,
  "data": {
    "country_code": "PT",
    "country_name": "Portugal",
    "city": "Lisbon",
    "detected": true
  }
}
```

---

## Checkout Page Changes

### Files to Modify

| File | Changes |
|------|---------|
| `pages/pay/index.tsx` | Add state for tax, call detectLocation + calculateTax |
| `public/locales/en/common.json` | Add tax-related translation keys |

### Implementation in Checkout

```typescript
// In pages/pay/index.tsx

// New state
const [taxInfo, setTaxInfo] = useState<{
  enabled: boolean;
  rate: number;
  acronym: string;
  amount: number;
  country_code: string;
  country_name: string;
} | null>(null);

// In getQueryData, after getting data:
if (data.apply_tax) {
  // Detect customer location
  try {
    const locationRes = await axiosBaseApi.post('/pay/detectLocation');
    if (locationRes.data?.data?.country_code) {
      // Calculate tax
      const taxRes = await axiosBaseApi.post('/pay/calculateTax', {
        payment_reference: query_data,
        country_code: locationRes.data.data.country_code
      });
      
      if (taxRes.data?.data) {
        setTaxInfo(taxRes.data.data);
        // Update wallet state with tax-inclusive amount
        if (taxRes.data.data.tax_enabled) {
          setWalletState(prev => ({
            ...prev,
            amount: taxRes.data.data.total
          }));
        }
      }
    }
  } catch (taxError) {
    console.log('Tax calculation failed, proceeding without tax');
  }
}
```

### UI Display

```tsx
{/* Tax Breakdown (only if tax enabled) */}
{taxInfo?.enabled && taxInfo.amount > 0 && (
  <Box display='flex' justifyContent='space-between' mb={1}>
    <Typography variant='body2' color='text.secondary'>
      {taxInfo.acronym} ({taxInfo.rate}% - {taxInfo.country_name})
    </Typography>
    <Typography fontWeight={500}>
      {walletState.currency} {taxInfo.amount.toFixed(2)}
    </Typography>
  </Box>
)}
```

---

## Dashboard UI Changes

### Payment Link Creation Form

Add a toggle in the post-payment settings section:

```tsx
{/* Apply Tax Toggle */}
<FormControlLabel
  control={
    <Switch
      checked={applyTax}
      onChange={(e) => setApplyTax(e.target.checked)}
      color="primary"
    />
  }
  label={
    <Box>
      <Typography fontWeight={500}>Apply Tax</Typography>
      <Typography variant="caption" color="text.secondary">
        Calculate tax based on customer's location (VAT, GST, etc.)
      </Typography>
    </Box>
  }
/>
```

---

## Summary

| Component | Change | Status |
|-----------|--------|--------|
| **Payment Link Model** | Add `apply_tax` boolean field | To implement |
| **createPaymentLink** | Accept `apply_tax` parameter | To implement |
| **getData** | Return `apply_tax` flag | To implement |
| **calculateTax** | NEW endpoint for tax calculation | To implement |
| **detectLocation** | NEW endpoint for IP geolocation | To implement |
| **geolocation.ts** | NEW utility for IP-to-country | To implement |
| **Dashboard UI** | Add tax toggle in payment link form | To implement |
| **Checkout UI** | Display tax breakdown | To implement |

**Key Principle:** Tax is **OFF by default**. Merchant must explicitly enable it for each payment link.
