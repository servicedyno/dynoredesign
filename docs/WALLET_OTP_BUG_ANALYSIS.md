# Manual SQL Fix for User 28 Wallet Issue

## Problem
- BTC wallet has Ethereum address: `0x9a7221b5e32d5f99e8da95585835442e29afb38f`
- ETH wallet has null address
- User selected ETH but system saved to BTC wallet

## Root Cause
Bug in `verifyOtp` function - doesn't validate that currency parameter matches what was validated earlier.

## Immediate Fix (SQL)

```sql
-- Clear the wrong ETH address from BTC wallet
UPDATE tbl_user_wallet
SET wallet_address = NULL,
    company_id = NULL,
    wallet_name = NULL
WHERE user_id = 28
  AND wallet_type = 'BTC'
  AND company_id = 38;
```

## User Action Required
1. Check email richard@dyno.pt for OTP code
2. In frontend, verify OTP
3. **CRITICAL:** Make sure frontend sends `currency: "ETH"` in verifyOtp request
4. This will properly save address to ETH wallet

## Code Fix Needed
The `verifyOtp` function needs to store and validate which currency was validated.

### Option 1: Store currency with OTP (Recommended)
```typescript
// In updateOtp function (line 2565)
await userModel.update(
  {
    verified_otp: randomNumberOTP.toString(),
    otp_expired: new Date(Date.now() + 5 * 60 * 1000),
    // ADD THIS NEW FIELD:
    otp_currency: currency  // Store which currency was validated
  },
  {
    where: { user_id: userData.user_id },
  }
);

// In verifyOtp function (line 2740)
// VALIDATE currency matches
const walletWithOtp = await userModel.findOne({
  where: {
    user_id: user_id,
    verified_otp: otp,
  },
});

if (!walletWithOtp) {
  return errorResponseHelper(res, 400, "Please enter a valid OTP!");
}

// ADD THIS VALIDATION:
if (walletWithOtp.dataValues.otp_currency !== currency) {
  return errorResponseHelper(
    res, 400,
    `OTP was generated for ${walletWithOtp.dataValues.otp_currency} wallet, but you're trying to verify ${currency} wallet!`
  );
}
```

### Option 2: Use Redis to store OTP context
Store OTP with currency in Redis with key: `wallet_otp_${user_id}`

## Prevention
This bug allows malicious users to:
1. Validate BTC address → get OTP
2. Call verifyOtp with `currency: "ETH"`  
3. Save BTC address to ETH wallet

Must add validation that currency in verifyOtp matches currency in validateWallet.
