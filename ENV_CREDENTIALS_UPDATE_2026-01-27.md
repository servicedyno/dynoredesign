# Environment Credentials Update - January 27, 2026

## Updated Credentials

### ✅ Veriff Identity Verification (KYC)
**Service:** Veriff KYC/Identity Verification  
**Dashboard:** https://www.veriff.com/

**Updated Variables:**
- `VERIFF_API_KEY` = `7a372667-446f-4860-9634-e27aad20ec03`
- `VERIFF_API_SECRET` = `671d951f-32ae-4a0b-a7ad-3be4c2ca39de`

**Usage:**
- KYC verification endpoints in `/app/backend/controller/kycController.ts`
- Endpoints: 
  - `POST /api/kyc/submit` - Start identity verification
  - `POST /api/kyc/webhook` - Receive verification results
  - `GET /api/kyc/status` - Check verification status

---

### ✅ Telnyx SMS Verification
**Service:** Telnyx SMS & Phone Verification  
**Dashboard:** https://portal.telnyx.com/

**Updated Variables:**
- `TELNYX_API_KEY` = `KEY019B6F591AACFAF1451A80C66809193A_TKJeBs8NaHEaqFkEh2HuYe`
- `TELNYX_VERIFY_PROFILE_ID` = `40018496-5934-4297-988d-7ca59824b7c4`
- `PROFILE_ID` = `40018496-5934-4297-988d-7ca59824b7c4`

**Usage:**
- SMS OTP verification in `/app/backend/services/smsService.ts`
- Phone verification endpoints in `/app/backend/controller/userController.ts`
- Endpoints:
  - `POST /api/user/send-otp` - Send SMS OTP
  - `POST /api/user/verify-otp` - Verify SMS OTP
  - `POST /api/wallet/address/send-otp` - Wallet edit OTP

---

## Changes Applied

1. ✅ Updated `/app/backend/.env` file with new credentials
2. ✅ Restarted backend service to load new environment variables
3. ✅ Verified credentials are loaded correctly
4. ✅ Backend status: **OPERATIONAL**

## Verification Results

```
✅ Veriff API Key: 7a372667... (Loaded)
✅ Veriff API Secret: 671d951f... (Loaded)
✅ Telnyx API Key: KEY019B6... (Loaded)
✅ Telnyx Profile ID: 40018496... (Loaded)
✅ Backend Status: RUNNING (pid 1134)
✅ Application Status: operational
```

---

## Next Steps

The following features are now ready to use with live credentials:

### 1. KYC/Identity Verification
- Users can submit identity verification requests
- Veriff will process document verification
- Webhook will receive verification results automatically

### 2. SMS/Phone Verification
- SMS OTP can be sent to users for:
  - Login verification
  - Password reset
  - Wallet address editing
  - Phone number verification

### Testing Recommendations:
1. Test KYC flow with real document upload
2. Test SMS OTP sending to verify Telnyx integration
3. Monitor webhook deliveries from Veriff
4. Check SMS delivery logs in Telnyx dashboard

---

## Important Notes

⚠️ **Security:**
- These are production credentials - handle with care
- Never commit `.env` file to version control
- Rotate keys periodically for security

⚠️ **Cost:**
- Veriff charges per verification attempt
- Telnyx charges per SMS sent
- Monitor usage in respective dashboards

⚠️ **Rate Limits:**
- Veriff: Check your plan's verification limits
- Telnyx: Monitor SMS delivery rates and quotas

---

**Update Completed:** January 27, 2026  
**Backend Status:** ✅ Operational  
**Services Updated:** 2 (Veriff KYC, Telnyx SMS)
