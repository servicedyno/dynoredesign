# DynoCheckoutFIX - Complete Implementation Guide

## Overview

This document provides detailed implementation instructions to fix all identified issues in the DynoCheckoutFIX repository, ensuring consistency with the DynoPay backend API.

---

## Table of Contents

1. [Configured Currencies - Critical Fix](#1-configured-currencies---critical-fix)
2. [Payment Status Handling](#2-payment-status-handling)
3. [Underpayment & Overpayment Components](#3-underpayment--overpayment-components)
4. [Payment Failed & Expired Components](#4-payment-failed--expired-components)
5. [Complete Updated cryptoTransfer.tsx](#5-complete-updated-cryptotransfertsx)

---

## 1. Configured Currencies - Critical Fix

### Problem
The checkout page shows ALL cryptocurrencies as hardcoded options, ignoring the merchant's configured wallets.

### Solution
Fetch configured currencies from the backend and filter the dropdown accordingly.

### File: `Components/Page/Pay3Components/cryptoTransfer.tsx`

#### Step 1.1: Add New State Variables

Add these after the existing state declarations (around line 85):

```tsx
// ADD: State for configured currencies from merchant
const [availableCryptos, setAvailableCryptos] = useState<string[]>([]);
const [loadingCurrencies, setLoadingCurrencies] = useState(true);
const [skipSelection, setSkipSelection] = useState(false);
```

#### Step 1.2: Add useEffect to Fetch Configured Currencies

Add this new useEffect after the component's state declarations:

```tsx
// Fetch merchant's configured currencies on component mount
useEffect(() => {
  const fetchConfiguredCurrencies = async () => {
    try {
      setLoadingCurrencies(true);
      const response = await axiosBaseApi.get("/wallet/configured-currencies");
      const { configured_currencies, skip_selection } = response.data.data;
      
      // Normalize currency names (handle USDT-TRC20, USDT-ERC20 -> USDT)
      const normalizedCurrencies = configured_currencies.map((c: string) => {
        if (c.startsWith('USDT-')) return 'USDT';
        return c;
      });
      
      // Get unique currencies
      const uniqueCurrencies = [...new Set(normalizedCurrencies)] as string[];
      setAvailableCryptos(uniqueCurrencies);
      setSkipSelection(skip_selection);
      
      // Store the raw configured currencies for network filtering
      localStorage.setItem('configured_currencies_raw', JSON.stringify(configured_currencies));
      
      // Auto-select if only one currency option
      if (skip_selection && uniqueCurrencies.length === 1) {
        const currency = uniqueCurrencies[0];
        // Trigger the selection
        setTimeout(() => {
          if (currency === 'USDT') {
            // For USDT, need to determine which network is available
            const hasERC20 = configured_currencies.includes('USDT-ERC20');
            const hasTRC20 = configured_currencies.includes('USDT-TRC20');
            setSelectedCrypto('USDT');
            setIsNetwork('USDT');
            if (hasTRC20 && !hasERC20) {
              handleNetworkChange('TRC20');
            } else if (hasERC20 && !hasTRC20) {
              handleNetworkChange('ERC20');
            }
          } else {
            getCurrencyRateAndSubmit(currency);
          }
        }, 100);
      }
    } catch (e: any) {
      console.error("Failed to fetch configured currencies:", e);
      // Fallback: show all currencies if API fails
      setAvailableCryptos(['USDT', 'BTC', 'ETH', 'LTC', 'DOGE', 'BCH', 'TRX']);
      dispatch({
        type: TOAST_SHOW,
        payload: {
          message: "Failed to load available currencies. Showing all options.",
          severity: "warning"
        }
      });
    } finally {
      setLoadingCurrencies(false);
    }
  };
  
  fetchConfiguredCurrencies();
}, []);
```

#### Step 1.3: Create Filtered Crypto Options

Add this computed value after the useEffect:

```tsx
// Filter crypto options based on merchant's configured currencies
const filteredCryptoOptions = cryptoOptions.filter(opt => 
  availableCryptos.includes(opt.value)
);

// For USDT, determine available networks
const getAvailableUSDTNetworks = (): ('TRC20' | 'ERC20')[] => {
  const rawCurrencies = JSON.parse(localStorage.getItem('configured_currencies_raw') || '[]');
  const networks: ('TRC20' | 'ERC20')[] = [];
  if (rawCurrencies.includes('USDT-TRC20')) networks.push('TRC20');
  if (rawCurrencies.includes('USDT-ERC20')) networks.push('ERC20');
  return networks;
};

const availableUSDTNetworks = getAvailableUSDTNetworks();
```

#### Step 1.4: Update the Select Component

Replace the Select component's rendering logic:

```tsx
{/* Show loading state while fetching currencies */}
{loadingCurrencies ? (
  <Box display="flex" justifyContent="center" p={2}>
    <CircularProgress size={24} />
    <Typography ml={2} fontFamily="Space Grotesk">
      Loading available currencies...
    </Typography>
  </Box>
) : filteredCryptoOptions.length === 0 ? (
  <Box p={2} textAlign="center">
    <Typography color="error" fontFamily="Space Grotesk">
      No cryptocurrencies configured by merchant.
    </Typography>
    <Typography variant="body2" color="textSecondary" fontFamily="Space Grotesk">
      Please contact support or try a different payment method.
    </Typography>
  </Box>
) : (
  <FormControl fullWidth>
    <Select
      labelId="crypto-select-label"
      id="crypto-select"
      value={selectedCrypto}
      displayEmpty
      onChange={handleChange}
      IconComponent={KeyboardArrowDownIcon}
      sx={{
        // ... existing sx props
      }}
      MenuProps={{
        // ... existing MenuProps
      }}
      renderValue={(selected) => {
        if (!selected)
          return (
            <span style={{ color: "#1A1919", fontWeight: 500, fontFamily: "Space Grotesk" }}>
              {filteredCryptoOptions.length === 1 
                ? `Pay with ${filteredCryptoOptions[0].label}`
                : "Select Crypto Type"
              }
            </span>
          );
        const option = getSelectedOption();
        return (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, color: "#1A1919", fontWeight: "medium", height: "24px" }}>
            {option?.icon}
            {option?.label}
          </Box>
        );
      }}
    >
      {/* Only show filtered options */}
      {filteredCryptoOptions.map((option) => (
        <MenuItem
          key={option.value}
          value={option.value}
          sx={{
            borderRadius: "8px",
            "&:hover": { backgroundColor: "#F5F8FF" },
            "&.Mui-selected": {
              backgroundColor: "#F5F8FF",
              "&:hover": { backgroundColor: "#F5F8FF" },
            },
            padding: "10px",
          }}
        >
          <ListItemIcon style={{ height: "26px", width: "25px" }}>
            {option.icon}
          </ListItemIcon>
          <ListItemText style={{ height: "24px", width: "24px" }}>
            {option.label}
          </ListItemText>
        </MenuItem>
      ))}
    </Select>
  </FormControl>
)}
```

#### Step 1.5: Update USDT Network Selection

Replace the network selection section to only show configured networks:

```tsx
{isNetwork === "USDT" && availableUSDTNetworks.length > 0 && (
  <Box mt={1}>
    <Typography
      variant="subtitle2"
      fontWeight={500}
      fontFamily="Space Grotesk"
      color="#000"
    >
      Preferred Network
    </Typography>
  </Box>
)}

{isNetwork === "USDT" && availableUSDTNetworks.length > 0 && (
  <Box mt={"10px"} mb={3} display="flex" gap={1} alignItems="center">
    {availableUSDTNetworks.map((net) => (
      <Typography
        key={net}
        border={`1px solid ${selectedNetwork === net ? "#86A4F9" : "#E7EAFD"}`}
        padding="5px 10px"
        fontSize="small"
        bgcolor={selectedNetwork === net ? "#E7EAFD" : "#F5F8FF"}
        borderRadius="5px"
        sx={{ cursor: "pointer" }}
        onClick={() => handleNetworkChange(net)}
        fontFamily="Space Grotesk"
      >
        {net}
      </Typography>
    ))}
    
    {/* Auto-select if only one network available */}
    {availableUSDTNetworks.length === 1 && !selectedNetwork && (
      <Typography
        variant="caption"
        color="textSecondary"
        fontFamily="Space Grotesk"
      >
        (Only {availableUSDTNetworks[0]} available)
      </Typography>
    )}
  </Box>
)}

{/* Show message if USDT selected but no networks configured */}
{isNetwork === "USDT" && availableUSDTNetworks.length === 0 && (
  <Box mt={1} p={2} bgcolor="#FEF3C7" borderRadius={1}>
    <Typography color="#92400E" fontSize="small" fontFamily="Space Grotesk">
      USDT is not properly configured. Please select another currency.
    </Typography>
  </Box>
)}
```

---

## 2. Payment Status Handling

### Problem
- Fake 10-second timer shows "Payment detected" regardless of actual blockchain status
- Not handling all payment statuses from backend

### Solution
Remove fake timer and properly handle all backend statuses.

### File: `Components/Page/Pay3Components/cryptoTransfer.tsx`

#### Step 2.1: Add New State Variables for Payment Status

```tsx
// Payment status management
const [paymentStatus, setPaymentStatus] = useState<
  'waiting' | 'pending' | 'partial' | 'confirmed' | 'overpayment' | 'failed' | 'expired'
>('waiting');
const [partialPaymentData, setPartialPaymentData] = useState<any>(null);
const [overpaymentData, setOverpaymentData] = useState<any>(null);
const [failedData, setFailedData] = useState<any>(null);
```

#### Step 2.2: DELETE the Fake Timer

**REMOVE THIS CODE COMPLETELY** (around line 178):

```tsx
// ❌ DELETE THIS ENTIRE BLOCK - IT'S FAKE!
setTimeout(() => {
  setIsStart(true);
}, 10000);
```

#### Step 2.3: Replace the Polling useEffect

Replace the existing polling useEffect with this comprehensive version:

```tsx
// Payment verification polling
useEffect(() => {
  const isValidSelection =
    selectedCrypto &&
    (selectedCrypto !== "USDT" || ["TRC20", "ERC20"].includes(selectedNetwork));

  if (!isValidSelection || !cryptoDetails?.address) return;

  // Reset states when address changes
  setIsReceived(false);
  setIsStart(false);
  setPaymentStatus('waiting');
  setPartialPaymentData(null);
  setOverpaymentData(null);
  setFailedData(null);

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
            setIsStart(true);
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
            setIsStart(true);
            setOverpaymentData({
              paidAmount: responseData.paid_amount,
              expectedAmount: responseData.expected_amount,
              excessAmount: responseData.overpayment?.excess_amount,
              currency: responseData.currency,
              transactionId: responseData.txId,
              refundMessage: responseData.overpayment?.refund_message || "Excess amount will be refunded to your wallet",
              redirect: responseData.redirect,
            });
            clearInterval(pollInterval);
            break;

          case "failed":
            // Payment failed
            setFailedData({
              message: responseData.message || "Payment processing failed",
              txId: responseData.txId,
            });
            clearInterval(pollInterval);
            break;

          case "expired":
            // Payment expired
            setPaymentStatus('expired');
            clearInterval(pollInterval);
            break;

          case "waiting":
          default:
            // No payment detected yet, continue polling
            break;
        }
      }
    } catch (e: any) {
      console.error("[Payment Poll] Error:", e?.message);
      // Don't show error toast on polling - silent retry
    }
  }, 10000); // Poll every 10 seconds

  return () => clearInterval(pollInterval);
}, [selectedCrypto, selectedNetwork, cryptoDetails?.address]);
```

---

## 3. Underpayment & Overpayment Components

### File: `Components/UI/UnderPayment/Index.tsx`

Replace the entire file with this updated version:

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
}

const UnderPayment: React.FC<UnderPaymentProps> = ({
  paidAmount,
  expectedAmount,
  remainingAmount,
  currency,
  transactionId = "N/A",
  gracePeriodMinutes = 30,
  onPayRemaining,
}) => {
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (transactionId && transactionId !== "N/A") {
      navigator.clipboard.writeText(transactionId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

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
          <Box display="flex" justifyContent="space-between" alignItems="center" py={2}>
            <Typography variant="subtitle2" fontWeight={400} fontSize={16} color="#515151" fontFamily="Space Grotesk">
              Paid:
            </Typography>
            <Typography variant="subtitle2" fontWeight={400} color="#12B76A" fontSize={16} fontFamily="Space Grotesk">
              {formatAmount(paidAmount, currency)}
            </Typography>
          </Box>

          {/* Expected Amount */}
          <Box display="flex" justifyContent="space-between" alignItems="center" pb={1}>
            <Typography variant="subtitle2" fontWeight={400} fontSize={14} color="#515151" fontFamily="Space Grotesk">
              Expected:
            </Typography>
            <Typography variant="subtitle2" fontWeight={400} color="#515151" fontSize={14} fontFamily="Space Grotesk">
              {formatAmount(expectedAmount, currency)}
            </Typography>
          </Box>

          {/* Remaining Amount */}
          <Box display="flex" justifyContent="space-between" alignItems="center" py={2}>
            <Typography variant="subtitle2" fontWeight={500} fontSize={20} color="#000" fontFamily="Space Grotesk">
              To Pay:
            </Typography>
            <Typography variant="subtitle2" fontWeight={500} color="#EF4444" fontSize={20} fontFamily="Space Grotesk">
              {formatAmount(remainingAmount, currency)}
            </Typography>
          </Box>

          <Divider sx={{ mb: 2 }} />

          {/* Grace Period Warning */}
          <Box display="flex" alignItems="center" justifyContent="center" gap={1} mb={2} p={1} bgcolor="#FEF3C7" borderRadius={1}>
            <ClockIcon />
            <Typography fontSize={12} color="#92400E" fontFamily="Space Grotesk" fontWeight={500}>
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
                py: 1.5,
                "&:hover": { backgroundColor: "#EEF2FF", borderColor: "#4F46E5" },
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
                py: 1.5,
                "&:hover": { backgroundColor: "#ECFDF5", borderColor: "#10B981" },
              }}
            >
              {isSmallScreen ? "Crypto" : "Cryptocurrency"}
            </Button>
          </Box>
        </Box>

        {/* Transaction ID */}
        <Box display="flex" justifyContent="space-between" mt={3}>
          <Typography variant="caption" color="#515151" fontWeight={400} fontSize={12}>
            Transaction ID:
          </Typography>
          <Box display="flex" alignItems="center" gap={1}>
            <Typography
              variant="caption"
              fontWeight={400}
              fontSize={12}
              color="#515151"
              sx={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              {transactionId}
            </Typography>
            <Tooltip title={copied ? "Copied!" : "Copy"}>
              <IconButton size="small" onClick={handleCopy} sx={{ bgcolor: "#EEF2FF", p: 0.5, borderRadius: 2 }}>
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

### File: `Components/UI/OverPayment/Index.tsx`

Replace the entire file with this updated version:

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
}

const OverPayment: React.FC<OverPaymentProps> = ({
  paidAmount,
  expectedAmount,
  excessAmount,
  currency,
  transactionId = "N/A",
  refundMessage = "Excess amount will be refunded to your wallet",
  onGoToWebsite,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (transactionId && transactionId !== "N/A") {
      navigator.clipboard.writeText(transactionId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

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

        <Typography variant="h6" fontWeight={500} fontSize={25} gutterBottom fontFamily="Space Grotesk">
          Payment Confirmed!
        </Typography>

        <Typography variant="body2" color="#000" mb={3} fontFamily="Space Grotesk">
          Thanks! You've paid a bit extra.
        </Typography>

        <Box alignItems="center" border="1px solid #E2E8F0" borderRadius={2} px={2} mb={2}>
          {/* Paid Amount */}
          <Box display="flex" justifyContent="space-between" alignItems="center" py={2}>
            <Typography variant="subtitle2" fontWeight={400} fontSize={16} color="#515151" fontFamily="Space Grotesk">
              Paid:
            </Typography>
            <Typography variant="subtitle2" fontWeight={400} color="#515151" fontSize={16} fontFamily="Space Grotesk">
              {formatAmount(paidAmount, currency)}
            </Typography>
          </Box>

          {/* Expected Amount */}
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="subtitle2" fontWeight={400} fontSize={16} color="#515151" fontFamily="Space Grotesk">
              Total Due:
            </Typography>
            <Typography variant="subtitle2" fontWeight={400} color="#515151" fontSize={16} fontFamily="Space Grotesk">
              {formatAmount(expectedAmount, currency)}
            </Typography>
          </Box>

          {/* Excess Amount */}
          <Box display="flex" justifyContent="space-between" alignItems="center" py={2}>
            <Typography variant="subtitle2" fontWeight={500} fontSize={20} color="#000" fontFamily="Space Grotesk">
              Excess:
            </Typography>
            <Typography variant="subtitle2" fontWeight={500} color="#F59E0B" fontSize={20} fontFamily="Space Grotesk">
              {formatAmount(excessAmount, currency)}
            </Typography>
          </Box>

          <Divider sx={{ mb: 2 }} />

          {/* Refund Notice */}
          <Box mt={1} mb={2} borderRadius={2} display="flex" alignItems="center" bgcolor={"#F5F8FF"} gap={1} px={2} py={1}>
            <DoneIcon sx={{ fontSize: 17, color: "#12B76A" }} />
            <Typography fontSize={14} color={"#515151"} fontFamily="Space Grotesk" textAlign="left" fontWeight={500}>
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
                py: 2,
                "&:hover": { backgroundColor: "#EEF2FF", borderColor: "#4F46E5" },
              }}
              endIcon={<span style={{ fontSize: "1.2rem" }}>→</span>}
            >
              Go to Website
            </Button>
          </Box>
        </Box>

        {/* Transaction ID */}
        <Box display="flex" justifyContent="space-between" mt={3}>
          <Typography variant="caption" color="#515151" fontWeight={400} fontSize={12}>
            Transaction ID:
          </Typography>
          <Box display="flex" alignItems="center" gap={1}>
            <Typography
              variant="caption"
              fontWeight={400}
              fontSize={12}
              color="#515151"
              sx={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              {transactionId}
            </Typography>
            <Tooltip title={copied ? "Copied!" : "Copy"}>
              <IconButton size="small" onClick={handleCopy} sx={{ bgcolor: "#EEF2FF", p: 0.5, borderRadius: 2 }}>
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

## 4. Payment Failed & Expired Components

### Create New File: `Components/UI/PaymentFailed/Index.tsx`

```tsx
import React from "react";
import {
  Box,
  Button,
  Paper,
  Typography,
} from "@mui/material";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import RefreshIcon from "@mui/icons-material/Refresh";
import SupportAgentIcon from "@mui/icons-material/SupportAgent";

interface PaymentFailedProps {
  message?: string;
  transactionId?: string;
  onRetry: () => void;
  onContactSupport?: () => void;
}

const PaymentFailed: React.FC<PaymentFailedProps> = ({
  message = "Payment processing failed. Please try again.",
  transactionId,
  onRetry,
  onContactSupport,
}) => {
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
          border: "1px solid #FEE2E2",
          boxShadow: "0px 45px 64px 0px #0D03230F",
        }}
      >
        <Box
          display="flex"
          justifyContent="center"
          mb={2}
          sx={{
            width: 80,
            height: 80,
            borderRadius: "50%",
            bgcolor: "#FEE2E2",
            mx: "auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ErrorOutlineIcon sx={{ fontSize: 48, color: "#EF4444" }} />
        </Box>

        <Typography
          variant="h6"
          fontWeight={500}
          fontSize={25}
          gutterBottom
          fontFamily="Space Grotesk"
          color="#EF4444"
        >
          Payment Failed
        </Typography>

        <Typography
          variant="body2"
          color="#515151"
          mb={3}
          fontFamily="Space Grotesk"
        >
          {message}
        </Typography>

        {transactionId && (
          <Box
            mb={3}
            p={2}
            bgcolor="#F9FAFB"
            borderRadius={2}
          >
            <Typography
              variant="caption"
              color="#515151"
              fontFamily="Space Grotesk"
            >
              Reference ID: {transactionId}
            </Typography>
          </Box>
        )}

        <Box display="flex" flexDirection="column" gap={2}>
          <Button
            fullWidth
            variant="contained"
            startIcon={<RefreshIcon />}
            onClick={onRetry}
            sx={{
              bgcolor: "#4F46E5",
              color: "#fff",
              textTransform: "none",
              borderRadius: 30,
              py: 1.5,
              fontFamily: "Space Grotesk",
              "&:hover": { bgcolor: "#4338CA" },
            }}
          >
            Try Again
          </Button>

          {onContactSupport && (
            <Button
              fullWidth
              variant="outlined"
              startIcon={<SupportAgentIcon />}
              onClick={onContactSupport}
              sx={{
                borderColor: "#D1D5DB",
                color: "#515151",
                textTransform: "none",
                borderRadius: 30,
                py: 1.5,
                fontFamily: "Space Grotesk",
                "&:hover": { bgcolor: "#F9FAFB", borderColor: "#9CA3AF" },
              }}
            >
              Contact Support
            </Button>
          )}
        </Box>
      </Paper>
    </Box>
  );
};

export default PaymentFailed;
```

### Create New File: `Components/UI/PaymentExpired/Index.tsx`

```tsx
import React from "react";
import {
  Box,
  Button,
  Paper,
  Typography,
} from "@mui/material";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import RefreshIcon from "@mui/icons-material/Refresh";

interface PaymentExpiredProps {
  transactionId?: string;
  onStartNewPayment: () => void;
}

const PaymentExpired: React.FC<PaymentExpiredProps> = ({
  transactionId,
  onStartNewPayment,
}) => {
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
          border: "1px solid #FEF3C7",
          boxShadow: "0px 45px 64px 0px #0D03230F",
        }}
      >
        <Box
          display="flex"
          justifyContent="center"
          mb={2}
          sx={{
            width: 80,
            height: 80,
            borderRadius: "50%",
            bgcolor: "#FEF3C7",
            mx: "auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <AccessTimeIcon sx={{ fontSize: 48, color: "#F59E0B" }} />
        </Box>

        <Typography
          variant="h6"
          fontWeight={500}
          fontSize={25}
          gutterBottom
          fontFamily="Space Grotesk"
          color="#92400E"
        >
          Payment Expired
        </Typography>

        <Typography
          variant="body2"
          color="#515151"
          mb={1}
          fontFamily="Space Grotesk"
        >
          Your payment session has timed out.
        </Typography>

        <Typography
          variant="body2"
          color="#515151"
          mb={3}
          fontFamily="Space Grotesk"
        >
          The 30-minute grace period has ended. Please start a new payment to continue.
        </Typography>

        {transactionId && (
          <Box
            mb={3}
            p={2}
            bgcolor="#F9FAFB"
            borderRadius={2}
          >
            <Typography
              variant="caption"
              color="#515151"
              fontFamily="Space Grotesk"
            >
              Expired Session: {transactionId}
            </Typography>
          </Box>
        )}

        <Button
          fullWidth
          variant="contained"
          startIcon={<RefreshIcon />}
          onClick={onStartNewPayment}
          sx={{
            bgcolor: "#4F46E5",
            color: "#fff",
            textTransform: "none",
            borderRadius: 30,
            py: 1.5,
            fontFamily: "Space Grotesk",
            "&:hover": { bgcolor: "#4338CA" },
          }}
        >
          Start New Payment
        </Button>
      </Paper>
    </Box>
  );
};

export default PaymentExpired;
```

---

## 5. Complete Updated cryptoTransfer.tsx

### Final Integration - Add Imports

At the top of `cryptoTransfer.tsx`, add these imports:

```tsx
import UnderPayment from "@/Components/UI/UnderPayment/Index";
import OverPayment from "@/Components/UI/OverPayment/Index";
import PaymentFailed from "@/Components/UI/PaymentFailed/Index";
import PaymentExpired from "@/Components/UI/PaymentExpired/Index";
```

### Add Handler Functions

Add these handlers before the return statement:

```tsx
// Handler for partial payment - pay remaining amount
const handlePayRemaining = (method: 'bank' | 'crypto') => {
  if (method === 'crypto') {
    // Reset to show QR code again for remaining payment
    setPartialPaymentData(null);
    setPaymentStatus('waiting');
    setIsStart(false);
    // The address is still valid for remaining amount
  } else {
    // Go back to payment method selection for bank transfer
    setActiveStep(0);
  }
};

// Handler for retry after failure
const handleRetry = () => {
  setFailedData(null);
  setPaymentStatus('waiting');
  setSelectedCrypto('');
  setSelectedNetwork('');
  setCryptoDetails({ qr_code: '', hash: '', address: '' });
};

// Handler for starting new payment after expiry
const handleStartNewPayment = () => {
  // Redirect to start of checkout
  window.location.reload();
};

// Handler for contact support
const handleContactSupport = () => {
  // Open support chat or email
  window.open('mailto:support@dynopay.io', '_blank');
};
```

### Update Return Statement

Replace the return statement with conditional rendering:

```tsx
// Render based on payment status
if (paymentStatus === 'partial' && partialPaymentData) {
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

if (paymentStatus === 'overpayment' && overpaymentData) {
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

if (paymentStatus === 'failed' && failedData) {
  return (
    <PaymentFailed
      message={failedData.message}
      transactionId={failedData.txId}
      onRetry={handleRetry}
      onContactSupport={handleContactSupport}
    />
  );
}

if (paymentStatus === 'expired') {
  return (
    <PaymentExpired
      transactionId={cryptoDetails?.address}
      onStartNewPayment={handleStartNewPayment}
    />
  );
}

// Default: show normal crypto transfer UI
return (
  <Box
    display="flex"
    alignItems="center"
    justifyContent="center"
    px={2}
    minHeight="calc(100vh - 340px)"
  >
    {/* ... existing JSX ... */}
  </Box>
);
```

---

## Summary of Changes

### Files to Modify:

| File | Changes |
|------|---------|
| `Components/Page/Pay3Components/cryptoTransfer.tsx` | Add currency filtering, fix payment status, integrate new components |
| `Components/UI/UnderPayment/Index.tsx` | Add props interface, dynamic rendering |
| `Components/UI/OverPayment/Index.tsx` | Add props interface, dynamic rendering |

### New Files to Create:

| File | Purpose |
|------|---------|
| `Components/UI/PaymentFailed/Index.tsx` | Failed payment UI |
| `Components/UI/PaymentExpired/Index.tsx` | Expired payment UI |

### Key Fixes:

1. ✅ **Configured currencies** - Only show merchant's configured cryptos
2. ✅ **Remove fake timer** - No more fake "Payment detected" after 10 seconds
3. ✅ **Payment status handling** - Handle all 6 statuses from backend
4. ✅ **Underpayment UI** - Proper partial payment component with props
5. ✅ **Overpayment UI** - Proper overpayment component with props
6. ✅ **Failed payment UI** - New component for payment failures
7. ✅ **Expired payment UI** - New component for expired sessions

---

## Testing Checklist

After implementing these changes:

- [ ] Select crypto dropdown only shows merchant's configured currencies
- [ ] USDT network selection only shows configured networks (TRC20/ERC20)
- [ ] Single currency merchants see auto-selection
- [ ] "Payment detected" only shows when blockchain detects transaction
- [ ] Underpayment shows proper partial payment UI
- [ ] Overpayment shows excess amount and refund notice
- [ ] Failed payments show retry option
- [ ] Expired sessions show restart option
