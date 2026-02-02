# Checkout Frontend Code Fixes

**Repository:** https://github.com/Moxxcompany/DynocheckoutDarkMode/tree/ongoingfixes  
**Date:** February 2, 2026

---

## Fix 1: Grace Period Default (CRITICAL)

**File:** `Components/Page/Pay3Components/cryptoTransfer.tsx`

### Current Code (Line ~178)

```typescript
// Merchant settings from backend (with defaults)
const [merchantSettings, setMerchantSettings] = useState<MerchantSettings>({
  overpayment_threshold_usd: 5,  // Default $5, will be updated from backend
  grace_period_minutes: 15       // Default 15 min, will be updated from backend
});
```

### Fixed Code

```typescript
// Merchant settings from backend (with defaults)
const [merchantSettings, setMerchantSettings] = useState<MerchantSettings>({
  overpayment_threshold_usd: 5,  // Default $5, will be updated from backend
  grace_period_minutes: 30       // Default 30 min, will be updated from backend (matches backend default)
});
```

---

## Fix 2: Add "failed" Status Type (MEDIUM)

**File:** `Components/Page/Pay3Components/cryptoTransfer.tsx`

### Current Code (Line ~45)

```typescript
// Payment status types
type PaymentStatusType =
  | "waiting"      // No payment detected yet
  | "pending"      // Payment detected, awaiting confirmation
  | "confirmed"    // Payment confirmed successfully
  | "underpaid"    // Partial payment received
  | "overpaid"     // More than expected was paid
  | "expired";     // Payment window expired
```

### Fixed Code

```typescript
// Payment status types
type PaymentStatusType =
  | "waiting"      // No payment detected yet
  | "pending"      // Payment detected, awaiting confirmation
  | "confirmed"    // Payment confirmed successfully
  | "underpaid"    // Partial payment received
  | "overpaid"     // More than expected was paid
  | "expired"      // Payment window expired
  | "failed";      // Payment processing failed
```

---

## Fix 3: Add "failed" Status Handler in Polling (MEDIUM)

**File:** `Components/Page/Pay3Components/cryptoTransfer.tsx`

### Find this section in the polling useEffect (around line ~450-600)

Add a new case after the "expired" case handler:

```typescript
          case "expired":
            // Payment window expired
            setIsStart(false);
            setIsReceived(false);
            setIsPolling(false); // Stop polling indicator
            clearInterval(pollInterval);
            dispatch({
              type: TOAST_SHOW,
              payload: {
                message: t('crypto.paymentExpired'),
                severity: "error",
              },
            });
            break;

          // ADD THIS NEW CASE:
          case "failed":
            // Payment processing failed
            setIsStart(false);
            setIsReceived(false);
            setIsPolling(false);
            clearInterval(pollInterval);
            dispatch({
              type: TOAST_SHOW,
              payload: {
                message: data.message || t('crypto.paymentFailed', { defaultValue: 'Payment processing failed. Please try again.' }),
                severity: "error",
              },
            });
            break;

          default:
            // Unknown status - handle gracefully
            break;
```

---

## Fix 4: Add Failed Payment UI Component (MEDIUM)

**File:** `Components/Page/Pay3Components/cryptoTransfer.tsx`

### Add this before the "expired" UI render section (around line ~700)

```typescript
  // Render Failed Payment UI
  if (paymentStatus === "failed") {
    return (
      <Box
        display="flex"
        alignItems="center"
        justifyContent="center"
        px={2}
        minHeight="calc(100vh - 340px)"
      >
        <Paper
          elevation={3}
          sx={{
            borderRadius: 4,
            p: "34px",
            width: "100%",
            maxWidth: 450,
            textAlign: "center",
            border: `1px solid ${isDark ? '#FCA5A5' : '#FFE0E0'}`,
            boxShadow: isDark ? "0px 45px 64px 0px rgba(0,0,0,0.3)" : "0px 45px 64px 0px #0D03230F",
            bgcolor: theme.palette.background.paper,
          }}
        >
          <Box
            sx={{
              width: 80,
              height: 80,
              borderRadius: "50%",
              backgroundColor: isDark ? 'rgba(254, 242, 242, 0.15)' : "#FEF2F2",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 24px",
            }}
          >
            <Icon icon="solar:close-circle-bold" width={40} height={40} color="#EF4444" />
          </Box>

          <Typography
            variant="h5"
            fontWeight={600}
            fontFamily="Space Grotesk"
            color={theme.palette.text.primary}
            mb={2}
          >
            {t('failed.title', { defaultValue: 'Payment Failed' })}
          </Typography>

          <Typography
            variant="body1"
            fontFamily="Space Grotesk"
            color={theme.palette.text.secondary}
            mb={3}
            lineHeight={1.6}
          >
            {t('failed.message', { defaultValue: 'There was an issue processing your payment. Please try again or contact support if the problem persists.' })}
          </Typography>

          {merchantInfo?.name && (
            <Box
              sx={{
                backgroundColor: isDark ? 'rgba(249, 250, 251, 0.05)' : "#F9FAFB",
                borderRadius: 2,
                p: 2,
                mb: 3,
              }}
            >
              <Typography
                variant="body2"
                fontFamily="Space Grotesk"
                color={theme.palette.text.secondary}
              >
                {t('failed.merchant', { defaultValue: 'Merchant' })}
              </Typography>
              <Typography
                variant="body1"
                fontWeight={600}
                fontFamily="Space Grotesk"
                color={theme.palette.text.primary}
              >
                {merchantInfo.name}
              </Typography>
            </Box>
          )}

          <Button
            variant="contained"
            fullWidth
            onClick={() => {
              // Reset state to allow retry
              setPaymentStatus("waiting");
              setSelectedCrypto("");
              setSelectedNetwork("");
              setCryptoDetails({ qr_code: "", hash: "", address: "" });
              setIsStart(false);
            }}
            sx={{
              backgroundColor: isDark ? '#6C7BFF' : "#444CE7",
              color: "#FFFFFF",
              borderRadius: "30px",
              py: 1.5,
              fontFamily: "Space Grotesk",
              fontWeight: 500,
              textTransform: "none",
              mb: 2,
              "&:hover": {
                backgroundColor: isDark ? '#5a6ae6' : "#3730A3",
              },
            }}
          >
            {t('failed.tryAgain', { defaultValue: 'Try Again' })}
          </Button>

          <Button
            variant="outlined"
            fullWidth
            onClick={() => setActiveStep(0)}
            sx={{
              borderColor: isDark ? theme.palette.divider : "#D0D5DD",
              color: theme.palette.text.primary,
              borderRadius: "30px",
              py: 1.5,
              fontFamily: "Space Grotesk",
              fontWeight: 500,
              textTransform: "none",
              "&:hover": {
                borderColor: isDark ? '#6C7BFF' : "#98A2B3",
                backgroundColor: isDark ? 'rgba(108, 123, 255, 0.1)' : "#F9FAFB",
              },
            }}
          >
            {t('failed.goBack', { defaultValue: 'Go Back' })}
          </Button>
        </Paper>
      </Box>
    );
  }
```

---

## Fix 5: Handle API Errors for Expired Payment Links (MEDIUM)

**File:** `Components/Page/Pay3Components/cryptoTransfer.tsx`

### Current Error Handler in Polling (around line ~580)

```typescript
      } catch (e: any) {
        const message = e?.response?.data?.message ?? e?.message;
        // dispatch({
        //   type: TOAST_SHOW,
        //   payload: {
        //     message,
        //     severity: 'error'
        //   }
        // })
      }
```

### Fixed Code

```typescript
      } catch (e: any) {
        const message = e?.response?.data?.message ?? e?.message;
        const status = e?.response?.status;
        
        // Handle specific error cases
        if (status === 400) {
          // Check for expiry-related errors
          if (message?.toLowerCase().includes('expired')) {
            setPaymentStatus("expired");
            setIsPolling(false);
            clearInterval(pollInterval);
            dispatch({
              type: TOAST_SHOW,
              payload: {
                message: t('crypto.paymentLinkExpired', { defaultValue: 'This payment link has expired.' }),
                severity: "error",
              },
            });
            return;
          }
          // Check for other validation errors
          if (message?.toLowerCase().includes('invalid') || message?.toLowerCase().includes('not found')) {
            setPaymentStatus("failed");
            setIsPolling(false);
            clearInterval(pollInterval);
            dispatch({
              type: TOAST_SHOW,
              payload: {
                message: message || t('crypto.paymentError', { defaultValue: 'Payment error occurred.' }),
                severity: "error",
              },
            });
            return;
          }
        }
        
        // Handle server errors (500)
        if (status === 500) {
          console.error('[CryptoTransfer] Server error during polling:', message);
          // Don't stop polling for transient server errors, but log them
          // If we get 3 consecutive 500 errors, then stop
        }
        
        // Log other errors but don't interrupt user experience
        console.error('[CryptoTransfer] Polling error:', message);
      }
```

---

## Fix 6: Trigger Expired Status When Countdown Reaches Zero (LOW)

**File:** `pages/pay/index.tsx`

### Current Countdown Timer (around line ~170)

```typescript
  // Countdown timer effect
  useEffect(() => {
    if (!expiryInfo?.expires_at) return

    const updateCountdown = () => {
      const now = new Date().getTime()
      const expiry = new Date(expiryInfo.expires_at).getTime()
      const diff = expiry - now

      if (diff <= 0) {
        setCountdown('Expired')
        return
      }
      // ... rest of countdown logic
    }
```

### Fixed Code

```typescript
  // Countdown timer effect
  useEffect(() => {
    if (!expiryInfo?.expires_at) return

    const updateCountdown = () => {
      const now = new Date().getTime()
      const expiry = new Date(expiryInfo.expires_at).getTime()
      const diff = expiry - now

      if (diff <= 0) {
        setCountdown('Expired')
        // Dispatch a toast to notify user
        dispatch({
          type: TOAST_SHOW,
          payload: {
            message: t('checkout.paymentLinkExpired', { defaultValue: 'This payment link has expired. Please contact the merchant for a new link.' }),
            severity: 'warning'
          }
        })
        return
      }
      // ... rest of countdown logic
    }
```

---

## Fix 7: Add Translation Keys (LOW)

**File:** `public/locales/en/common.json`

Add these translation keys:

```json
{
  "crypto": {
    "paymentFailed": "Payment processing failed. Please try again.",
    "paymentLinkExpired": "This payment link has expired.",
    "paymentError": "An error occurred with your payment."
  },
  "failed": {
    "title": "Payment Failed",
    "message": "There was an issue processing your payment. Please try again or contact support if the problem persists.",
    "merchant": "Merchant",
    "tryAgain": "Try Again",
    "goBack": "Go Back"
  },
  "checkout": {
    "paymentLinkExpired": "This payment link has expired. Please contact the merchant for a new link."
  }
}
```

---

## Summary of Changes

| File | Line(s) | Change |
|------|---------|--------|
| `cryptoTransfer.tsx` | ~178 | Change `grace_period_minutes: 15` → `30` |
| `cryptoTransfer.tsx` | ~45 | Add `"failed"` to PaymentStatusType |
| `cryptoTransfer.tsx` | ~550 | Add `case "failed":` handler in polling switch |
| `cryptoTransfer.tsx` | ~700 | Add Failed Payment UI component render |
| `cryptoTransfer.tsx` | ~580 | Improve error handling for API errors |
| `pages/pay/index.tsx` | ~170 | Add toast notification when countdown expires |
| `public/locales/en/common.json` | N/A | Add translation keys |

---

## Testing Checklist

After applying fixes, test these scenarios:

- [ ] Partial payment shows correct 30-minute grace period timer
- [ ] Backend returning "failed" status shows Failed UI to user
- [ ] "Try Again" button on Failed UI resets and allows retry
- [ ] Expired payment link during polling shows Expired UI
- [ ] Countdown reaching zero shows toast notification
- [ ] All translations render correctly in supported languages

---

## Git Diff Preview

```diff
diff --git a/Components/Page/Pay3Components/cryptoTransfer.tsx b/Components/Page/Pay3Components/cryptoTransfer.tsx
index abc123..def456 100644
--- a/Components/Page/Pay3Components/cryptoTransfer.tsx
+++ b/Components/Page/Pay3Components/cryptoTransfer.tsx
@@ -45,7 +45,8 @@ type PaymentStatusType =
   | "confirmed"    // Payment confirmed successfully
   | "underpaid"    // Partial payment received
   | "overpaid"     // More than expected was paid
-  | "expired";     // Payment window expired
+  | "expired"      // Payment window expired
+  | "failed";      // Payment processing failed
 
 // Merchant settings from backend
 interface MerchantSettings {
@@ -175,7 +176,7 @@ const CryptoTransfer = ({
   // Merchant settings from backend (with defaults)
   const [merchantSettings, setMerchantSettings] = useState<MerchantSettings>({
     overpayment_threshold_usd: 5,  // Default $5, will be updated from backend
-    grace_period_minutes: 15       // Default 15 min, will be updated from backend
+    grace_period_minutes: 30       // Default 30 min, will be updated from backend (matches backend)
   });
```
