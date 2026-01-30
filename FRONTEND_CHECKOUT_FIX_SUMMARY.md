# Frontend Checkout Fixes - Clear Instructions

## Repository: https://github.com/Moxxcompany/DynoCheckoutFIX
## Branch: Payment-Status-Fix

---

## 🔴 CRITICAL BUGS TO FIX

### Bug 1: Crypto Amounts Show Wrong Decimals
**Problem:** `.toFixed(2)` truncates crypto values incorrectly
- Shows "0.01 ETH" instead of "0.00584 ETH"
- Shows "0.00 ETH" excess instead of "0.000389 ETH"

**Fix:** Add this helper function and use it everywhere amounts are displayed:

```tsx
const formatAmount = (amount: number, currency: string): string => {
  const cryptoCurrencies = ['BTC', 'ETH', 'LTC', 'DOGE', 'TRX', 'BCH', 'USDT', 'USDC'];
  const isCrypto = cryptoCurrencies.some(c => currency.toUpperCase().includes(c));
  
  if (isCrypto) {
    // 8 decimals for crypto, remove trailing zeros
    return amount.toFixed(8).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
  }
  return amount.toFixed(2);  // 2 decimals for fiat
};
```

**Files to update:**
- `Components/UI/OverPayment/Index.tsx` - lines displaying paidAmount, expectedAmount, excessAmount
- `Components/UI/UnderPayment/Index.tsx` - lines displaying paidAmount, remainingAmount

---

### Bug 2: Underpayment "Pay Remaining" Creates New Address
**Problem:** When user clicks "Pay with Crypto" to complete partial payment, frontend regenerates a NEW address. This breaks the flow because backend expects payment on the SAME address.

**Fix in `cryptoTransfer.tsx`:**

```tsx
// BEFORE (broken):
const handlePayRemaining = (method: "bank" | "crypto") => {
  setPaymentStatus("waiting");
  setPartialPaymentData(null);
  if (method === "bank") {
    setActiveStep(1);
  } else {
    setIsStart(false);
    setIsReceived(false);
  }
};

// AFTER (fixed):
const handlePayRemaining = (method: "bank" | "crypto") => {
  if (method === "crypto") {
    // KEEP the same address - do NOT regenerate
    setPaymentStatus("waiting");
    setIsStart(true);   // Show QR code with SAME address
    setIsReceived(false);
    // DO NOT clear partialPaymentData or cryptoDetails
  } else {
    setPaymentStatus("waiting");
    setPartialPaymentData(null);
    setActiveStep(1);
  }
};
```

---

### Bug 3: Missing Transaction ID Display
**Problem:** OverPayment and UnderPayment components don't receive/display txId

**Fix:** Update interfaces and component props:

```tsx
// In cryptoTransfer.tsx - update OverpaymentData interface:
interface OverpaymentData {
  paidAmount: number;
  expectedAmount: number;
  excessAmount: number;
  currency: string;
  txId?: string;  // ADD THIS
}

// Update setOverpaymentData call:
setOverpaymentData({
  paidAmount: data?.paidAmount || 0,
  expectedAmount: data?.expectedAmount || 0,
  excessAmount: data?.excessAmount || 0,
  currency: data?.currency || walletState?.currency || "USD",
  txId: data?.txId || "",  // ADD THIS
});

// Update OverPayment component render:
<OverPayment
  paidAmount={overpaymentData.paidAmount}
  expectedAmount={overpaymentData.expectedAmount}
  excessAmount={overpaymentData.excessAmount}
  currency={overpaymentData.currency}
  onGoToWebsite={handleOverpaymentGoToWebsite}
  transactionId={overpaymentData.txId}  // ADD THIS
/>
```

---

### Bug 4: No "Pending" Status Feedback
**Problem:** User sends payment but sees no feedback while waiting for blockchain confirmation

**Fix:** Add case handler in the polling switch statement:

```tsx
case "pending":
  setIsStart(true);
  setIsReceived(false);
  // Show toast notification
  dispatch({
    type: TOAST_SHOW,
    payload: {
      message: "Payment detected! Waiting for blockchain confirmation...",
      severity: "info",
    },
  });
  break;
```

---

### Bug 5: No Grace Period Warning for Underpayments
**Problem:** User doesn't know they have limited time to complete partial payment

**Fix:** Add warning box in `UnderPayment/Index.tsx`:

```tsx
{/* Add after the "Almost there!" text */}
<Box 
  bgcolor="#FEF3C7" 
  borderRadius={2} 
  p={2} 
  mb={2}
  display="flex"
  alignItems="center"
  gap={1}
>
  <Typography
    variant="body2"
    color="#92400E"
    fontFamily="Space Grotesk"
    fontWeight={500}
  >
    ⏰ Please complete payment within 30 minutes to use the same address.
  </Typography>
</Box>
```

---

## 📋 QUICK REFERENCE: Files to Modify

| File | Changes |
|------|---------|
| `Components/UI/OverPayment/Index.tsx` | Add `formatAmount()` helper, use for all amount displays |
| `Components/UI/UnderPayment/Index.tsx` | Add `formatAmount()` helper, use for all amount displays, add grace period warning |
| `Components/Page/Pay3Components/cryptoTransfer.tsx` | Fix `handlePayRemaining()`, add txId to interfaces, add pending case |

---

## 🧪 TESTING CHECKLIST

After fixes, verify:

- [ ] Overpayment shows "0.00584 ETH" not "0.01 ETH"
- [ ] Excess amount shows "0.000389 ETH" not "0.00 ETH"
- [ ] Underpayment shows correct remaining amount with proper decimals
- [ ] Clicking "Pay with Crypto" on underpayment shows SAME address (not new)
- [ ] Transaction ID displayed on both screens
- [ ] "Payment detected!" toast appears when waiting for confirmation
- [ ] Grace period warning visible on underpayment screen

---

## 📡 Backend API Responses Reference

### Underpaid Response (new):
```json
{
  "status": "underpaid",
  "message": "Partial payment received. Please pay the remaining amount.",
  "paidAmount": 0.002,
  "expectedAmount": 0.00547,
  "remainingAmount": 0.00347,
  "currency": "ETH",
  "paidAmountUsd": 5.48,
  "expectedAmountUsd": 15,
  "remainingAmountUsd": 9.52,
  "address": "0x5c8282c96a89f002b908668bab6d5d30c68b610e",
  "txId": "0xabc123...",
  "grace_period_minutes": 30,
  "partial_payment_timestamp": "2026-01-30T12:39:35.104Z"
}
```

### Overpaid Response:
```json
{
  "status": "overpaid",
  "message": "Payment confirmed with overpayment",
  "paidAmount": 0.00547,
  "expectedAmount": 0.00547,
  "excessAmount": 0.0001,
  "currency": "ETH",
  "txId": "0xabc123..."
}
```

### Confirmed Response:
```json
{
  "status": "confirmed",
  "message": "Payment confirmed",
  "paidAmount": 0.00547,
  "expectedAmount": 0.00547,
  "currency": "ETH",
  "txId": "0xabc123..."
}
```
