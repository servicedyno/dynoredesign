# OVERPAYMENT MONITORING & LOGGING

**Implementation Date:** January 25, 2025  
**Status:** ✅ ACTIVE

---

## 📊 MONITORING SETUP

### 1. Backend Logging (Already Implemented)

**File:** `/app/backend/controller/paymentController.ts`

**Logging Points:**

**A. Overpayment Detection (Line ~1835-1848)**
```typescript
console.log(`[OVERPAYMENT] Detected for transaction ${transactionId}`);
console.log(`[OVERPAYMENT] Expected: ${tempData?.amount} ${tempCurrency}`);
console.log(`[OVERPAYMENT] Received: ${receivedAmount} ${tempCurrency}`);
console.log(`[OVERPAYMENT] Overpaid: ${tempAmount} ${tempCurrency}`);
console.log(`[OVERPAYMENT] In base currency: ${newAmount[0].amount} ${customerData?.base_currency}`);
```

**B. Overpayment Response (Line ~1851-1863)**
```typescript
console.log(`[OVERPAYMENT RESPONSE] Status: overpayment`);
console.log(`[OVERPAYMENT RESPONSE] Amount: ${tempAmount} ${tempCurrency}`);
console.log(`[OVERPAYMENT RESPONSE] Base: ${newAmount[0].amount} ${customerData?.base_currency}`);
```

---

## 📁 LOG FILES

### Backend Logs Location
```bash
/var/log/supervisor/backend.out.log  # Standard output
/var/log/supervisor/backend.err.log  # Error output
```

### Webhook Logs Location
```bash
/app/backend/logs/webhookLogs.log    # Dedicated webhook logs
```

---

## 🔍 MONITORING QUERIES

### Check for Recent Overpayments
```bash
# Last 100 lines with overpayment mentions
tail -n 100 /var/log/supervisor/backend.out.log | grep -i "overpayment"

# Real-time monitoring
tail -f /var/log/supervisor/backend.out.log | grep --color=always -i "overpayment"

# Count overpayments today
grep -i "overpayment detected" /var/log/supervisor/backend.out.log | wc -l
```

### Get Overpayment Details
```bash
# Extract overpayment transactions
grep -B 5 -A 10 "OVERPAYMENT.*Detected" /var/log/supervisor/backend.out.log | tail -50

# Get overpayment amounts
grep "In base currency" /var/log/supervisor/backend.out.log | tail -20
```

---

## 📊 DATABASE MONITORING

### Query Overpayment Transactions (If Stored)

```sql
-- Get recent overpayments
SELECT 
  transaction_id,
  base_amount,
  base_currency,
  paid_amount,
  paid_currency,
  (paid_amount - base_amount) as overpayment_amount,
  status,
  created_at
FROM tbl_customer_transaction
WHERE paid_amount > base_amount * 1.01  -- More than 1% over
ORDER BY created_at DESC
LIMIT 20;

-- Overpayment statistics by currency
SELECT 
  base_currency,
  COUNT(*) as overpayment_count,
  AVG(paid_amount - base_amount) as avg_overpayment,
  SUM(paid_amount - base_amount) as total_overpayment
FROM tbl_customer_transaction
WHERE paid_amount > base_amount * 1.01
GROUP BY base_currency
ORDER BY overpayment_count DESC;

-- Recent high overpayments (>$50 or equivalent)
SELECT 
  transaction_id,
  company_id,
  customer_id,
  base_amount,
  paid_amount,
  (paid_amount - base_amount) as overpayment,
  base_currency,
  status,
  created_at
FROM tbl_customer_transaction
WHERE (paid_amount - base_amount) > 50
  AND status = 'successful'
ORDER BY created_at DESC
LIMIT 10;
```

---

## 🔔 ALERT CONFIGURATION

### High Overpayment Alert

**Threshold:** Overpayments > $100 (or equivalent)

**Implementation Location:** Line ~1845-1847

```typescript
// Current threshold: $5
if (newAmount[0].amount > 5) {
  overPayment = true;
}

// Can be enhanced to:
if (newAmount[0].amount > 5) {
  overPayment = true;
  
  // Alert for high overpayments
  if (newAmount[0].amount > 100) {
    console.log(`[ALERT] HIGH OVERPAYMENT: ${newAmount[0].amount} ${customerData?.base_currency}`);
    // Can add webhook notification, email, or Slack alert here
  }
}
```

---

## 📈 MONITORING DASHBOARD QUERIES

### Daily Overpayment Summary
```sql
SELECT 
  DATE(created_at) as date,
  base_currency,
  COUNT(*) as total_overpayments,
  SUM(paid_amount - base_amount) as total_overpaid,
  AVG(paid_amount - base_amount) as avg_overpaid
FROM tbl_customer_transaction
WHERE paid_amount > base_amount * 1.01
  AND created_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at), base_currency
ORDER BY date DESC, base_currency;
```

### Top Companies with Overpayments
```sql
SELECT 
  c.company_name,
  t.base_currency,
  COUNT(*) as overpayment_count,
  SUM(t.paid_amount - t.base_amount) as total_overpaid
FROM tbl_customer_transaction t
JOIN tbl_company c ON t.company_id = c.company_id
WHERE t.paid_amount > t.base_amount * 1.01
  AND t.created_at >= NOW() - INTERVAL '30 days'
GROUP BY c.company_name, t.base_currency
ORDER BY overpayment_count DESC
LIMIT 10;
```

---

## 🔧 ENHANCED LOGGING (OPTIONAL)

### Add Structured Logging

**File:** `/app/backend/controller/paymentController.ts`

```typescript
// Add after line 1848
if (tempAmount > 0) {
  const overpaymentLog = {
    timestamp: new Date().toISOString(),
    event: 'OVERPAYMENT_DETECTED',
    transaction_id: transactionId,
    company_id: customerData.company_id,
    customer_id: customerData.customer_id,
    expected_amount: tempData?.amount,
    received_amount: receivedAmount,
    overpaid_amount: tempAmount,
    crypto_currency: tempCurrency,
    base_amount: newAmount[0].amount,
    base_currency: customerData?.base_currency,
    threshold_exceeded: newAmount[0].amount > 5,
  };
  
  console.log('[OVERPAYMENT_EVENT]', JSON.stringify(overpaymentLog));
}
```

This creates structured JSON logs that can be easily parsed by log aggregation tools.

---

## 📱 WEBHOOK NOTIFICATIONS (OPTIONAL)

### Notify Merchant of Overpayment

**Add to webhook payload:**

```typescript
// In webhook notification to merchant
const webhookPayload = {
  event: 'payment.completed',
  transaction_id: transactionId,
  status: 'successful',
  amount: {
    expected: tempData?.amount,
    received: receivedAmount,
    currency: tempCurrency,
    base_currency: customerData?.base_currency,
    base_amount: finalAmount[0].amount,
  },
  // Add overpayment information
  ...(tempAmount > 0 && {
    overpayment: {
      detected: true,
      amount_crypto: tempAmount,
      currency_crypto: tempCurrency,
      amount_base: newAmount[0].amount,
      currency_base: customerData?.base_currency,
    }
  }),
  timestamp: new Date().toISOString(),
};

// Send webhook to merchant's callback URL
await sendWebhookNotification(merchantWebhookUrl, webhookPayload);
```

---

## 🎯 MONITORING BEST PRACTICES

### 1. Real-Time Monitoring
```bash
# Monitor overpayments in real-time
tail -f /var/log/supervisor/backend.out.log | grep --line-buffered "OVERPAYMENT"
```

### 2. Daily Reports
```bash
# Create daily overpayment report
grep "OVERPAYMENT.*Detected" /var/log/supervisor/backend.out.log | \
  grep "$(date +%Y-%m-%d)" | \
  wc -l
```

### 3. Alert on High Values
```bash
# Alert if overpayment > $1000
tail -f /var/log/supervisor/backend.out.log | \
  grep "In base currency" | \
  awk '{if ($4 > 1000) print "[ALERT] High overpayment:", $0}'
```

---

## 📊 SAMPLE LOG OUTPUT

### Example Overpayment Log Entry
```
2025-01-25 10:30:45 [OVERPAYMENT] Detected for transaction uuid-123-456
2025-01-25 10:30:45 [OVERPAYMENT] Expected: 0.05 BTC
2025-01-25 10:30:45 [OVERPAYMENT] Received: 0.06 BTC
2025-01-25 10:30:45 [OVERPAYMENT] Overpaid: 0.01 BTC
2025-01-25 10:30:45 [OVERPAYMENT] In base currency: 20 USD
2025-01-25 10:30:45 [OVERPAYMENT RESPONSE] Status: overpayment
2025-01-25 10:30:45 [OVERPAYMENT RESPONSE] Amount: 0.01 BTC
2025-01-25 10:30:45 [OVERPAYMENT RESPONSE] Base: 20 USD
```

### Example Structured Log Entry
```json
{
  "timestamp": "2025-01-25T10:30:45.123Z",
  "event": "OVERPAYMENT_DETECTED",
  "transaction_id": "uuid-123-456",
  "company_id": 1,
  "customer_id": 42,
  "expected_amount": 0.05,
  "received_amount": 0.06,
  "overpaid_amount": 0.01,
  "crypto_currency": "BTC",
  "base_amount": 20,
  "base_currency": "USD",
  "threshold_exceeded": true
}
```

---

## ✅ MONITORING STATUS

| Component | Status | Location |
|-----------|--------|----------|
| Backend Logging | ✅ Active | paymentController.ts |
| Log File Access | ✅ Available | /var/log/supervisor/ |
| Webhook Logs | ✅ Available | /app/backend/logs/ |
| Database Queries | ✅ Ready | SQL queries provided |
| Real-time Monitoring | ✅ Available | tail -f commands |
| Alert System | ⏳ Optional | Can be implemented |
| Dashboard Queries | ✅ Ready | SQL queries provided |

---

## 🚀 NEXT ENHANCEMENTS

1. **Log Aggregation:** Set up ELK stack or similar for centralized logging
2. **Alerting:** Implement Slack/email alerts for high overpayments
3. **Dashboard:** Create admin dashboard with overpayment statistics
4. **Analytics:** Track overpayment patterns by currency, company, time
5. **Reporting:** Automated daily/weekly overpayment reports

---

**Monitoring Status:** ✅ **ACTIVE & READY**  
**Documentation:** ✅ **COMPLETE**  
**Last Updated:** January 25, 2025
