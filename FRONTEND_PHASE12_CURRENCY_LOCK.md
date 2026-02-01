# Frontend Checkout Fix Guide - Phase 12
## Incomplete Payment Currency Lock

### Problem
When a customer makes a partial payment in one cryptocurrency (e.g., BTC), they should not be able to switch to a different cryptocurrency (e.g., ETH) until:
1. They complete the payment on the same currency, OR
2. The 30-minute grace period expires

### Backend API Changes (Implemented)

#### 1. `getData` Response - New `incomplete_payment` Field
When a partial payment exists, the response includes:
```json
{
  "data": {
    "amount": 100,
    "fee_payer": "company",
    "incomplete_payment": {
      "exists": true,
      "currency": "BTC",
      "address": "bc1qxy2kgdygjrsqtzq2n0yrf...",
      "pending_amount": "0.0005",
      "pending_usd": 50,
      "timestamp": "2024-02-01T15:00:00.000Z",
      "remaining_minutes": 24,
      "qr_code": "data:image/png;base64,..."
    }
  }
}
```

When no partial payment exists:
```json
{
  "data": {
    "amount": 100,
    "fee_payer": "company"
    // incomplete_payment field is NOT present
  }
}
```

#### 2. `createCryptoPayment` - Currency Lock Validation
- If customer tries to switch currency with active partial payment → **400 error**
- If customer requests same currency → Returns existing address (no new address created)

**Error Response (trying to switch currency):**
```json
{
  "success": false,
  "message": "You have an incomplete payment of 0.0005 BTC. Please complete it or wait for expiry (24 minutes remaining) before switching currencies.",
  "statusCode": 400
}
```

**Success Response (same currency - continue existing):**
```json
{
  "success": true,
  "message": "Continue existing payment",
  "data": {
    "address": "bc1qxy2kgdygjrsqtzq2n0yrf...",
    "amount": "0.0005",
    "currency": "BTC",
    "qr_code": "data:image/png;base64,...",
    "remaining_minutes": 24,
    "is_continuation": true,
    "message": "You have 24 minutes to complete your payment of 0.0005 BTC"
  }
}
```

---

## Required Frontend Changes

### File: `pages/pay/index.tsx`

#### Change 1: Add state for incomplete payment
```typescript
// Add new state for incomplete payment tracking
const [incompletePayment, setIncompletePayment] = useState<{
  exists: boolean;
  currency: string;
  address: string;
  pending_amount: string;
  remaining_minutes: number;
  qr_code?: string;
} | null>(null);
```

#### Change 2: Check for incomplete payment in getQueryData
```typescript
// In getQueryData function, after getting data from getData API:
if (data.incomplete_payment?.exists) {
  setIncompletePayment(data.incomplete_payment);
  
  // IMPORTANT: Lock currency selector to only show the incomplete payment currency
  // Filter available currencies to only include the locked currency
  setAvailableCurrencies([data.incomplete_payment.currency]);
  
  console.log(`[Incomplete Payment] Locked to ${data.incomplete_payment.currency}, ${data.incomplete_payment.remaining_minutes} mins remaining`);
}
```

#### Change 3: Currency Selector - Lock when incomplete payment exists
```typescript
// In the currency dropdown/selector component:
<Select 
  disabled={!!incompletePayment} 
  value={selectedCurrency}
  onChange={handleCurrencyChange}
>
  {incompletePayment ? (
    // Only show the locked currency
    <Option value={incompletePayment.currency}>
      {incompletePayment.currency} (Complete pending payment)
    </Option>
  ) : (
    // Show all available currencies
    availableCurrencies.map(currency => (
      <Option key={currency} value={currency}>{currency}</Option>
    ))
  )}
</Select>
```

#### Change 4: Show incomplete payment warning banner
```typescript
// Add a warning banner when incomplete payment exists
{incompletePayment && (
  <Alert severity="warning" sx={{ mb: 2 }}>
    <AlertTitle>Incomplete Payment</AlertTitle>
    <Typography variant="body2">
      You have a pending payment of <strong>{incompletePayment.pending_amount} {incompletePayment.currency}</strong>.
      Please complete it within <strong>{incompletePayment.remaining_minutes} minutes</strong> or wait for it to expire.
    </Typography>
    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
      Address: {incompletePayment.address}
    </Typography>
  </Alert>
)}
```

#### Change 5: Handle createCryptoPayment continuation response
```typescript
// In the function that calls createCryptoPayment:
const handleCreateCryptoPayment = async (currency: string) => {
  try {
    const response = await axiosBaseApi.post('/pay/createCryptoPayment', {
      uniqueRef: paymentRef,
      currency: currency,
    });
    
    // Check if this is a continuation of existing payment
    if (response.data.data.is_continuation) {
      // Show continuation message
      setMessage(response.data.data.message);
      // Use existing address and QR code
      setCryptoAddress(response.data.data.address);
      setCryptoAmount(response.data.data.amount);
      setQrCode(response.data.data.qr_code);
    } else {
      // Normal new payment flow
      setCryptoAddress(response.data.data.address);
      setCryptoAmount(response.data.data.amount);
      setQrCode(response.data.data.qr_code);
    }
  } catch (error) {
    if (error.response?.status === 400) {
      // Currency switch blocked - show error message
      setError(error.response.data.message);
    }
  }
};
```

#### Change 6: Auto-refresh remaining time
```typescript
// Add useEffect to countdown remaining time
useEffect(() => {
  if (!incompletePayment) return;
  
  const interval = setInterval(() => {
    setIncompletePayment(prev => {
      if (!prev) return null;
      const newRemaining = prev.remaining_minutes - 1;
      
      if (newRemaining <= 0) {
        // Grace period expired - refresh to unlock currencies
        window.location.reload();
        return null;
      }
      
      return { ...prev, remaining_minutes: newRemaining };
    });
  }, 60000); // Update every minute
  
  return () => clearInterval(interval);
}, [incompletePayment]);
```

---

### File: `Components/Page/Pay3Components/cryptoTransfer.tsx`

#### Change 1: Handle continuation response
The CryptoTransfer component should check for `is_continuation` flag:

```typescript
// After calling createCryptoPayment:
if (response.data.is_continuation) {
  // This is a continuation of existing partial payment
  // Don't create new timeout - use remaining time from response
  setRemainingMinutes(response.data.remaining_minutes);
  setIsContinuation(true);
}
```

---

## Summary of Changes

| Component | Change | Purpose |
|-----------|--------|---------|
| `pages/pay/index.tsx` | Add `incompletePayment` state | Track incomplete payment info |
| `pages/pay/index.tsx` | Filter currency list when locked | Prevent currency switching |
| `pages/pay/index.tsx` | Show warning banner | Inform user of pending payment |
| `pages/pay/index.tsx` | Handle continuation response | Reuse existing address |
| `pages/pay/index.tsx` | Auto-refresh countdown | Update remaining time |
| `cryptoTransfer.tsx` | Handle `is_continuation` flag | Adjust timeout handling |

---

## Testing Checklist

### Scenario 1: Normal Payment (No Partial)
1. ✅ Open checkout page
2. ✅ All currencies should be available in dropdown
3. ✅ Select any currency → generates new address
4. ✅ Complete full payment → success

### Scenario 2: Partial Payment → Same Currency
1. ✅ Open checkout page, select BTC
2. ✅ Pay 50% of amount
3. ✅ Refresh page → should see incomplete_payment info
4. ✅ Currency dropdown should be locked to BTC only
5. ✅ Warning banner should show pending amount and remaining time
6. ✅ Try to select BTC again → should return SAME address (not new)
7. ✅ Complete remaining payment → success

### Scenario 3: Partial Payment → Try to Switch Currency
1. ✅ Open checkout page, select BTC
2. ✅ Pay 50% of amount
3. ✅ Refresh page
4. ✅ Currency dropdown should be locked to BTC only
5. ✅ If somehow user tries ETH (via API) → should get 400 error
6. ✅ Error message: "You have an incomplete payment of X BTC..."

### Scenario 4: Grace Period Expiry
1. ✅ Make partial payment in BTC
2. ✅ Wait 30 minutes
3. ✅ Refresh page → incomplete_payment should be cleared
4. ✅ All currencies should be available again
5. ✅ Can now select different currency

---

## API Reference

### GET /api/pay/getData Response Fields
```typescript
interface GetDataResponse {
  data: {
    amount: number;
    base_currency: string;
    fee_payer: 'customer' | 'company';
    // ... other fields ...
    
    // NEW: Incomplete payment info (only present if partial payment exists)
    incomplete_payment?: {
      exists: true;
      currency: string;           // e.g., "BTC"
      address: string;            // Crypto address to pay
      pending_amount: string;     // Remaining crypto amount
      pending_usd: number;        // Remaining USD value
      timestamp: string;          // ISO timestamp of partial payment
      remaining_minutes: number;  // Minutes until grace period expires
      qr_code?: string;          // QR code data URL
    };
  };
}
```

### POST /api/pay/createCryptoPayment Response
```typescript
// Normal new payment
interface NewPaymentResponse {
  success: true;
  message: "Payment created successfully";
  data: {
    address: string;
    amount: string;
    currency: string;
    qr_code: string;
    // ... other fields
  };
}

// Continuation of existing payment
interface ContinuationResponse {
  success: true;
  message: "Continue existing payment";
  data: {
    address: string;
    amount: string;
    currency: string;
    qr_code: string;
    remaining_minutes: number;
    is_continuation: true;
    message: string;
  };
}

// Error - trying to switch currency
interface SwitchBlockedResponse {
  success: false;
  message: "You have an incomplete payment of X BTC. Please complete it or wait for expiry (Y minutes remaining) before switching currencies.";
  statusCode: 400;
}
```
