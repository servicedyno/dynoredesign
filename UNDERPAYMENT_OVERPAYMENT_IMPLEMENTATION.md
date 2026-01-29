# Complete Implementation Guide: Underpayment & Overpayment Handling

## Overview

This document provides complete implementation details for integrating underpayment (partial payment) and overpayment handling between DynoPay Backend and DynoCheckoutFIX frontend.

---

## Part 1: Backend Changes (Already Applied)

### Updated `/api/pay/verifyCryptoPayment` Response

The endpoint now returns 6 different status values:

| Status | Description | UI Action |
|--------|-------------|-----------|
| `waiting` | No payment detected | Show QR code, keep polling |
| `pending` | Payment detected, confirming | Show "Payment detected, awaiting confirmation..." |
| `partial` | Underpayment received | Show UnderPayment component |
| `confirmed` | Full payment confirmed | Show "Payment Confirmed!" + redirect |
| `overpayment` | Paid more than required | Show OverPayment component + redirect |
| `failed` | Payment failed | Show error message |

### Response Examples

#### 1. Partial Payment (Underpayment)
```json
{
  "message": "Partial payment received",
  "data": {
    "status": "partial",
    "message": "Partial payment received. Please pay the remaining amount.",
    "paid_amount": "20.000000",
    "expected_amount": "35.000000",
    "remaining_amount": "15.000000",
    "currency": "USDT",
    "txId": "abc123...",
    "grace_period_minutes": 30,
    "partial_payment_timestamp": "2025-01-29T10:30:00.000Z"
  }
}
```

#### 2. Overpayment
```json
{
  "message": "Payment confirmed with overpayment",
  "data": {
    "status": "overpayment",
    "message": "Payment confirmed with overpayment",
    "redirect": "https://merchant.com/success",
    "txId": "abc123...",
    "paid_amount": "42.000000",
    "expected_amount": "35.000000",
    "currency": "USDT",
    "overpayment": {
      "detected": true,
      "excess_amount": "7.000000",
      "currency": "USDT",
      "refund_message": "Excess amount will be refunded to your wallet"
    }
  }
}
```

---

## Part 2: Frontend Changes (DynoCheckoutFIX)

### File 1: `Components/UI/UnderPayment/Index.tsx`

**Replace the entire file with this updated version that accepts props:**

```tsx
import React, { useState } from "react";
import {
  ArrowDropDown,
  ArrowDropUp,
  FlagCircleOutlined,
} from "@mui/icons-material";
import {
  Box,
  Button,
  Divider,
  IconButton,
  Menu,
  MenuItem,
  Paper,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import CurrencyBitcoinIcon from "@mui/icons-material/CurrencyBitcoin";
import AssuredWorkloadIcon from "@mui/icons-material/AssuredWorkload";
import CopyIcon from "@/assets/Icons/CopyIcon";
import UnderPaymentIcon from "@/assets/Icons/UnderPaymentIcon";
import ClockIcon from "@/assets/Icons/ClockIcon";

interface UnderPaymentProps {
  paidAmount: string;
  expectedAmount: string;
  remainingAmount: string;
  currency: string;
  transactionId?: string;
  gracePeriodMinutes?: number;
  onPayRemaining: (method: 'bank' | 'crypto') => void;
  onCopyTransactionId?: () => void;
}

const UnderPayment: React.FC<UnderPaymentProps> = ({
  paidAmount,
  expectedAmount,
  remainingAmount,
  currency,
  transactionId = "N/A",
  gracePeriodMinutes = 30,
  onPayRemaining,
  onCopyTransactionId,
}) => {
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (transactionId && onCopyTransactionId) {
      onCopyTransactionId();
    } else if (transactionId) {
      navigator.clipboard.writeText(transactionId);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Format amount for display
  const formatAmount = (amount: string, curr: string) => {
    const num = parseFloat(amount);
    if (isNaN(num)) return `0.00 ${curr}`;
    
    // Crypto currencies show more decimals
    const cryptoCurrencies = ['BTC', 'ETH', 'LTC', 'DOGE', 'BCH', 'TRX'];
    const isCrypto = cryptoCurrencies.includes(curr.toUpperCase());
    
    return `${num.toFixed(isCrypto ? 6 : 2)} ${curr}`;
  };

  return (
    <Box
      display="flex"
      alignItems="center"
      justifyContent="center"
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
          textAlign: "center",
          border: "1px solid #E7EAFD",
          boxShadow: "0px 45px 64px 0px #0D03230F",
        }}
      >
        <Box display="flex" justifyContent="center" mb={2}>
          <UnderPaymentIcon />
        </Box>

        <Typography
          variant="h6"
          fontWeight={500}
          fontSize={25}
          gutterBottom
          fontFamily="Space Grotesk"
        >
          Partial Payment Received
        </Typography>

        <Typography
          variant="body2"
          color="#000"
          mb={3}
          fontFamily="Space Grotesk"
        >
          Almost there! Please complete the payment within {gracePeriodMinutes} minutes.
        </Typography>

        <Box
          alignItems="center"
          border="1px solid #E2E8F0"
          borderRadius={2}
          px={2}
          mb={2}
        >
          {/* Paid Amount */}
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
              sx={{ fontSize: { xs: "12px", sm: "14px", md: "16px" } }}
            >
              Paid:
            </Typography>
            <Typography
              variant="subtitle2"
              fontWeight={400}
              color="#12B76A"
              fontSize={16}
              fontFamily="Space Grotesk"
              sx={{ fontSize: { xs: "12px", sm: "14px", md: "16px" } }}
            >
              {formatAmount(paidAmount, currency)}
            </Typography>
          </Box>

          {/* Expected Amount */}
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
            pb={1}
          >
            <Typography
              variant="subtitle2"
              fontWeight={400}
              fontSize={14}
              color="#515151"
              fontFamily="Space Grotesk"
              sx={{ fontSize: { xs: "11px", sm: "12px", md: "14px" } }}
            >
              Expected:
            </Typography>
            <Typography
              variant="subtitle2"
              fontWeight={400}
              color="#515151"
              fontSize={14}
              fontFamily="Space Grotesk"
              sx={{ fontSize: { xs: "11px", sm: "12px", md: "14px" } }}
            >
              {formatAmount(expectedAmount, currency)}
            </Typography>
          </Box>

          {/* Remaining Amount - To Pay */}
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
              sx={{ fontSize: { xs: "14px", sm: "16px", md: "20px" } }}
            >
              To Pay:
            </Typography>
            <Typography
              variant="subtitle2"
              fontWeight={500}
              color="#EF4444"
              fontSize={20}
              fontFamily="Space Grotesk"
              sx={{ fontSize: { xs: "14px", sm: "16px", md: "20px" } }}
            >
              {formatAmount(remainingAmount, currency)}
            </Typography>
          </Box>

          <Divider sx={{ mb: 2 }} />

          {/* Grace Period Warning */}
          <Box
            display="flex"
            alignItems="center"
            justifyContent="center"
            gap={1}
            mb={2}
            p={1}
            bgcolor="#FEF3C7"
            borderRadius={1}
          >
            <ClockIcon />
            <Typography
              fontSize={12}
              color="#92400E"
              fontFamily="Space Grotesk"
              fontWeight={500}
            >
              Complete payment within {gracePeriodMinutes} minutes to avoid cancellation
            </Typography>
          </Box>

          {/* Payment Method Buttons */}
          <Box display="flex" gap={2} mb={2}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<AssuredWorkloadIcon />}
              onClick={() => onPayRemaining('bank')}
              sx={{
                borderColor: "#4F46E5",
                color: "#4F46E5",
                textTransform: "none",
                fontFamily: "Space Grotesk",
                borderRadius: 30,
                py: { xs: 1.2, sm: 1.5, md: 2 },
                fontSize: { xs: "14px", sm: "16px", md: "18px" },
                minHeight: { xs: 40, sm: 48, md: 56 },
                "&:hover": {
                  backgroundColor: "#EEF2FF",
                  borderColor: "#4F46E5",
                },
              }}
            >
              {isSmallScreen ? "Bank" : "Bank Transfer"}
            </Button>

            <Button
              fullWidth
              variant="outlined"
              startIcon={<CurrencyBitcoinIcon />}
              onClick={() => onPayRemaining('crypto')}
              sx={{
                borderColor: "#10B981",
                color: "#10B981",
                textTransform: "none",
                borderRadius: 30,
                fontFamily: "Space Grotesk",
                py: { xs: 1.2, sm: 1.5, md: 2 },
                fontSize: { xs: "14px", sm: "16px", md: "18px" },
                minHeight: { xs: 40, sm: 48, md: 56 },
                "&:hover": {
                  backgroundColor: "#ECFDF5",
                  borderColor: "#10B981",
                },
              }}
            >
              {isSmallScreen ? "Crypto" : "Cryptocurrency"}
            </Button>
          </Box>
        </Box>

        {/* Transaction ID */}
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
                overflow: 'hidden', 
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              {transactionId}
            </Typography>
            <Tooltip title={copied ? "Copied!" : "Copy"}>
              <IconButton
                size="small"
                onClick={handleCopy}
                sx={{
                  bgcolor: "#EEF2FF",
                  p: 0.5,
                  borderRadius: 2,
                  "&:hover": { bgcolor: "#E0E7FF" },
                }}
              >
                <CopyIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
};

export default UnderPayment;
```

---

### File 2: `Components/UI/OverPayment/Index.tsx`

**Replace the entire file with this updated version:**

```tsx
import React, { useState } from "react";
import {
  Box,
  Button,
  Divider,
  IconButton,
  Paper,
  Tooltip,
  Typography,
} from "@mui/material";
import CopyIcon from "@/assets/Icons/CopyIcon";
import OverPaymentIcon from "@/assets/Icons/OverPaymentIcon";
import DoneIcon from "@mui/icons-material/Done";

interface OverPaymentProps {
  paidAmount: string;
  expectedAmount: string;
  excessAmount: string;
  currency: string;
  transactionId?: string;
  refundMessage?: string;
  onGoToWebsite: () => void;
  onCopyTransactionId?: () => void;
}

const OverPayment: React.FC<OverPaymentProps> = ({
  paidAmount,
  expectedAmount,
  excessAmount,
  currency,
  transactionId = "N/A",
  refundMessage = "Excess amount will be refunded to your wallet",
  onGoToWebsite,
  onCopyTransactionId,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (transactionId && onCopyTransactionId) {
      onCopyTransactionId();
    } else if (transactionId) {
      navigator.clipboard.writeText(transactionId);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Format amount for display
  const formatAmount = (amount: string, curr: string) => {
    const num = parseFloat(amount);
    if (isNaN(num)) return `0.00 ${curr}`;
    
    const cryptoCurrencies = ['BTC', 'ETH', 'LTC', 'DOGE', 'BCH', 'TRX'];
    const isCrypto = cryptoCurrencies.includes(curr.toUpperCase());
    
    return `${num.toFixed(isCrypto ? 6 : 2)} ${curr}`;
  };

  return (
    <Box
      display="flex"
      alignItems="center"
      justifyContent="center"
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
          textAlign: "center",
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
          Payment Confirmed!
        </Typography>

        <Typography
          variant="body2"
          color="#000"
          mb={3}
          fontFamily="Space Grotesk"
        >
          Thanks! You've paid a bit extra.
        </Typography>

        <Box
          alignItems="center"
          border="1px solid #E2E8F0"
          borderRadius={2}
          px={2}
          mb={2}
        >
          {/* Paid Amount */}
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
              sx={{ fontSize: { xs: "12px", sm: "14px", md: "16px" } }}
            >
              Paid:
            </Typography>
            <Typography
              variant="subtitle2"
              fontWeight={400}
              color="#515151"
              fontSize={16}
              fontFamily="Space Grotesk"
              sx={{ fontSize: { xs: "12px", sm: "14px", md: "16px" } }}
            >
              {formatAmount(paidAmount, currency)}
            </Typography>
          </Box>

          {/* Expected Amount */}
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
              sx={{ fontSize: { xs: "12px", sm: "14px", md: "16px" } }}
            >
              Total Due:
            </Typography>
            <Typography
              variant="subtitle2"
              fontWeight={400}
              color="#515151"
              fontSize={16}
              fontFamily="Space Grotesk"
              sx={{ fontSize: { xs: "12px", sm: "14px", md: "16px" } }}
            >
              {formatAmount(expectedAmount, currency)}
            </Typography>
          </Box>

          {/* Excess Amount */}
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
              sx={{ fontSize: { xs: "14px", sm: "16px", md: "20px" } }}
            >
              Excess:
            </Typography>
            <Typography
              variant="subtitle2"
              fontWeight={500}
              color="#F59E0B"
              fontSize={20}
              fontFamily="Space Grotesk"
              sx={{ fontSize: { xs: "14px", sm: "16px", md: "20px" } }}
            >
              {formatAmount(excessAmount, currency)}
            </Typography>
          </Box>

          <Divider sx={{ mb: 2 }} />

          {/* Refund Notice */}
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
              textAlign="left"
              fontWeight={500}
            >
              {refundMessage}
            </Typography>
          </Box>

          {/* Go to Website Button */}
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

        {/* Transaction ID */}
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
                overflow: 'hidden', 
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              {transactionId}
            </Typography>
            <Tooltip title={copied ? "Copied!" : "Copy"}>
              <IconButton
                size="small"
                onClick={handleCopy}
                sx={{
                  bgcolor: "#EEF2FF",
                  p: 0.5,
                  borderRadius: 2,
                  "&:hover": { bgcolor: "#E0E7FF" },
                }}
              >
                <CopyIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
};

export default OverPayment;
```

---

### File 3: `Components/Page/Pay3Components/cryptoTransfer.tsx`

**Key changes needed:**

#### 1. Add imports at the top:
```tsx
import UnderPayment from "@/Components/UI/UnderPayment/Index";
import OverPayment from "@/Components/UI/OverPayment/Index";
```

#### 2. Add new state variables:
```tsx
const [paymentStatus, setPaymentStatus] = useState<string>("waiting");
const [partialPaymentData, setPartialPaymentData] = useState<any>(null);
const [overpaymentData, setOverpaymentData] = useState<any>(null);
```

#### 3. Replace the polling useEffect with this updated version:
```tsx
useEffect(() => {
  const isValidSelection =
    selectedCrypto &&
    (selectedCrypto !== "USDT" ||
      ["TRC20", "ERC20"].includes(selectedNetwork));

  if (!isValidSelection || !cryptoDetails?.address) return;

  // Reset states when address changes
  setIsReceived(false);
  setIsStart(false);
  setPaymentStatus("waiting");
  setPartialPaymentData(null);
  setOverpaymentData(null);

  const pollInterval = setInterval(async () => {
    try {
      const response = await axiosBaseApi.post("/pay/verifyCryptoPayment", {
        address: cryptoDetails?.address,
      });

      const responseData = response?.data?.data;

      if (responseData) {
        const status = responseData.status;
        setPaymentStatus(status);

        switch (status) {
          case "pending":
            // Payment detected on blockchain, awaiting confirmation
            setIsStart(true);
            setIsReceived(false);
            break;

          case "partial":
            // Partial payment (underpayment) received
            setPartialPaymentData({
              paidAmount: responseData.paid_amount,
              expectedAmount: responseData.expected_amount,
              remainingAmount: responseData.remaining_amount,
              currency: responseData.currency,
              transactionId: responseData.txId,
              gracePeriodMinutes: responseData.grace_period_minutes || 30,
            });
            clearInterval(pollInterval);
            break;

          case "confirmed":
            // Payment fully confirmed
            setIsStart(true);
            setIsReceived(true);
            clearInterval(pollInterval);
            if (responseData.redirect) {
              setIsUrl(responseData.redirect);
            }
            break;

          case "overpayment":
            // Overpayment detected
            setOverpaymentData({
              paidAmount: responseData.paid_amount,
              expectedAmount: responseData.expected_amount,
              excessAmount: responseData.overpayment?.excess_amount,
              currency: responseData.currency,
              transactionId: responseData.txId,
              refundMessage: responseData.overpayment?.refund_message,
              redirect: responseData.redirect,
            });
            clearInterval(pollInterval);
            break;

          case "failed":
            // Payment failed
            clearInterval(pollInterval);
            dispatch({
              type: TOAST_SHOW,
              payload: {
                message: responseData.message || "Payment processing failed",
                severity: "error",
              },
            });
            break;

          case "waiting":
          default:
            // No payment detected yet, continue polling
            break;
        }
      }
    } catch (e: any) {
      console.error("[Payment Poll] Error:", e?.message);
    }
  }, 10000); // Poll every 10 seconds

  return () => clearInterval(pollInterval);
}, [selectedCrypto, selectedNetwork, cryptoDetails?.address, dispatch]);
```

#### 4. Add handler for paying remaining amount:
```tsx
const handlePayRemaining = (method: 'bank' | 'crypto') => {
  if (method === 'crypto') {
    // Reset to show QR code again for remaining payment
    // The address should still be valid for the remaining amount
    setPartialPaymentData(null);
    setPaymentStatus("waiting");
    setIsStart(false);
  } else {
    // Redirect to bank transfer for remaining amount
    // You might want to pass the remaining amount to bank transfer flow
    setActiveStep(1);
    // Handle bank transfer logic
  }
};
```

#### 5. Update the return JSX to handle all states:

Replace the main return section with:

```tsx
// If partial payment, show UnderPayment component
if (paymentStatus === "partial" && partialPaymentData) {
  return (
    <UnderPayment
      paidAmount={partialPaymentData.paidAmount}
      expectedAmount={partialPaymentData.expectedAmount}
      remainingAmount={partialPaymentData.remainingAmount}
      currency={partialPaymentData.currency}
      transactionId={partialPaymentData.transactionId}
      gracePeriodMinutes={partialPaymentData.gracePeriodMinutes}
      onPayRemaining={handlePayRemaining}
    />
  );
}

// If overpayment, show OverPayment component
if (paymentStatus === "overpayment" && overpaymentData) {
  return (
    <OverPayment
      paidAmount={overpaymentData.paidAmount}
      expectedAmount={overpaymentData.expectedAmount}
      excessAmount={overpaymentData.excessAmount}
      currency={overpaymentData.currency}
      transactionId={overpaymentData.transactionId}
      refundMessage={overpaymentData.refundMessage}
      onGoToWebsite={() => {
        if (overpaymentData.redirect) {
          window.location.replace(overpaymentData.redirect);
        }
      }}
    />
  );
}

// Otherwise, show the normal crypto transfer UI
return (
  <Box
    display="flex"
    alignItems="center"
    justifyContent="center"
    px={2}
    minHeight="calc(100vh - 340px)"
  >
    {/* ... rest of the existing JSX ... */}
  </Box>
);
```

---

## Part 3: Complete Updated `cryptoTransfer.tsx`

Here's a summary of all changes needed in `cryptoTransfer.tsx`:

```tsx
// ========== IMPORTS (add these) ==========
import UnderPayment from "@/Components/UI/UnderPayment/Index";
import OverPayment from "@/Components/UI/OverPayment/Index";

// ========== STATE VARIABLES (add these) ==========
const [paymentStatus, setPaymentStatus] = useState<string>("waiting");
const [partialPaymentData, setPartialPaymentData] = useState<any>(null);
const [overpaymentData, setOverpaymentData] = useState<any>(null);

// ========== REMOVE THIS (fake timer) ==========
// DELETE: setTimeout(() => { setIsStart(true); }, 10000);

// ========== ADD HANDLER ==========
const handlePayRemaining = (method: 'bank' | 'crypto') => {
  if (method === 'crypto') {
    setPartialPaymentData(null);
    setPaymentStatus("waiting");
    setIsStart(false);
  } else {
    setActiveStep(0); // Go back to payment method selection
  }
};

// ========== UPDATED RETURN ==========
// Before the main return, add conditional renders for partial/overpayment
```

---

## Part 4: Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         PAYMENT STATUS FLOW                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  User selects crypto                                                     │
│       │                                                                  │
│       ▼                                                                  │
│  ┌─────────────┐                                                         │
│  │  WAITING    │ ◄──── Poll every 10 seconds                            │
│  │  (Show QR)  │                                                         │
│  └──────┬──────┘                                                         │
│         │                                                                │
│         │ Transaction detected on blockchain                             │
│         ▼                                                                │
│  ┌─────────────┐                                                         │
│  │  PENDING    │ "Payment detected, awaiting confirmation..."            │
│  └──────┬──────┘                                                         │
│         │                                                                │
│         ├─────────────────────┬──────────────────┬──────────────────┐   │
│         │                     │                  │                  │   │
│         ▼                     ▼                  ▼                  ▼   │
│  ┌─────────────┐       ┌─────────────┐    ┌───────────┐     ┌────────┐  │
│  │  CONFIRMED  │       │   PARTIAL   │    │OVERPAYMENT│     │ FAILED │  │
│  │  (100%)     │       │  (<100%)    │    │  (>100%)  │     │        │  │
│  └──────┬──────┘       └──────┬──────┘    └─────┬─────┘     └────────┘  │
│         │                     │                 │                       │
│         ▼                     ▼                 ▼                       │
│  "Payment          Show UnderPayment    Show OverPayment                │
│   Confirmed!"      component with:      component with:                 │
│  + Redirect        - Paid amount        - Paid amount                   │
│                    - Remaining amount   - Excess amount                 │
│                    - Pay buttons        - Refund notice                 │
│                                         - Redirect button               │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Part 5: Testing Checklist

### Backend Testing
```bash
# Test waiting status (no payment)
curl -X POST http://localhost:8001/api/pay/verifyCryptoPayment \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"address": "test-address-123"}'

# Expected: status: "waiting"
```

### Frontend Testing
1. **Normal Payment Flow:**
   - Select crypto → See QR code → Send exact amount → See "Payment Confirmed!"

2. **Underpayment Flow:**
   - Select crypto → See QR code → Send less than required → See UnderPayment UI
   - Click "Cryptocurrency" → Should reset to QR code for remaining amount

3. **Overpayment Flow:**
   - Select crypto → See QR code → Send more than required → See OverPayment UI
   - Click "Go to Website" → Should redirect

---

## Summary of Files to Update

| Location | File | Action |
|----------|------|--------|
| DynoPay Backend | `controller/paymentController.ts` | ✅ Already updated |
| DynoPay Backend | `swagger/paths/payment.ts` | ✅ Already updated |
| DynoCheckoutFIX | `Components/UI/UnderPayment/Index.tsx` | Replace with new version |
| DynoCheckoutFIX | `Components/UI/OverPayment/Index.tsx` | Replace with new version |
| DynoCheckoutFIX | `Components/Page/Pay3Components/cryptoTransfer.tsx` | Update with new logic |
