# DynoCheckoutFIX - Required Changes for Payment Status

## Summary

The checkout page needs to be updated to properly handle payment status from the backend API. The backend has been updated to return proper status values.

---

## Backend Changes (Already Applied to DynoPay Backend)

### Updated `/api/pay/verifyCryptoPayment` Response

The endpoint now returns a `status` field with these values:

| Status | Description | When |
|--------|-------------|------|
| `waiting` | No payment detected | Before any transaction is seen on blockchain |
| `pending` | Payment detected, awaiting confirmation | Transaction seen but not confirmed |
| `confirmed` | Payment fully confirmed | Ready to redirect |
| `failed` | Payment processing failed | Error occurred |

### Response Examples:

```json
// Status: waiting
{
  "message": "Waiting for payment",
  "data": {
    "status": "waiting",
    "message": "No payment detected yet"
  }
}

// Status: pending (SHOW "Payment detected, awaiting confirmation...")
{
  "message": "Payment pending",
  "data": {
    "status": "pending",
    "message": "Payment detected, awaiting confirmation",
    "txId": "abc123...",
    "amount": "35.00",
    "currency": "USDT"
  }
}

// Status: confirmed (SHOW "Payment Confirmed!")
{
  "message": "Payment confirmed",
  "data": {
    "status": "confirmed",
    "message": "Payment confirmed",
    "redirect": "https://merchant.com/success",
    "txId": "abc123...",
    "amount": "35.00",
    "currency": "USDT"
  }
}
```

---

## Frontend Changes Required (DynoCheckoutFIX)

### File: `Components/Page/Pay3Components/cryptoTransfer.tsx`

### Change 1: Remove Fake 10-Second Timer

**DELETE this code (around line 178):**
```javascript
// DELETE THIS ENTIRE BLOCK - IT'S FAKE!
setTimeout(() => {
  setIsStart(true);
}, 10000);
```

### Change 2: Update the Polling Effect

**REPLACE the existing `useEffect` polling logic (around line 230-260) with:**

```tsx
useEffect(() => {
  const isValidSelection =
    selectedCrypto &&
    (selectedCrypto !== "USDT" ||
      ["TRC20", "ERC20"].includes(selectedNetwork));

  if (!isValidSelection || !cryptoDetails?.address) return;

  setIsReceived(false);
  setIsStart(false);

  const pollInterval = setInterval(async () => {
    try {
      const response = await axiosBaseApi.post("/pay/verifyCryptoPayment", {
        address: cryptoDetails?.address,
      });

      const { data } = response.data;
      
      if (data) {
        const paymentStatus = data.status;
        
        if (paymentStatus === "pending") {
          // Payment detected on blockchain, awaiting confirmation
          setIsStart(true);
          setIsReceived(false);
        } else if (paymentStatus === "confirmed") {
          // Payment fully confirmed
          setIsStart(true);
          setIsReceived(true);
          clearInterval(pollInterval);
          
          if (data.redirect) {
            setIsUrl(data.redirect);
          }
        } else if (paymentStatus === "failed") {
          // Payment failed - show error
          clearInterval(pollInterval);
          dispatch({
            type: TOAST_SHOW,
            payload: {
              message: data.message || "Payment processing failed",
              severity: "error"
            }
          });
        }
        // status === "waiting" means no payment yet, continue polling
      }
    } catch (e: any) {
      const message = e?.response?.data?.message ?? e?.message;
      console.error("Payment verification error:", message);
      // Don't show error toast on polling - just log it
    }
  }, 10000); // Poll every 10 seconds

  return () => clearInterval(pollInterval);
}, [selectedCrypto, selectedNetwork, cryptoDetails?.address]);
```

### Change 3: Update UI Text (Optional Enhancement)

In the "Payment Detected" section, update the text to be more accurate:

```tsx
{isStart && !isRecived && (
  <>
    <CircularProgress
      size={30}
      sx={{ color: "#13B76A", my: "16px" }}
    />

    <Typography
      variant="subtitle1"
      fontWeight={500}
      fontFamily="Space Grotesk"
      fontSize={"15px"}
    >
      Payment detected, awaiting confirmation...
    </Typography>
    <Typography
      variant="body2"
      sx={{ color: "#444" }}
      fontSize={"12px"}
      fontWeight={400}
      fontFamily="Space Grotesk"
    >
      Your payment has been detected on the blockchain. <br />
      Please wait while we confirm your transaction...
    </Typography>
  </>
)}
```

---

## Complete Updated `cryptoTransfer.tsx` Polling Section

Here's the complete corrected code for the polling section:

```tsx
// At the top, after getCurrencyRateAndSubmit function
// REMOVE the setTimeout that sets isStart to true after 10 seconds

// Replace the useEffect for polling with this:
useEffect(() => {
  const isValidSelection =
    selectedCrypto &&
    (selectedCrypto !== "USDT" ||
      ["TRC20", "ERC20"].includes(selectedNetwork));

  if (!isValidSelection || !cryptoDetails?.address) return;

  // Reset states when address changes
  setIsReceived(false);
  setIsStart(false);

  const pollInterval = setInterval(async () => {
    try {
      const response = await axiosBaseApi.post("/pay/verifyCryptoPayment", {
        address: cryptoDetails?.address,
      });

      const responseData = response?.data?.data;
      
      if (responseData) {
        const paymentStatus = responseData.status;
        
        switch (paymentStatus) {
          case "pending":
            // Payment detected on blockchain, awaiting confirmation
            // Show: "Payment detected, awaiting confirmation..."
            setIsStart(true);
            setIsReceived(false);
            break;
            
          case "confirmed":
            // Payment fully confirmed
            // Show: "Payment Confirmed!"
            setIsStart(true);
            setIsReceived(true);
            clearInterval(pollInterval);
            
            if (responseData.redirect) {
              setIsUrl(responseData.redirect);
            }
            break;
            
          case "failed":
            // Payment failed
            clearInterval(pollInterval);
            dispatch({
              type: TOAST_SHOW,
              payload: {
                message: responseData.message || "Payment processing failed",
                severity: "error"
              }
            });
            break;
            
          case "waiting":
          default:
            // No payment detected yet, continue polling
            // UI stays in "waiting for payment" state
            break;
        }
      }
    } catch (e: any) {
      // Silent fail on polling - don't spam user with errors
      console.error("[Payment Poll] Error:", e?.message);
    }
  }, 10000); // Poll every 10 seconds

  return () => clearInterval(pollInterval);
}, [selectedCrypto, selectedNetwork, cryptoDetails?.address, dispatch]);
```

---

## Testing

After making these changes:

1. Start a crypto payment on the checkout page
2. **Before sending crypto:** UI should show QR code and address (no "Payment detected" message)
3. **After sending crypto:** Backend webhook triggers `payment.pending` → UI shows "Payment detected, awaiting confirmation..."
4. **After blockchain confirms:** Backend processes → UI shows "Payment Confirmed!" with "Go to Website" button

---

## Visual Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    CORRECT FLOW                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. User selects crypto → QR code displayed                     │
│     └── Backend: status = "waiting"                             │
│     └── UI: Shows QR code, "Send USDT to this address"          │
│                                                                  │
│  2. User sends crypto → Transaction detected on blockchain      │
│     └── Backend: Tatum webhook triggers, status = "pending"     │
│     └── UI: Shows "Payment detected, awaiting confirmation..."  │
│                                                                  │
│  3. Blockchain confirms → Transaction verified                  │
│     └── Backend: status = "confirmed"                           │
│     └── UI: Shows "Payment Confirmed!" + "Go to Website"        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    INCORRECT FLOW (Current)                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ❌ After 10 seconds → Shows "Payment detected" (FAKE!)         │
│     └── This is triggered by setTimeout, not actual detection   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Files Changed

### In DynoPay Backend (this repo):
- `/app/backend/controller/paymentController.ts` - Updated `verifyCryptoPayment` to return proper status
- `/app/backend/swagger/paths/payment.ts` - Updated API documentation

### In DynoCheckoutFIX (separate repo):
- `Components/Page/Pay3Components/cryptoTransfer.tsx` - Needs the changes described above
