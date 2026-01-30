# DynoPay Checkout Page Fix Instructions

## Repository: https://github.com/Moxxcompany/DynoCheckoutFIX/tree/Payment-Status-Fix

---

## Issue 1: Overpayment Display Shows Wrong Data

### Problem
The OverPayment component displays amounts with `.toFixed(2)` which is incorrect for crypto amounts:
- Shows "Paid: 0.01 ETH" instead of "Paid: 0.00584 ETH"  
- Shows "Excess: 0.00 ETH" instead of "Excess: 0.000389 ETH"

### File to Fix
`Components/UI/OverPayment/Index.tsx`

### Fix
Replace all `.toFixed(2)` with dynamic decimal formatting:

```tsx
// Add helper function at top of file
const formatCryptoAmount = (amount: number, currency: string): string => {
  // Crypto currencies need more decimal places
  const cryptoCurrencies = ['BTC', 'ETH', 'LTC', 'DOGE', 'TRX', 'BCH', 'USDT-TRC20', 'USDT-ERC20', 'USDC-ERC20'];
  if (cryptoCurrencies.includes(currency.toUpperCase())) {
    // Use 6 decimal places for crypto, remove trailing zeros
    return amount.toFixed(6).replace(/\.?0+$/, '');
  }
  // Fiat currencies use 2 decimal places
  return amount.toFixed(2);
};

// Update line 126:
{formatCryptoAmount(paidAmount, currency)} {currency}

// Update line 166:
{formatCryptoAmount(expectedAmount, currency)} {currency}

// Update line 207:
{formatCryptoAmount(excessAmount, currency)} {currency}
```

---

## Issue 2: UnderPayment Display Missing/Incorrect Data

### Problem
The UnderPayment component may show incorrect or missing amounts.

### File to Fix
`Components/UI/UnderPayment/Index.tsx`

### Fix
Apply same `formatCryptoAmount` helper function as Issue 1.

Also ensure the component receives all required props:
```tsx
interface UnderPaymentProps {
  paidAmount: number;
  expectedAmount: number;
  remainingAmount: number;
  currency: string;
  onPayRemaining: (method: "bank" | "crypto") => void;
  graceMinutes?: number;  // Add grace period display
  partialTimestamp?: string;  // Add time of partial payment
}
```

---

## Issue 3: Ensure Same Temporary Address for Partial Payments

### Backend Behavior (Already Implemented)
The backend already handles this correctly:
- When partial payment is detected, the temp address status is set to "partial"
- The same address is retained with updated `incomplete: "true"` flag in Redis
- Customer can send remaining amount to the same address

### Frontend Fix Required
In `cryptoTransfer.tsx`, ensure the address is NOT regenerated after partial payment:

```tsx
// Around line 516-528, update handlePayRemaining:
const handlePayRemaining = (method: "bank" | "crypto") => {
  if (method === "crypto") {
    // IMPORTANT: Do NOT reset the address - keep using same temp address
    setPaymentStatus("waiting");
    // Keep cryptoDetails unchanged so same address is used
    setIsStart(true);  // Show QR code again
    setIsReceived(false);
  } else {
    setActiveStep(1);
  }
};
```

---

## Issue 4: Backend Response Field Names

### Current Backend Response (Correct)
```json
{
  "status": "overpaid",
  "paidAmount": 0.00584,
  "expectedAmount": 0.005451,
  "excessAmount": 0.000389,
  "currency": "ETH"
}
```

### Frontend Mapping (Already Correct in cryptoTransfer.tsx lines 442-447)
```tsx
setOverpaymentData({
  paidAmount: data?.paidAmount || 0,
  expectedAmount: data?.expectedAmount || 0,
  excessAmount: data?.excessAmount || 0,
  currency: data?.currency || walletState?.currency || "USD",
});
```

---

## Issue 5: Missing transactionId in OverPayment Display

### Problem
The OverPayment component has a default `transactionId = "ABC123456"` but should use actual transaction ID.

### Fix in cryptoTransfer.tsx (around line 551)
```tsx
<OverPayment
  paidAmount={overpaymentData.paidAmount}
  expectedAmount={overpaymentData.expectedAmount}
  excessAmount={overpaymentData.excessAmount}
  currency={overpaymentData.currency}
  onGoToWebsite={handleOverpaymentGoToWebsite}
  transactionId={overpaymentData.txId || ""}  // Add this line
/>
```

### Update overpaymentData state type
```tsx
// Update interface (around line 148-154)
interface OverpaymentData {
  paidAmount: number;
  expectedAmount: number;
  excessAmount: number;
  currency: string;
  txId?: string;  // Add this
}

// Update setOverpaymentData (around line 442)
setOverpaymentData({
  paidAmount: data?.paidAmount || 0,
  expectedAmount: data?.expectedAmount || 0,
  excessAmount: data?.excessAmount || 0,
  currency: data?.currency || walletState?.currency || "USD",
  txId: data?.txId || "",  // Add this
});
```

---

## Issue 6: Pending Status Not Shown

### Problem
When webhook is received but processing, user should see "Payment Detected - Processing"

### Backend Response for Pending
```json
{
  "status": "pending",
  "message": "Payment detected, awaiting confirmation",
  "receivedAmount": 0.00584,
  "expectedAmount": 0.00545
}
```

### Fix in cryptoTransfer.tsx (add case around line 420)
```tsx
case "pending":
  // Payment detected but not yet confirmed
  setIsStart(true);
  setIsReceived(true);  // Show "Payment Received" indicator
  // Optionally show processing message
  dispatch({
    type: TOAST_SHOW,
    payload: {
      message: "Payment detected! Confirming on blockchain...",
      severity: "info",
    },
  });
  // DON'T clear interval - keep polling until confirmed
  break;
```

---

## Summary of Files to Modify

1. **Components/UI/OverPayment/Index.tsx**
   - Add `formatCryptoAmount` helper
   - Update amount displays to use helper
   - Accept and display `transactionId` prop

2. **Components/UI/UnderPayment/Index.tsx**
   - Add `formatCryptoAmount` helper
   - Update amount displays to use helper
   - Add grace period and timestamp display

3. **Components/Page/Pay3Components/cryptoTransfer.tsx**
   - Update OverpaymentData interface to include txId
   - Pass txId to OverPayment component
   - Fix handlePayRemaining to retain same address
   - Add "pending" status case handling

---

## Testing Checklist

- [ ] Overpayment shows correct decimal amounts (6 decimals for crypto)
- [ ] Underpayment shows correct amounts and remaining balance
- [ ] Same address is used for completing partial payment
- [ ] Pending status shows "Payment Detected" message
- [ ] Transaction ID is displayed correctly
- [ ] Confirmed status shows redirect button

---

## Notes on Backend Behavior

### Overpayment Handling
- **Overpaid amount IS included in merchant payout** - the full received amount is distributed
- Merchant receives: `paidAmount * (1 - feePercentage)`
- Admin receives: `paidAmount * feePercentage`
- No separate "excess refund" transaction occurs

### Sweep Timing
- ETH/TRX: Time-based sweep (currently 3 minutes after merchant payout)
- USDT/USDC: Threshold-based sweep ($30-50 minimum)

### Address Reuse
- Temp addresses are reused after admin fee sweep completes
- Status flow: AVAILABLE → IN_USE → (sweep) → AVAILABLE
