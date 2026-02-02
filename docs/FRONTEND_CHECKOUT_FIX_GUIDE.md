# Frontend Checkout Fix Guide
## Processing Fee Display - Pending Crypto Selection

### Problem
The main payment page shows processing fees and adds them to the total BEFORE the customer selects a cryptocurrency. Since processing fees vary by crypto type (network fees differ), the fee should only be finalized after crypto selection.

### Backend API Changes (Already Implemented)
The backend `getData` endpoint now returns:
```json
{
  "fee_info": {
    "fee_payer": "customer",
    "estimated_processing_fee": 3.48,      // Renamed - just an estimate
    "fees_pending_crypto_selection": true,  // NEW FLAG
    "subtotal": 13,
    "tax_amount": 0,
    "total_amount": 13                      // Now EXCLUDES processing fee
  }
}
```

---

## Required Frontend Changes

### File 1: `pages/pay/index.tsx`

#### Change 1: Add state for fee info
Around line 90, add new state:

```typescript
// EXISTING
const [feePayer, setFeePayer] = useState<string>('')
const [linkId, setLinkId] = useState<string>('')

// ADD THESE NEW STATES
const [feeInfo, setFeeInfo] = useState<{
  estimated_processing_fee?: number;
  fees_pending_crypto_selection?: boolean;
  subtotal?: number;
  tax_amount?: number;
  total_amount?: number;
} | null>(null)
```

#### Change 2: Update getQueryData to store fee_info
In the `getQueryData` function (around line 110-145), after setting feePayer, add:

```typescript
// EXISTING
setFeePayer(data.fee_payer || '')
setLinkId(tempToken?.transaction_id || '')

// ADD THIS - Store fee_info from getData response
if (data.fee_info) {
  setFeeInfo(data.fee_info)
}
```

#### Change 3: Update the "To Pay" amount display
Find the section that displays the amount (around line 280-295). Replace the amount display logic:

**BEFORE:**
```typescript
<Typography
  fontWeight={500}
  fontFamily='Space Grotesk'
  fontSize={25}
  color={theme.palette.text.primary}
  sx={{
    fontSize: {
      xs: '12px',
      sm: '18px',
      md: '20px'
    }
  }}
>
  {Number(
    currencyRates?.total_amount_source ?? currencyRates?.amount ?? walletState?.amount
  ).toFixed(2)}{' '}
  {currencyRates?.currency ?? walletState?.currency}
</Typography>
```

**AFTER:**
```typescript
<Typography
  fontWeight={500}
  fontFamily='Space Grotesk'
  fontSize={25}
  color={theme.palette.text.primary}
  sx={{
    fontSize: {
      xs: '12px',
      sm: '18px',
      md: '20px'
    }
  }}
>
  {(() => {
    // If customer pays fees and crypto not selected yet, show subtotal + tax only
    if (feePayer === 'customer' && feeInfo?.fees_pending_crypto_selection) {
      const subtotal = feeInfo?.subtotal || walletState?.amount || 0
      const tax = feeInfo?.tax_amount || 0
      return (subtotal + tax).toFixed(2)
    }
    // Otherwise show the full amount from rates or wallet state
    return Number(
      currencyRates?.total_amount_source ?? currencyRates?.amount ?? walletState?.amount
    ).toFixed(2)
  })()}{' '}
  {currencyRates?.currency ?? walletState?.currency}
</Typography>
```

#### Change 4: Add processing fee hint below the amount
After the amount Typography and before the dropdown Icon, add a fee hint:

```typescript
{/* Processing fee hint when customer pays fees but crypto not selected */}
{feePayer === 'customer' && feeInfo?.fees_pending_crypto_selection && feeInfo?.estimated_processing_fee && (
  <Typography
    variant="caption"
    color={isDark ? theme.palette.text.secondary : '#666'}
    fontFamily='Space Grotesk'
    fontSize={11}
    sx={{ 
      display: 'block',
      mt: 0.5,
      opacity: 0.8
    }}
  >
    + ~{walletState?.currency === 'EUR' ? '€' : '$'}{feeInfo.estimated_processing_fee.toFixed(2)} fee
  </Typography>
)}
```

#### Change 5: Update initial rates fetch to not use fee_payer
In the `getQueryData` function, when fetching initial currency rates (around line 133-146), for the initial display we should NOT pass fee_payer so we get base rates:

**BEFORE:**
```typescript
const ratesResponse = await axiosBaseApi.post('/pay/getCurrencyRates', {
  source: data.base_currency,
  amount: amount,
  currencyList: [data.base_currency],
  fixedDecimal: false,
  fee_payer: data.fee_payer || undefined
});
```

**AFTER:**
```typescript
// For initial display, get base rates without fee calculation
// Fees will be calculated accurately when user selects crypto type
const ratesResponse = await axiosBaseApi.post('/pay/getCurrencyRates', {
  source: data.base_currency,
  amount: amount,
  currencyList: [data.base_currency],
  fixedDecimal: false,
  // Don't pass fee_payer here - let CryptoTransfer handle accurate fee calculation
});
```

---

### File 2: Alternative Simpler Approach (Recommended)

If you want a simpler fix that doesn't require significant changes, just update the amount display to use `feeInfo.total_amount` from getData when available:

In `pages/pay/index.tsx`, around line 282:

**SIMPLE FIX:**
```typescript
<Typography
  fontWeight={500}
  fontFamily='Space Grotesk'
  fontSize={25}
  color={theme.palette.text.primary}
  sx={{
    fontSize: {
      xs: '12px',
      sm: '18px',
      md: '20px'
    }
  }}
>
  {Number(
    // Use fee_info.total_amount if customer pays fees (excludes processing fee)
    (feePayer === 'customer' && feeInfo?.total_amount) 
      ? feeInfo.total_amount 
      : (currencyRates?.total_amount_source ?? currencyRates?.amount ?? walletState?.amount)
  ).toFixed(2)}{' '}
  {currencyRates?.currency ?? walletState?.currency}
</Typography>

{/* Add fee hint */}
{feePayer === 'customer' && feeInfo?.estimated_processing_fee && (
  <Typography
    variant="caption"
    color={isDark ? '#888' : '#666'}
    fontFamily='Space Grotesk'
    fontSize={10}
    display="block"
  >
    + processing fee (varies by crypto)
  </Typography>
)}
```

---

## Summary of Changes

| File | Change | Purpose |
|------|--------|---------|
| `pages/pay/index.tsx` | Add `feeInfo` state | Store fee info from getData |
| `pages/pay/index.tsx` | Update amount display | Show subtotal without fees initially |
| `pages/pay/index.tsx` | Add fee hint | Inform user about pending fees |
| `pages/pay/index.tsx` | (Optional) Remove fee_payer from initial rates call | Prevent pre-calculated fees |

## Testing Checklist

1. ✅ Create payment link with `fee_payer: 'customer'`
2. ✅ On checkout page, verify amount shows subtotal only (not including processing fee)
3. ✅ Verify fee hint is displayed below amount
4. ✅ Select cryptocurrency → verify accurate fees are calculated and displayed
5. ✅ Complete payment → verify correct amounts are processed

6. ✅ Create payment link with `fee_payer: 'company'` (default)
7. ✅ On checkout page, verify amount shows correctly (no processing fee visible to customer)
8. ✅ Complete payment → verify merchant receives amount minus fees

## Backend API Reference

### GET /api/pay/getData Response (fee_payer: customer)
```json
{
  "data": {
    "amount": 13,
    "base_currency": "USD",
    "fee_payer": "customer",
    "fee_info": {
      "fee_payer": "customer",
      "estimated_processing_fee": 3.48,
      "fees_pending_crypto_selection": true,
      "subtotal": 13,
      "tax_amount": 0,
      "total_amount": 13
    }
  }
}
```

### POST /api/pay/getCurrencyRates Response (with fee_payer: customer)
```json
{
  "data": [
    {
      "currency": "BTC",
      "amount": "0.00013245",
      "fee_payer": "customer",
      "base_amount": "0.00013245",
      "processing_fee": 3.41,
      "total_amount": "0.00016789",
      "total_amount_usd": 16.41
    }
  ]
}
```
