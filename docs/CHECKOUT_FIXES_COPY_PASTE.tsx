// ============================================================
// CHECKOUT FRONTEND FIXES - COPY-PASTE READY CODE
// ============================================================
// Apply these changes to DynocheckoutDarkMode/ongoingfixes branch
// File: Components/Page/Pay3Components/cryptoTransfer.tsx
// ============================================================

// ============================================================
// FIX 1: Update PaymentStatusType (line ~45)
// Replace the existing type definition with this:
// ============================================================

// Payment status types
type PaymentStatusType =
  | "waiting"       // No payment detected yet
  | "pending"       // Payment detected, awaiting confirmation
  | "confirmed"     // Payment confirmed successfully
  | "underpaid"     // Partial payment received
  | "overpaid"      // More than expected was paid
  | "expired"       // Payment window expired
  | "failed";       // Payment processing failed  <-- ADD THIS


// ============================================================
// FIX 2: Update merchantSettings default (line ~178)
// Change grace_period_minutes from 15 to 30:
// ============================================================

// Merchant settings from backend (with defaults)
const [merchantSettings, setMerchantSettings] = useState<MerchantSettings>({
  overpayment_threshold_usd: 5,  // Default $5, will be updated from backend
  grace_period_minutes: 30       // CHANGED: 15 → 30 (matches backend default)
});


// ============================================================
// FIX 3: Add "failed" case in polling switch statement
// Add this case after the "expired" case (around line ~560):
// ============================================================

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


// ============================================================
// FIX 4: Improve error handling in polling catch block
// Replace the existing catch block (around line ~580) with:
// ============================================================

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
        
        // Log other errors but don't interrupt user experience
        console.error('[CryptoTransfer] Polling error:', message);
      }


// ============================================================
// FIX 5: Add Failed Payment UI Render
// Add this block BEFORE the "expired" render check (around line ~700)
// Add AFTER the overpayment render and BEFORE the expired render:
// ============================================================

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


// ============================================================
// FIX 6: Add translation keys to public/locales/en/common.json
// Add these keys to the existing JSON file:
// ============================================================

/*
Add to "crypto" section:
  "paymentFailed": "Payment processing failed. Please try again.",
  "paymentLinkExpired": "This payment link has expired.",
  "paymentError": "An error occurred with your payment."

Add new "failed" section:
  "failed": {
    "title": "Payment Failed",
    "message": "There was an issue processing your payment. Please try again or contact support if the problem persists.",
    "merchant": "Merchant",
    "tryAgain": "Try Again",
    "goBack": "Go Back"
  }

Add to "checkout" section:
  "paymentLinkExpired": "This payment link has expired. Please contact the merchant for a new link."
*/


// ============================================================
// OPTIONAL FIX 7: Add toast on countdown expiry
// File: pages/pay/index.tsx
// In the countdown timer useEffect, update the diff <= 0 block:
// ============================================================

      if (diff <= 0) {
        setCountdown('Expired')
        // ADD THIS: Notify user when payment link expires
        dispatch({
          type: TOAST_SHOW,
          payload: {
            message: t('checkout.paymentLinkExpired', { defaultValue: 'This payment link has expired. Please contact the merchant for a new link.' }),
            severity: 'warning'
          }
        })
        return
      }
