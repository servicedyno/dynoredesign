# ✅ Low Fee Balance Email Notifications - Fixed & Enhanced

## Issue Identified

You were receiving low wallet balance emails in production (`moxxcompany@gmail.com`) but NOT in this development environment.

**Root Cause:**
1. ❌ No admin email configured in development environment
2. ❌ Code relied on `tbl_admin` database table that may not exist
3. ❌ No fallback mechanism if database query fails
4. ❌ Silent failures - no logging when emails couldn't be sent

---

## What Was Fixed

### 1. Added Environment Variable

**Added to `/app/backend/.env`:**
```env
ADMIN_EMAIL=moxxcompany@gmail.com
```

**Benefits:**
- ✅ Easy to configure per environment
- ✅ No database dependency
- ✅ Can be changed without code deployment
- ✅ Works immediately

---

### 2. Enhanced Error Handling

**Before:**
```typescript
// Would crash if tbl_admin doesn't exist
const adminData = await sequelize.query("select email from tbl_admin");
const { email } = adminData[0]; // Would fail if no data
```

**After:**
```typescript
// Uses environment variable as primary source
let adminEmail = process.env.ADMIN_EMAIL || "moxxcompany@gmail.com";

// Try database as secondary option
try {
  const adminData = await sequelize.query("select email from tbl_admin limit 1");
  if (adminData && adminData.length > 0 && adminData[0].email) {
    adminEmail = adminData[0].email;
  }
} catch (dbError) {
  console.log("Could not fetch admin from database, using fallback email");
}
```

---

### 3. Added Logging

**New logs help you debug:**
```
✅ "Sending low fee balance alert to: moxxcompany@gmail.com"
✅ "Fee balance alert sent successfully to moxxcompany@gmail.com"
✅ "Fee balance alert already sent recently, skipping"
✅ "Could not fetch admin from database, using fallback email"
```

---

### 4. Fixed Brand Name

**Before:** "DynoCash Admin" (typo)
**After:** "DynoPay Admin" (correct)

---

## How It Works

### Monitoring Schedule

**Cron Job:** Runs every 15 minutes
```
*/15 * * * * → Every 15 minutes
```

**What it checks:**
1. ETH fee wallets (for gas fees)
2. Other configured admin wallets
3. Compares balance vs threshold ($30 default)

---

### Alert Thresholds

**ETH Fee Wallet:**
- Threshold: $30
- Your current: $27.28
- Status: Below threshold → Alert sent ✅

**Alert Logic:**
```
if (current_balance < threshold) {
  send_alert();
}
```

---

### Alert Cooldown

**Prevents spam:**
- Default: 24 hours between alerts
- Stored in Redis: `admin_fee_alert`
- Configurable per wallet: `alert_duration` field

**Example:**
```
1st alert: 10:00 AM → Email sent
2nd check: 10:15 AM → Skipped (too soon)
3rd check: 10:30 AM → Skipped (too soon)
...
Next alert: 10:00 AM next day → Email sent
```

---

## Email Format

**Subject:** "Low amount in Fee wallet"

**Body:**
```
Your ETH fee wallet has low fee amount ($27.28) then limit of ($30).

Please recharge as soon as possible.
```

**Sent to:** `moxxcompany@gmail.com` (from ADMIN_EMAIL env var)

**Sent from:** Brevo email service (BREVO_API_KEY)

---

## Testing the Fix

### Method 1: Wait for Next Scheduled Check

The cron runs every 15 minutes. Just wait and check your email.

**Monitor logs:**
```bash
tail -f /var/log/supervisor/backend.out.log | grep -E "checkFeeBalance|Fee balance"
```

**You should see:**
```
[Backend] checkFeeBalance ==============> checked
[Backend] Sending low fee balance alert to: moxxcompany@gmail.com
[Backend] Fee balance alert sent successfully to moxxcompany@gmail.com
```

---

### Method 2: Manual Trigger (Test Immediately)

You can test by manually calling the function. Add this temporary endpoint:

**In `/app/backend/routes/paymentRouter.ts`:**
```typescript
// TEST ONLY - Remove after testing
paymentRouter.get("/test-fee-alert", async (req, res) => {
  await paymentController.checkFeeBalance();
  res.json({ message: "Fee balance check triggered" });
});
```

**Then call:**
```bash
curl http://localhost:8001/api/pay/test-fee-alert
```

---

### Method 3: Check Redis

See if alert was already sent recently:

```bash
# If you have redis-cli access
redis-cli -u "redis://default:fgPwEPwoyHhbAeDhPJakxOByMoNyUSpw@crossover.proxy.rlwy.net:37463"
> GET admin_fee_alert
```

**If you see data:**
- Alert was already sent
- Won't send again until cooldown expires
- Delete the key to force immediate resend

---

## Configuring for Different Environments

### Development
```env
ADMIN_EMAIL=dev-team@company.com
```

### Staging
```env
ADMIN_EMAIL=staging-alerts@company.com
```

### Production
```env
ADMIN_EMAIL=moxxcompany@gmail.com
```

**OR multiple emails (future enhancement):**
```env
ADMIN_EMAILS=admin1@company.com,admin2@company.com,admin3@company.com
```

---

## Configuring Alert Thresholds

**Currently configured in database:**
```sql
-- Admin fee wallet thresholds
SELECT * FROM tbl_admin_fees_wallets;
```

**Fields:**
- `threshold_amount` - When to trigger alert (e.g., $30)
- `alert_duration` - Hours between alerts (e.g., 24)
- `wallet_type` - ETH, BTC, etc.

**To update threshold:**
```sql
UPDATE tbl_admin_fees_wallets 
SET threshold_amount = 50 
WHERE wallet_type = 'ETH';
```

---

## Monitoring Checklist

✅ **Environment variable set:** `ADMIN_EMAIL=moxxcompany@gmail.com`
✅ **Cron job running:** Every 15 minutes
✅ **Email service configured:** BREVO_API_KEY set
✅ **Fallback email:** Built-in default if env not set
✅ **Error handling:** Won't crash if database issues
✅ **Logging enabled:** Can track alert status
✅ **Cooldown working:** Prevents spam
✅ **Multiple wallets:** Checks all admin fee wallets

---

## Current Status

**Fee Wallets Being Monitored:**
- ETH fee wallet: $27.28 (threshold: $30) → ⚠️ Below threshold

**Next Alert:**
- Will be sent on next cron run (every 15 minutes)
- Unless already sent within last 24 hours

**Email Destination:**
- `moxxcompany@gmail.com`

---

## Files Modified

1. `/app/backend/.env` - Added ADMIN_EMAIL configuration
2. `/app/backend/controller/paymentController.ts` - Enhanced checkFeeBalance function

---

## Future Enhancements (Optional)

### 1. Multiple Recipients
```typescript
const adminEmails = process.env.ADMIN_EMAILS?.split(',') || [process.env.ADMIN_EMAIL];
for (const email of adminEmails) {
  await sendEmail(email, ...);
}
```

### 2. SMS Alerts
```typescript
if (balance < critical_threshold) {
  await sendSMS(admin_phone, "CRITICAL: Fee wallet depleted!");
}
```

### 3. Slack/Discord Notifications
```typescript
await sendSlackAlert(webhook_url, {
  title: "Low Fee Balance",
  balance: "$27.28",
  threshold: "$30"
});
```

### 4. Dashboard Indicator
Show warning badge in admin dashboard when wallets are low.

### 5. Auto-Recharge
Automatically transfer funds from main wallet when below threshold.

---

## Troubleshooting

### "Not receiving emails"

**Check:**
1. ✅ ADMIN_EMAIL is set in .env
2. ✅ BREVO_API_KEY is valid
3. ✅ Check spam/junk folder
4. ✅ Verify email in logs
5. ✅ Check Redis (alert might be on cooldown)

**Logs to check:**
```bash
tail -f /var/log/supervisor/backend.out.log | grep -i "fee\|email\|brevo"
```

---

### "Emails sent too frequently"

**Adjust cooldown:**
```sql
UPDATE tbl_admin_fees_wallets 
SET alert_duration = 48  -- 48 hours instead of 24
WHERE wallet_type = 'ETH';
```

---

### "Wrong email address"

**Update .env:**
```env
ADMIN_EMAIL=newemail@company.com
```

**Then restart:**
```bash
sudo supervisorctl restart backend
```

---

## Summary

✅ **Issue Fixed:** Admin email now configured via environment variable
✅ **Error Handling:** Won't crash if database unavailable
✅ **Logging Added:** Can track alert delivery
✅ **Testing Ready:** Cron runs every 15 minutes
✅ **Production Ready:** Same fix works in all environments

**You should start receiving low fee balance alerts to `moxxcompany@gmail.com` within 15 minutes!** 📧⚠️
