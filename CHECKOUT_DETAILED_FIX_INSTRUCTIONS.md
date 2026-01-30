# DynoPay Checkout Page - Detailed Fix Instructions

## Repository: https://github.com/Moxxcompany/DynoCheckoutFIX
## Branch: Payment-Status-Fix

---

# FILE 1: Components/UI/OverPayment/Index.tsx

## Current Issue
The component uses `.toFixed(2)` for all amounts, which truncates crypto values incorrectly:
- Shows "0.01 ETH" instead of "0.00584 ETH"
- Shows "0.00 ETH" excess instead of "0.000389 ETH"

## Complete Fixed Code

```tsx
import React from "react";
import {
  Box,
  Button,
  Divider,
  IconButton,
  Paper,
  Typography,
} from "@mui/material";
import CopyIcon from "@/assets/Icons/CopyIcon";
import OverPaymentIcon from "@/assets/Icons/OverPaymentIcon";
import DoneIcon from "@mui/icons-material/Done";

interface OverPaymentProps {
  paidAmount: number;
  expectedAmount: number;
  excessAmount: number;
  currency: string;
  onGoToWebsite: () => void;
  transactionId?: string;
}

// Helper function to format amounts correctly for crypto vs fiat
const formatAmount = (amount: number, currency: string): string => {
  const cryptoCurrencies = [
    'BTC', 'ETH', 'LTC', 'DOGE', 'TRX', 'BCH', 
    'USDT', 'USDT-TRC20', 'USDT-ERC20', 'USDC', 'USDC-ERC20'
  ];
  
  const isCrypto = cryptoCurrencies.some(c => 
    currency.toUpperCase().includes(c)
  );
  
  if (isCrypto) {
    // For crypto: use up to 8 decimals, remove trailing zeros
    const formatted = amount.toFixed(8);
    // Remove trailing zeros but keep at least 2 decimal places
    return formatted.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
  }
  
  // For fiat: use 2 decimal places
  return amount.toFixed(2);
};

const OverPayment = ({
  paidAmount,
  expectedAmount,
  excessAmount,
  currency,
  onGoToWebsite,
  transactionId = "",
}: OverPaymentProps) => {
  const handleCopyTransactionId = () => {
    if (transactionId) {
      navigator.clipboard.writeText(transactionId);
    }
  };

  return (
    <>
      <Box
        display="flex"
        alignItems="center"
        justifyContent="center"
        bgcolor="#F8FAFC"
        px={2}
        minHeight={"calc(100vh - 340px)"}
      >
        <Paper
          elevation={3}
          sx={{
            borderRadius: 4,
            p: 4,
            width: "100%",
            maxWidth: 500,
            marginTop: 10,
            textAlign: "center",
            margin: 0,
            border: "1px solid #E7EAFD",
            boxShadow: "0px 45px 64px 0px #0D03230F",
          }}
        >
          <Box display="flex" justifyContent="center" mb={2}>
            <OverPaymentIcon />
          </Box>

          <Typography
            variant="h6"
            fontWeight={500}
            fontSize={25}
            gutterBottom
            fontFamily="Space Grotesk"
          >
            Overpayment Received
          </Typography>

          <Typography
            variant="body2"
            color="#000"
            mb={3}
            fontFamily="Space Grotesk"
          >
            Thanks! You&apos;ve paid a bit extra.
          </Typography>

          <Box
            alignItems="center"
            border="1px solid #E2E8F0"
            borderRadius={2}
            px={2}
            mb={2}
          >
            <Box
              display="flex"
              justifyContent="space-between"
              alignItems="center"
              py={2}
            >
              <Typography
                variant="subtitle2"
                fontWeight={400}
                fontSize={16}
                color="#515151"
                fontFamily="Space Grotesk"
                sx={{
                  fontSize: { xs: "12px", sm: "14px", md: "16px" },
                }}
              >
                Paid:
              </Typography>

              <Typography
                variant="subtitle2"
                fontWeight={400}
                color="#515151"
                fontSize={16}
                fontFamily="Space Grotesk"
                sx={{
                  fontSize: { xs: "12px", sm: "14px", md: "16px" },
                }}
              >
                {formatAmount(paidAmount, currency)} {currency}
              </Typography>
            </Box>

            <Box
              display="flex"
              justifyContent="space-between"
              alignItems="center"
            >
              <Typography
                variant="subtitle2"
                fontWeight={400}
                fontSize={16}
                color="#515151"
                fontFamily="Space Grotesk"
                sx={{
                  fontSize: { xs: "12px", sm: "14px", md: "16px" },
                }}
              >
                Total Due:
              </Typography>

              <Typography
                variant="subtitle2"
                fontWeight={400}
                color="#515151"
                fontSize={16}
                fontFamily="Space Grotesk"
                sx={{
                  fontSize: { xs: "12px", sm: "14px", md: "16px" },
                }}
              >
                {formatAmount(expectedAmount, currency)} {currency}
              </Typography>
            </Box>

            <Box
              display="flex"
              justifyContent="space-between"
              alignItems="center"
              py={2}
            >
              <Typography
                variant="subtitle2"
                fontWeight={500}
                fontSize={20}
                color="#000"
                fontFamily="Space Grotesk"
                sx={{
                  fontSize: { xs: "14px", sm: "16px", md: "20px" },
                }}
              >
                Excess:
              </Typography>

              <Typography
                variant="subtitle2"
                fontWeight={500}
                color="#000"
                fontSize={20}
                fontFamily="Space Grotesk"
                sx={{
                  fontSize: { xs: "14px", sm: "16px", md: "20px" },
                }}
              >
                {formatAmount(excessAmount, currency)} {currency}
              </Typography>
            </Box>

            <Divider sx={{ mb: 2 }} />

            <Box
              mt={1}
              mb={2}
              borderRadius={2}
              display="flex"
              alignItems="center"
              bgcolor={"#F5F8FF"}
              gap={1}
              px={2}
              py={1}
            >
              <DoneIcon
                sx={{
                  fontSize: 17,
                  color: "#12B76A",
                }}
              />
              <Typography
                fontSize={14}
                color={"#515151"}
                fontFamily="Space Grotesk"
                textAlign="justify"
                fontWeight={500}
              >
                Excess amount will be refunded to your Wallet of the store you
                purchased from.
              </Typography>
            </Box>

            <Box display="flex" gap={2} mb={2}>
              <Button
                fullWidth
                variant="outlined"
                onClick={onGoToWebsite}
                sx={{
                  borderColor: "#4F46E5",
                  color: "#4F46E5",
                  textTransform: "none",
                  borderRadius: 30,
                  paddingTop: 2,
                  paddingBottom: 2,
                  "&:hover": {
                    backgroundColor: "#EEF2FF",
                    borderColor: "#4F46E5",
                  },
                }}
                endIcon={<span style={{ fontSize: "1.2rem" }}>→</span>}
              >
                Go to Website
              </Button>
            </Box>
          </Box>

          {transactionId && (
            <Box display="flex" justifyContent="space-between" mt={3}>
              <Typography
                variant="caption"
                color="#515151"
                fontWeight={400}
                fontSize={12}
                sx={{ textAlign: "left" }}
              >
                Transaction ID:
              </Typography>

              <Box display="flex" alignItems="center" gap={1}>
                <Typography
                  variant="caption"
                  fontWeight={400}
                  fontSize={12}
                  color="#515151"
                  sx={{ 
                    maxWidth: 150, 
                    overflow: "hidden", 
                    textOverflow: "ellipsis" 
                  }}
                >
                  {transactionId.substring(0, 20)}...
                </Typography>

                <IconButton
                  size="small"
                  onClick={handleCopyTransactionId}
                  sx={{
                    bgcolor: "#EEF2FF",
                    p: 0.5,
                    borderRadius: 2,
                    "&:hover": { bgcolor: "#E0E7FF" },
                  }}
                >
                  <CopyIcon />
                </IconButton>
              </Box>
            </Box>
          )}
        </Paper>
      </Box>
    </>
  );
};

export default OverPayment;
```

---

# FILE 2: Components/UI/UnderPayment/Index.tsx

## Current Issue
- Uses `.toFixed(2)` for crypto amounts
- Missing grace period countdown display
- Missing proper transaction ID display

## Changes Required

### Line 87 - Fix convertedRemaining calculation for crypto:
```tsx
// BEFORE:
const convertedRemaining = ((remainingAmount / baseRate) * targetRate).toFixed(2);

// AFTER:
const formatAmount = (amount: number, curr: string): string => {
  const cryptoCurrencies = ['BTC', 'ETH', 'LTC', 'DOGE', 'TRX', 'BCH', 'USDT', 'USDC'];
  const isCrypto = cryptoCurrencies.some(c => curr.toUpperCase().includes(c));
  if (isCrypto) {
    return amount.toFixed(8).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
  }
  return amount.toFixed(2);
};

const convertedRemaining = formatAmount((remainingAmount / baseRate) * targetRate, selected?.code || currency);
```

### Line 185 - Fix paidAmount display:
```tsx
// BEFORE:
{paidAmount.toFixed(2)} {currency}

// AFTER:
{formatAmount(paidAmount, currency)} {currency}
```

### Add grace period display after line 139:
```tsx
<Typography
  variant="body2"
  color="#000"
  mb={3}
  fontFamily="Space Grotesk"
>
  Almost there! Please complete the payment.
</Typography>

{/* ADD THIS - Grace Period Warning */}
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

# FILE 3: Components/Page/Pay3Components/cryptoTransfer.tsx

## Changes Required

### 1. Update OverpaymentData interface (around line 148-154)

```tsx
// BEFORE:
interface OverpaymentData {
  paidAmount: number;
  expectedAmount: number;
  excessAmount: number;
  currency: string;
}

// AFTER:
interface OverpaymentData {
  paidAmount: number;
  expectedAmount: number;
  excessAmount: number;
  currency: string;
  txId?: string;  // ADD THIS
}
```

### 2. Update PartialPaymentData interface (add after OverpaymentData)

```tsx
interface PartialPaymentData {
  paidAmount: number;
  expectedAmount: number;
  remainingAmount: number;
  currency: string;
  txId?: string;           // ADD THIS
  graceMinutes?: number;   // ADD THIS
  address?: string;        // ADD THIS - to retain same address
}
```

### 3. Update setOverpaymentData (around line 442-447)

```tsx
// BEFORE:
setOverpaymentData({
  paidAmount: data?.paidAmount || 0,
  expectedAmount: data?.expectedAmount || 0,
  excessAmount: data?.excessAmount || 0,
  currency: data?.currency || walletState?.currency || "USD",
});

// AFTER:
setOverpaymentData({
  paidAmount: data?.paidAmount || 0,
  expectedAmount: data?.expectedAmount || 0,
  excessAmount: data?.excessAmount || 0,
  currency: data?.currency || walletState?.currency || "USD",
  txId: data?.txId || "",  // ADD THIS
});
```

### 4. Update setPartialPaymentData (around line 429-434)

```tsx
// BEFORE:
setPartialPaymentData({
  paidAmount: data?.paidAmount || 0,
  expectedAmount: data?.expectedAmount || 0,
  remainingAmount: data?.remainingAmount || 0,
  currency: data?.currency || walletState?.currency || "USD",
});

// AFTER:
setPartialPaymentData({
  paidAmount: data?.paidAmount || 0,
  expectedAmount: data?.expectedAmount || 0,
  remainingAmount: data?.remainingAmount || 0,
  currency: data?.currency || walletState?.currency || "USD",
  txId: data?.txId || "",           // ADD THIS
  graceMinutes: data?.grace_period_minutes || 30,  // ADD THIS
  address: cryptoDetails?.address,  // ADD THIS - retain address
});
```

### 5. Fix handlePayRemaining function (around line 516-528)

```tsx
// BEFORE:
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

// AFTER:
const handlePayRemaining = (method: "bank" | "crypto") => {
  if (method === "crypto") {
    // IMPORTANT: Keep the same address for partial payment completion
    // Do NOT regenerate address or clear cryptoDetails
    setPaymentStatus("waiting");
    setIsStart(true);   // Show QR code again with SAME address
    setIsReceived(false);
    // Keep partialPaymentData so we retain the address
    // The same temp address will accept the remaining payment
  } else {
    // Bank transfer - reset for different payment method
    setPaymentStatus("waiting");
    setPartialPaymentData(null);
    setActiveStep(1);
  }
};
```

### 6. Update OverPayment component render (around line 551-558)

```tsx
// BEFORE:
<OverPayment
  paidAmount={overpaymentData.paidAmount}
  expectedAmount={overpaymentData.expectedAmount}
  excessAmount={overpaymentData.excessAmount}
  currency={overpaymentData.currency}
  onGoToWebsite={handleOverpaymentGoToWebsite}
/>

// AFTER:
<OverPayment
  paidAmount={overpaymentData.paidAmount}
  expectedAmount={overpaymentData.expectedAmount}
  excessAmount={overpaymentData.excessAmount}
  currency={overpaymentData.currency}
  onGoToWebsite={handleOverpaymentGoToWebsite}
  transactionId={overpaymentData.txId}  // ADD THIS
/>
```

### 7. Update UnderPayment component render (around line 536-545)

```tsx
// BEFORE:
<UnderPayment
  paidAmount={partialPaymentData.paidAmount}
  expectedAmount={partialPaymentData.expectedAmount}
  remainingAmount={partialPaymentData.remainingAmount}
  currency={partialPaymentData.currency}
  onPayRemaining={handlePayRemaining}
/>

// AFTER:
<UnderPayment
  paidAmount={partialPaymentData.paidAmount}
  expectedAmount={partialPaymentData.expectedAmount}
  remainingAmount={partialPaymentData.remainingAmount}
  currency={partialPaymentData.currency}
  onPayRemaining={handlePayRemaining}
  transactionId={partialPaymentData.txId}  // ADD THIS
/>
```

### 8. Add "pending" case handling (around line 411-415)

```tsx
case "pending":
  // Payment detected, awaiting blockchain confirmation
  setIsStart(true);
  setIsReceived(false);
  // Show user feedback that payment was detected
  dispatch({
    type: TOAST_SHOW,
    payload: {
      message: "Payment detected! Waiting for blockchain confirmation...",
      severity: "info",
    },
  });
  // Don't clear interval - keep polling until confirmed/failed
  break;
```

---

# SUMMARY OF ALL CHANGES

| File | Line(s) | Change |
|------|---------|--------|
| `Components/UI/OverPayment/Index.tsx` | All | Replace entire file with fixed version |
| `Components/UI/UnderPayment/Index.tsx` | 87, 185 | Add formatAmount helper, use it for displays |
| `Components/UI/UnderPayment/Index.tsx` | After 139 | Add grace period warning box |
| `Components/Page/Pay3Components/cryptoTransfer.tsx` | ~148-154 | Add txId to OverpaymentData interface |
| `Components/Page/Pay3Components/cryptoTransfer.tsx` | After interface | Add address, txId, graceMinutes to PartialPaymentData |
| `Components/Page/Pay3Components/cryptoTransfer.tsx` | ~442-447 | Add txId to setOverpaymentData |
| `Components/Page/Pay3Components/cryptoTransfer.tsx` | ~429-434 | Add txId, graceMinutes, address to setPartialPaymentData |
| `Components/Page/Pay3Components/cryptoTransfer.tsx` | ~516-528 | Fix handlePayRemaining to retain same address |
| `Components/Page/Pay3Components/cryptoTransfer.tsx` | ~551-558 | Pass txId to OverPayment component |
| `Components/Page/Pay3Components/cryptoTransfer.tsx` | ~536-545 | Pass txId to UnderPayment component |
| `Components/Page/Pay3Components/cryptoTransfer.tsx` | ~411-415 | Add pending case with toast notification |

---

# BACKEND API RESPONSE REFERENCE

## Confirmed Payment Response
```json
{
  "status": "confirmed",
  "message": "Payment confirmed",
  "redirect": "https://merchant.com/success?tx=...",
  "txId": "0xabc123...",
  "paidAmount": 0.00584,
  "expectedAmount": 0.00545,
  "currency": "ETH",
  "completedAt": "2026-01-30T00:23:45.474Z"
}
```

## Overpaid Response
```json
{
  "status": "overpaid",
  "message": "Payment confirmed with overpayment",
  "redirect": "https://merchant.com/success?tx=...",
  "txId": "0xabc123...",
  "paidAmount": 0.00584,
  "expectedAmount": 0.00545,
  "excessAmount": 0.000389,
  "currency": "ETH",
  "completedAt": "2026-01-30T00:23:45.474Z"
}
```

## Underpaid Response
```json
{
  "status": "underpaid",
  "message": "Partial payment received. Please pay the remaining amount.",
  "paidAmount": 0.003,
  "expectedAmount": 0.00545,
  "remainingAmount": 0.00245,
  "currency": "ETH",
  "txId": "0xabc123...",
  "grace_period_minutes": 30,
  "partial_payment_timestamp": "2026-01-30T00:20:00.000Z"
}
```

## Pending Response
```json
{
  "status": "pending",
  "message": "Payment detected, awaiting confirmation",
  "receivedAmount": 0.00584,
  "expectedAmount": 0.00545,
  "currency": "ETH"
}
```

---

# TESTING CHECKLIST

After applying fixes:

- [ ] **Overpayment Display**: Shows correct decimal amounts (e.g., "0.00584 ETH" not "0.01 ETH")
- [ ] **Overpayment Excess**: Shows actual excess (e.g., "0.000389 ETH" not "0.00 ETH")
- [ ] **Underpayment Display**: Shows correct remaining amount with proper decimals
- [ ] **Same Address Retention**: When clicking "Pay with Crypto" on underpayment screen, same address is shown
- [ ] **Transaction ID Display**: Both overpayment and underpayment show actual transaction ID
- [ ] **Pending Status**: Shows "Payment detected!" toast when payment is seen but not confirmed
- [ ] **Grace Period Warning**: Underpayment screen shows 30-minute warning

---

# IMPORTANT NOTES

1. **Overpayment is distributed to merchant**: The full paid amount (including excess) is split between merchant and admin fees. There is no separate "refund" transaction.

2. **Same address for partial payments**: The backend keeps the temp address in "partial" status. Customer MUST send remaining payment to the SAME address within the grace period.

3. **Do NOT regenerate address**: When user clicks "Pay with Crypto" to complete partial payment, the frontend must NOT call addPayment again. It should reuse the existing cryptoDetails.address.
